import {
  AUTH_COOKIE,
  AUTH_STORAGE_KEY,
  DEMO_EMAIL,
  DEMO_USER_NAME,
  DEMO_USER_ROLE,
  type AuthUser,
} from "./auth";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export function setAuthCookie() {
  document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${SESSION_MAX_AGE_SEC}; SameSite=Lax`;
}

export function clearAuthCookie() {
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function hasAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((part) => part.trim() === `${AUTH_COOKIE}=1`);
}

export function persistUser(user: AuthUser) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as AuthUser;
    if (user.email === DEMO_EMAIL) {
      return {
        ...user,
        name: DEMO_USER_NAME,
        role: DEMO_USER_ROLE,
      };
    }
    return { ...user, role: user.role ?? "User" };
  } catch {
    return null;
  }
}

export function clearStoredUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
