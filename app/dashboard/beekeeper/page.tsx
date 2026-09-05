"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabaseClient";

interface HiveReading {
  id: string;
  apiary_id: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  acoustic_risk_score: number | null;
  sensor_ok: boolean;
  recorded_at: string;
}

function riskStamp(score: number | null) {
  if (score === null) return <span className="stamp-pending">no reading</span>;
  if (score < 0.3) return <span className="stamp-verified">low risk</span>;
  if (score < 0.7) return <span className="stamp-pending">watch</span>;
  return <span className="stamp-rejected">inspect</span>;
}

export default function BeekeeperDashboard() {
  const supabase = createClient();
  const [readings, setReadings] = useState<HiveReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiaryId, setApiaryId] = useState("APIARY-001");
  const [saving, setSaving] = useState(false);

  async function loadReadings() {
    setLoading(true);
    // TODO: once auth is wired end-to-end, filter with
    // .eq("beekeeper_id", user.id) instead of pulling everything.
    const { data, error } = await supabase
      .from("hive_evidence")
      .select("id, apiary_id, temperature_c, humidity_pct, acoustic_risk_score, sensor_ok, recorded_at")
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (!error && data) setReadings(data as HiveReading[]);
    setLoading(false);
  }

  useEffect(() => {
    loadReadings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addSimulatedReading() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // NOTE: this is a manual/simulated entry for the prototype. The real
    // system writes this row from the ESP32-S3 sensor pipeline, not from
    // a button — see section 3.1 of the design doc.
    await supabase.from("hive_evidence").insert({
      apiary_id: apiaryId,
      beekeeper_id: user?.id,
      temperature_c: 34 + Math.random() * 2,
      humidity_pct: 55 + Math.random() * 10,
      acoustic_risk_score: Math.random(),
      sensor_ok: true,
    });

    await loadReadings();
    setSaving(false);
  }

  return (
    <DashboardShell requiredRole="beekeeper" title="Hive evidence">
      <section className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex flex-col gap-1 text-sm">
          Apiary ID
          <input
            value={apiaryId}
            onChange={(e) => setApiaryId(e.target.value)}
            className="border border-comb-700/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-comb-950"
          />
        </label>
        <button
          onClick={addSimulatedReading}
          disabled={saving}
          className="border border-comb-950 bg-comb-950 px-4 py-2.5 text-sm font-medium text-parchment transition-colors hover:bg-comb-800 disabled:opacity-50"
        >
          {saving ? "Recording..." : "Log simulated reading"}
        </button>
      </section>

      <p className="mt-3 text-xs text-comb-700/70">
        This button stands in for the real ESP32-S3 sensor feed while the
        hardware pipeline isn&apos;t connected yet — it writes a row straight
        to Supabase so the rest of the flow (risk gating, dashboards) is
        testable end to end.
      </p>

      <div className="ledger-panel mt-6">
        {loading ? (
          <p className="p-4 text-sm text-comb-700">Loading readings...</p>
        ) : readings.length === 0 ? (
          <p className="p-4 text-sm text-comb-700">
            No hive evidence yet. Log a reading above to see it here.
          </p>
        ) : (
          <div className="divide-y divide-comb-700/15">
            {readings.map((r) => (
              <div key={r.id} className="ledger-row px-4">
                <div>
                  <p className="font-medium text-comb-950">{r.apiary_id}</p>
                  <p className="font-mono text-xs text-comb-700">
                    {new Date(r.recorded_at).toLocaleString()} · {r.temperature_c?.toFixed(1)}°C · {r.humidity_pct?.toFixed(0)}% RH
                  </p>
                </div>
                {riskStamp(r.acoustic_risk_score)}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
