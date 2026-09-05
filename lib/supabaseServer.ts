import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Use inside Server Components / Route Handlers to read the logged-in
// user's session from cookies (set by the browser client on login).
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // No-op in Server Components — session refresh happens in
        // middleware.ts instead. Safe to leave empty here.
      },
      remove() {
        // No-op — see note above.
      },
    },
  });
}
