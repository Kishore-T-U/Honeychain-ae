"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { getProfile, dashboardPathForRole, type UserRole, type Profile } from "@/lib/auth";

/**
 * Wraps every /dashboard/* page. Confirms the signed-in user's role
 * matches this dashboard (redirects them to their own dashboard if not),
 * and renders a small ledger-style header with sign-out.
 *
 * This is the client-side half of role gating — middleware.ts handles
 * "are you signed in at all" before the page even loads.
 */
export default function DashboardShell({
  requiredRole,
  title,
  children,
}: {
  requiredRole: UserRole;
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;

    async function run() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const p = await getProfile(supabase, user.id);
      if (!active) return;

      if (!p || p.role !== requiredRole) {
        router.replace(dashboardPathForRole(p?.role ?? "consumer"));
        return;
      }

      setProfile(p);
      setChecked(true);
    }

    run();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiredRole]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!checked) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm text-comb-700">Checking access...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="flex items-center justify-between border-b border-comb-700/20 pb-4">
        <div>
          <p className="font-mono text-xs tracking-wide text-comb-700/70">
            HoneyChain-AE
          </p>
          <h1 className="font-display text-2xl italic text-comb-950">
            {title}
          </h1>
        </div>
        <div className="text-right text-sm">
          <p className="text-comb-950">{profile?.full_name ?? "—"}</p>
          <button
            onClick={handleSignOut}
            className="text-comb-700 underline underline-offset-2"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mt-8">{children}</div>
    </main>
  );
}
