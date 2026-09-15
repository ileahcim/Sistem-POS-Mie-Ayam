import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Redirects a LOGGED-OUT visitor to /login (unless already headed to one of
// these), and a LOGGED-IN visitor away from /login itself.
const PUBLIC_PATHS = ["/login"];

// Always directly reachable, logged in or not, and never redirected away
// even when logged in — /offline is precached by the service worker (see
// public/sw.js) and must render for whoever the device's current user
// happens to be, not just logged-out visitors. Unlike /login it's not a
// place anyone "arrives" at on purpose, so there's no matching
// isLoggedIn-redirect-away rule for it.
const ALWAYS_ALLOWED_PATHS = ["/offline"];

// Refreshes the Supabase session cookie on every request (required — see
// @supabase/ssr's warning about relying on Server Components alone to
// write cookies) and gates every non-public route behind a valid session.
// Role-based gating (OWNER-only pages/actions) happens deeper in the app,
// not here — this only answers "is anyone logged in".
//
// Future direction (not built yet): the Kasir screen will stay
// permanently signed in on the tablet (never redirected here), while the
// OWNER dashboard adds its own idle-timeout re-lock back to Kasir, and
// individual cashiers identify themselves at shift-open via a 4-digit PIN
// rather than this username/password login. Nothing here should need to
// change for that — it'll be per-route-group logic layered on top of the
// same session, not a different auth mechanism.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  if (ALWAYS_ALLOWED_PATHS.includes(request.nextUrl.pathname)) {
    return response;
  }

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = !!data?.claims;
  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!isLoggedIn && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static files, images, Next internals, and every PWA asset
    // (manifest, generated icons, service worker) — these must be
    // fetchable with a plain 200 regardless of session state. A browser
    // resolves <link rel="manifest">/icon/apple-touch-icon and registers
    // the service worker from the *current* page (including /login, before
    // any session exists), and a redirected response breaks SW
    // registration outright (browsers require a real 200 + correct
    // Content-Type, never a redirect) — see CLAUDE.md "PWA".
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw\\.js|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
