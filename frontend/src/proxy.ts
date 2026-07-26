import { NextResponse, type NextRequest } from "next/server";

/**
 * Route guard.
 *
 * Named `proxy.ts`, not `middleware.ts`: Next.js 16 renamed the convention and
 * deprecated the old name. It sits beside `app/`, not inside it — a file at
 * `src/app/proxy.ts` is just an ordinary module and never runs.
 *
 * **This is not a security boundary, and it is important not to describe it as
 * one.** It checks only that a cookie is *present*; it never verifies the
 * signature or the expiry. Anyone can set `access_token=nonsense` in devtools
 * and get past it. What that buys them is a dashboard shell whose every data
 * request the backend rejects with a 401, plus a `getCurrentUser()` call in the
 * dashboard layout that fails and redirects them back here.
 *
 * Next's own documentation makes the same point — proxy is suited to
 * "optimistic checks", not authorisation. The value is avoiding a pointless
 * server render for the overwhelmingly common case of a signed-out visitor.
 */

const AUTH_ROUTES = new Set(["/login", "/register"]);

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("access_token");
  const { pathname } = request.nextUrl;
  const isAuthRoute = AUTH_ROUTES.has(pathname);

  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Someone already signed in has no use for the login form.
  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /*
    Everything except Next's own assets. Without the exclusions the guard runs
    on every stylesheet and script request too — which both wastes work and, for
    a signed-out visitor, redirects the login page's own CSS to /login.
  */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
