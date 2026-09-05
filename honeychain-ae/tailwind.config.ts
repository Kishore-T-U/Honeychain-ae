import type { Config } from "tailwindcss";

// Design tokens for HoneyChain-AE.
// Palette is built around the evidence-ledger metaphor, not a generic SaaS
// look: charcoal comb-black, a restrained honey amber (kept well away from
// #D97757), a sage "verified" green, and a muted rust reserved for
// unresolved/rejected claims only.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        comb: {
          950: "#17140F",
          900: "#211C14",
          800: "#332B1E",
          700: "#4A3F2B",
        },
        parchment: "#F1ECDD",
        amber: {
          600: "#B9852B",
          500: "#C98A2B",
          400: "#D9A650",
        },
        sage: {
          600: "#4C5A3F",
          500: "#5C6E4F",
        },
        rust: {
          600: "#8C4A3A",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        none: "0px",
        sm: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
