import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated =
    request.cookies.get(AUTH_COOKIE)?.value === "1";
  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api/");

  if (isApiRoute) {
    // Login must be reachable without an existing session.
    const isPublicApi =
      pathname === "/api/auth/login" || pathname.startsWith("/api/auth/login/");
    if (!isAuthenticated && !isPublicApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!isAuthenticated && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") {
      url.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|lottie)$).*)",
  ],
};
