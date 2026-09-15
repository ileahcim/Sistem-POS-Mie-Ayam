import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

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
    // Skip static files, images, and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
