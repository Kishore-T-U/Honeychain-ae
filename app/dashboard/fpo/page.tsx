"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabaseClient";

interface HarvestEvent {
  id: string;
  apiary_id: string;
  container_id: string;
  measured_mass_kg: number;
  recorded_at: string;
}

export default function FpoDashboard() {
  const supabase = createClient();
  const [events, setEvents] = useState<HarvestEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("harvest_events")
        .select("id, apiary_id, container_id, measured_mass_kg, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(10);
      if (!error && data) setEvents(data as HarvestEvent[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  return (
    <DashboardShell requiredRole="fpo_collector" title="Harvest intake">
      <p className="text-sm text-comb-700">
        Measured-mass harvest events bound to source apiary and container.
        {/* TODO: add an intake form here (apiary_id, container_id,
            measured_mass_kg) once the stable-weight rule from
            HarvestTrust-Lite is wired to a real load cell / HX711 input,
            or to a manual-entry fallback for the demo. */}
      </p>

      <div className="ledger-panel mt-6">
        {loading ? (
          <p className="p-4 text-sm text-comb-700">Loading harvest events...</p>
        ) : events.length === 0 ? (
          <p className="p-4 text-sm text-comb-700">
            No harvest events recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-comb-700/15">
            {events.map((e) => (
              <div key={e.id} className="ledger-row px-4">
                <div>
                  <p className="font-medium text-comb-950">
                    {e.apiary_id} → {e.container_id}
                  </p>
                  <p className="font-mono text-xs text-comb-700">
                    {new Date(e.recorded_at).toLocaleString()}
                  </p>
                </div>
                <span className="font-mono text-sm">{e.measured_mass_kg} kg</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
