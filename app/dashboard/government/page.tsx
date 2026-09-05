"use client";

import DashboardShell from "@/components/DashboardShell";

export default function GovernmentDashboard() {
  return (
    <DashboardShell requiredRole="government" title="Ecosystem view">
      <p className="text-sm text-comb-700">
        Positioned as a complement to Madhukranti / NBB identity and
        traceability records, not a replacement — this view is a
        placeholder until an adapter to that data source exists.
      </p>

      <div className="ledger-panel mt-6 p-4">
        <p className="text-sm text-comb-700">
          {/* TODO: replace with real aggregate stats once government
              adapter + a proper reporting query exist:
              - registered apiaries / FPOs on the network
              - lots with fully supported claims vs. open evidence gaps
              - sensor-fault / false-alert rate (see "WHAT WE WILL MEASURE") */}
          No ecosystem-level data connected yet.
        </p>
      </div>
    </DashboardShell>
  );
}
