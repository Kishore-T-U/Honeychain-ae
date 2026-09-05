"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { getProfile, dashboardPathForRole, type UserRole } from "@/lib/auth";

const roleOptions: { value: UserRole; label: string }[] = [
  { value: "beekeeper", label: "Beekeeper" },
  { value: "fpo_collector", label: "FPO / Collector" },
  { value: "buyer_processor", label: "Buyer / Processor" },
  { value: "government", label: "Government" },
  { value: "consumer", label: "Consumer" },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("beekeeper");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? "Sign in failed.");
      setLoading(false);
      return;
    }

    const profile = await getProfile(supabase, data.user.id);
    router.push(dashboardPathForRole(profile?.role ?? "consumer"));
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "Sign up failed.");
      setLoading(false);
      return;
    }

    // The DB trigger (see supabase/schema.sql) already created a profile
    // row with the default role. Update it to the role picked here.
    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);

    if (roleError) {
      setError(
        "Account created, but role could not be set: " + roleError.message
      );
      setLoading(false);
      return;
    }

    router.push(dashboardPathForRole(role));
  }

  const isSignup = mode === "signup";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs tracking-wide text-comb-700/70">
        HoneyChain-AE
      </p>
      <h1 className="mt-2 font-display text-2xl italic text-comb-950">
        {isSignup ? "Create an account" : "Sign in"}
      </h1>

      <form
        onSubmit={isSignup ? handleSignUp : handleSignIn}
        className="mt-8 flex flex-col gap-4"
      >
        {isSignup && (
          <label className="flex flex-col gap-1 text-sm">
            Full name
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="border border-comb-700/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-comb-950"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-comb-700/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-comb-950"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-comb-700/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-comb-950"
          />
        </label>

        {isSignup && (
          <label className="flex flex-col gap-1 text-sm">
            I am a...
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="border border-comb-700/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-comb-950"
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <p className="border border-rust-600/40 px-3 py-2 text-sm text-rust-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 border border-comb-950 bg-comb-950 px-4 py-2.5 text-sm font-medium text-parchment transition-colors hover:bg-comb-800 disabled:opacity-50"
        >
          {loading ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <button
        onClick={() => setMode(isSignup ? "signin" : "signup")}
        className="mt-6 text-left text-sm text-comb-700 underline underline-offset-2"
      >
        {isSignup
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </main>
  );
}
