import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, getSessionCookieName } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/inbound/leads") ||
    pathname.startsWith("/api/mock-buyer") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(getSessionCookieName())?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};