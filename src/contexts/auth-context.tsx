"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { DEMO_EMAIL, userFromEmail, type AuthUser } from "@/lib/auth";
import {
  clearAuthCookie,
  clearStoredUser,
  hasAuthCookie,
  persistUser,
  readStoredUser,
  setAuthCookie,
} from "@/lib/auth-client";

type AuthContextValue = {
  user: AuthUser | null;
  isReady: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let nextUser = readStoredUser();

    // Cookie (middleware) and localStorage (profile) can get out of sync after
    // storage clears, private browsing, or older sessions — restore when possible.
    if (!nextUser && hasAuthCookie()) {
      nextUser = userFromEmail(DEMO_EMAIL);
      persistUser(nextUser);
    } else if (nextUser && !hasAuthCookie()) {
      clearStoredUser();
      nextUser = null;
    }

    setUser(nextUser);
    setIsReady(true);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as {
        user?: AuthUser;
        error?: string;
      };
      if (!response.ok || !payload.user) {
        return {
          ok: false as const,
          message: payload.error ?? "Invalid email or password.",
        };
      }
      const nextUser: AuthUser = {
        email: payload.user.email,
        name: payload.user.name,
        role: payload.user.role,
      };
      setAuthCookie();
      persistUser(nextUser);
      setUser(nextUser);
      return { ok: true as const };
    } catch {
      return {
        ok: false as const,
        message: "Could not reach the login service. Try again.",
      };
    }
  }, []);

  const signOut = useCallback(() => {
    clearAuthCookie();
    clearStoredUser();
    setUser(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({ user, isReady, signIn, signOut }),
    [user, isReady, signIn, signOut],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
