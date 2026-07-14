export const USER_ROLES = ["Super Admin", "Accountant", "Bookkeeper", "Viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["Active", "Invited", "Disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  password_hash: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateAppUserInput = {
  email: string;
  name: string;
  role?: UserRole;
  status?: UserStatus;
  password?: string;
};

export function rowToAppUser(row: AppUserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
