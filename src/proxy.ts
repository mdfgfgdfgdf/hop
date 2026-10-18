import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap edge guard: anonymous users (no session cookie) are redirected to
 * login before any app route renders. Real authorization (role checks,
 * session validity) happens in the route-group layouts and API handlers.
 */
export function proxy(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get("hop_session")?.value);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/ride/:path*", "/drive/:path*", "/admin/:path*"],
};
