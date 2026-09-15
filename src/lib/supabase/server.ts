import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Create a fresh client per request — never share/cache this across
// requests (see @supabase/ssr's own warning in createServerClient's docs).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component that can't set cookies (no
            // response to attach them to) — harmless as long as the proxy
            // (src/proxy.ts) is refreshing the session on every request.
          }
        },
      },
    },
  );
}
