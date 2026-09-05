import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole =
  | "beekeeper"
  | "fpo_collector"
  | "buyer_processor"
  | "government"
  | "consumer";

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  organization: string | null;
}

export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("[HoneyChain-AE] Failed to load profile:", error.message);
    return null;
  }

  return data as Profile;
}

export function dashboardPathForRole(role: UserRole): string {
  return `/dashboard/${role === "fpo_collector" ? "fpo" : role === "buyer_processor" ? "buyer" : role}`;
}
