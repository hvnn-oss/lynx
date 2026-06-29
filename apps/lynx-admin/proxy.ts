import { NextRequest, NextResponse } from "next/server";

const ADMIN_ACCESS_TOKEN_COOKIE = "lynx_admin_access_token";

export function proxy(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const hasLoginError = request.nextUrl.searchParams.has("error");
  const hasToken = Boolean(
    request.cookies.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value,
  );

  if (hasToken && isLoginPage && !hasLoginError) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (!hasToken && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
