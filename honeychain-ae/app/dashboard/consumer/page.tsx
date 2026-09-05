"use client";

import { useState } from "react";
import DashboardShell from "@/components/DashboardShell";

export default function ConsumerDashboard() {
  const [view, setView] = useState<"story" | "technical">("story");

  return (
    <DashboardShell requiredRole="consumer" title="HoneyPass">
      <div className="flex gap-2">
        <button
          onClick={() => setView("story")}
          className={`border px-3 py-1.5 text-sm ${
            view === "story"
              ? "border-comb-950 bg-comb-950 text-parchment"
              : "border-comb-700/30 text-comb-700"
          }`}
        >
          Story view
        </button>
        <button
          onClick={() => setView("technical")}
          className={`border px-3 py-1.5 text-sm ${
            view === "technical"
              ? "border-comb-950 bg-comb-950 text-parchment"
              : "border-comb-700/30 text-comb-700"
          }`}
        >
          Technical evidence view
        </button>
      </div>

      <div className="ledger-panel mt-6 p-4">
        {view === "story" ? (
          <p className="text-sm text-comb-700">
            {/* TODO: scan a QR label -> look up its lot's claims and
                render a plain-language story here instead of this
                placeholder. */}
            Scan a jar&apos;s QR code to see where this honey came from, in
            plain language.
          </p>
        ) : (
          <p className="font-mono text-xs text-comb-700">
            {/* TODO: render the underlying claim/evidence rows for the
                scanned lot, same data as the buyer view but read-only. */}
            No lot scanned yet — technical evidence will appear here.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
