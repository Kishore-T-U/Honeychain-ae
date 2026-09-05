"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabaseClient";

interface Claim {
  id: string;
  claim_type: string;
  status: string;
  evidence_summary: string | null;
  created_at: string;
}

function statusStamp(status: string) {
  if (status === "supported") return <span className="stamp-verified">supported</span>;
  if (status === "rejected") return <span className="stamp-rejected">rejected</span>;
  return <span className="stamp-pending">pending</span>;
}

export default function BuyerDashboard() {
  const supabase = createClient();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("claims")
        .select("id, claim_type, status, evidence_summary, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (!error && data) setClaims(data as Claim[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  return (
    <DashboardShell requiredRole="buyer_processor" title="Lot eligibility">
      <p className="text-sm text-comb-700">
        Each lot&apos;s claims, with the evidence that currently supports (or
        fails to support) them — never a bare &quot;verified&quot; badge.
        {/* TODO: wire this to the real Claim Engine / TAAC output once
            that service exists; for now it reads the `claims` table
            directly. */}
      </p>

      <div className="ledger-panel mt-6">
        {loading ? (
          <p className="p-4 text-sm text-comb-700">Loading claims...</p>
        ) : claims.length === 0 ? (
          <p className="p-4 text-sm text-comb-700">No claims recorded yet.</p>
        ) : (
          <div className="divide-y divide-comb-700/15">
            {claims.map((c) => (
              <div key={c.id} className="ledger-row px-4">
                <div>
                  <p className="font-medium text-comb-950">{c.claim_type}</p>
                  <p className="text-xs text-comb-700">
                    {c.evidence_summary ?? "No evidence summary yet."}
                  </p>
                </div>
                {statusStamp(c.status)}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
