import { createBrowserClient } from "@supabase/ssr";

// <<< NEEDS YOUR SUPABASE CREDENTIALS >>>
// These come from NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// in .env.local (copy .env.local.example -> .env.local and fill them in).
// Get them from: Supabase dashboard -> your project -> Settings -> API.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Loud, early failure instead of a silent broken client — this is the
  // single most common first-run problem for this project.
  console.warn(
    "[HoneyChain-AE] Missing Supabase env vars. Copy .env.local.example to " +
      ".env.local and fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

console.log("CHECKING URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

export function createClient() {
  return createBrowserClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
}
