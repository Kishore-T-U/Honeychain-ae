import Link from "next/link";

const roles = [
  {
    id: "beekeeper",
    label: "Beekeeper",
    detail:
      "Hive sensor readings, confidence-gated disease-risk alerts, harvest logging.",
  },
  {
    id: "fpo_collector",
    label: "FPO / Collector",
    detail: "Measured-mass intake, blend genealogy, evidence-backed sourcing.",
  },
  {
    id: "buyer_processor",
    label: "Buyer / Processor",
    detail:
      "Eligible / ineligible state per lot, with the missing evidence named explicitly.",
  },
  {
    id: "government",
    label: "Government",
    detail: "Ecosystem-level view, complementing existing traceability portals.",
  },
  {
    id: "consumer",
    label: "Consumer",
    detail: "HoneyPass: a simple story view, and an optional technical evidence view.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 sm:py-24">
      <p className="font-mono text-xs tracking-wide text-comb-700/70">
        HoneyChain-AE — prototype interface
      </p>

      <h1 className="mt-4 max-w-xl font-display text-4xl italic leading-tight text-comb-950 sm:text-5xl">
        Claims should never outrun the evidence behind them.
      </h1>

      <p className="mt-6 max-w-lg text-comb-800">
        Selective sensor evidence, physical harvest binding, and
        transformation-aware assurance — so a downstream honey claim is only
        ever as strong as what was actually measured.
      </p>

      <div className="mt-10 flex gap-3">
        <Link
          href="/login"
          className="border border-comb-950 bg-comb-950 px-5 py-2.5 text-sm font-medium text-parchment transition-colors hover:bg-comb-800"
        >
          Sign in
        </Link>
        <Link
          href="/login?mode=signup"
          className="border border-comb-950 px-5 py-2.5 text-sm font-medium text-comb-950 transition-colors hover:bg-comb-950/5"
        >
          Create an account
        </Link>
      </div>

      <section className="mt-20">
        <h2 className="font-mono text-xs uppercase tracking-wide text-comb-700/70">
          Five views into the same ledger
        </h2>
        <div className="ledger-panel mt-4 divide-y divide-comb-700/15">
          {roles.map((role) => (
            <div key={role.id} className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="w-40 shrink-0 font-medium text-comb-950">
                {role.label}
              </span>
              <span className="text-sm text-comb-700">{role.detail}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
