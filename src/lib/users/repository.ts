import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashPassword, verifyPassword } from "@/lib/users/password";
import {
  rowToAppUser,
  type AppUser,
  type AppUserRow,
  type CreateAppUserInput,
  type UserRole,
  type UserStatus,
  USER_ROLES,
  USER_STATUSES,
} from "@/lib/users/types";

const TABLE = "app_users";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

export async function listAppUsersFromDb(): Promise<AppUser[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, email, name, role, status, password_hash, last_login_at, created_at, updated_at",
    )
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as AppUserRow[]).map(rowToAppUser);
}

export async function createAppUserInDb(input: CreateAppUserInput): Promise<AppUser> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!email || !name) {
    throw new Error("Name and email are required.");
  }

  const role: UserRole =
    input.role && USER_ROLES.includes(input.role) ? input.role : "Viewer";
  const status: UserStatus =
    input.status && USER_STATUSES.includes(input.status)
      ? input.status
      : input.password
        ? "Active"
        : "Invited";

  const passwordHash = input.password?.trim()
    ? await hashPassword(input.password.trim())
    : null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      email,
      name,
      role,
      status,
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, email, name, role, status, password_hash, last_login_at, created_at, updated_at",
    )
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error("Users table is missing. Run the app_users migration in Supabase.");
    }
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      throw new Error("A user with that email already exists.");
    }
    throw new Error(error.message);
  }

  return rowToAppUser(data as AppUserRow);
}

export async function updateAppUserInDb(
  id: string,
  patch: {
    name?: string;
    role?: UserRole;
    status?: UserStatus;
    password?: string;
  },
): Promise<AppUser> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name != null) updates.name = patch.name.trim();
  if (patch.role != null) {
    if (!USER_ROLES.includes(patch.role)) throw new Error("Invalid role.");
    updates.role = patch.role;
  }
  if (patch.status != null) {
    if (!USER_STATUSES.includes(patch.status)) throw new Error("Invalid status.");
    updates.status = patch.status;
  }
  if (patch.password?.trim()) {
    updates.password_hash = await hashPassword(patch.password.trim());
    if (!patch.status) updates.status = "Active";
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq("id", id)
    .select(
      "id, email, name, role, status, password_hash, last_login_at, created_at, updated_at",
    )
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error("Users table is missing. Run the app_users migration in Supabase.");
    }
    throw new Error(error.message);
  }

  return rowToAppUser(data as AppUserRow);
}

export async function deleteAppUserInDb(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: existing, error: findError } = await supabase
    .from(TABLE)
    .select("id, role")
    .eq("id", id)
    .maybeSingle();

  if (findError) {
    if (isMissingTableError(findError)) {
      throw new Error("Users table is missing. Run the app_users migration in Supabase.");
    }
    throw new Error(findError.message);
  }
  if (!existing) throw new Error("User not found.");
  if ((existing as { role: string }).role === "Super Admin") {
    throw new Error("Super Admin cannot be removed.");
  }

  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function authenticateAppUser(
  email: string,
  password: string,
): Promise<AppUser | null> {
  const normalized = normalizeEmail(email);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, email, name, role, status, password_hash, last_login_at, created_at, updated_at",
    )
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;

  const row = data as AppUserRow;
  if (row.status !== "Active") return null;

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return null;

  const now = new Date().toISOString();
  await supabase
    .from(TABLE)
    .update({ last_login_at: now, updated_at: now })
    .eq("id", row.id);

  return rowToAppUser({ ...row, last_login_at: now, updated_at: now });
}
