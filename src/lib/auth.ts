export const AUTH_COOKIE = "petrobook_auth";
export const AUTH_STORAGE_KEY = "petrobook_user";

export type AuthUser = {
  email: string;
  name: string;
  role?: string;
};

export const DEMO_EMAIL = "admin@petrosphere.com";
export const DEMO_PASSWORD = "demo123";
export const DEMO_USER_NAME = "John Aivanne Molato";
export const DEMO_USER_ROLE = "Super Admin";

export function validateCredentials(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD
  );
}

export function userFromEmail(email: string): AuthUser {
  const normalized = email.trim().toLowerCase();
  if (normalized === DEMO_EMAIL) {
    return {
      email: normalized,
      name: DEMO_USER_NAME,
      role: DEMO_USER_ROLE,
    };
  }
  const local = email.split("@")[0] ?? "User";
  const name = local
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { email: normalized, name, role: "User" };
}
