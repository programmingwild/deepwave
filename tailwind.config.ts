import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        abyss: {
          950: "#030812",
          900: "#060d1c",
          850: "#081226",
          800: "#0a1630",
          700: "#0e1f42",
          600: "#14295a",
        },
        cyanline: "#22d3ee",
        electra: "#38bdf8",
        health: "#34d399",
        warn: "#fbbf24",
        crit: "#f87171",
        dim: "#64748b",
      },
      fontFamily: {
        mono: [
          "'JetBrains Mono'",
          "'IBM Plex Mono'",
          "'Cascadia Code'",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
        sans: [
          "'Inter'",
          "'Segoe UI'",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 18px rgba(34, 211, 238, 0.18)",
        "glow-amber": "0 0 18px rgba(251, 191, 36, 0.16)",
        "glow-red": "0 0 18px rgba(248, 113, 113, 0.18)",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "48%": { opacity: "0.92" },
          "52%": { opacity: "0.7" },
        },
        scan: {
          "0%": { top: "0%" },
          "100%": { top: "100%" },
        },
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        drift: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        pulseSoft: "pulseSoft 1.6s ease-in-out infinite",
        flicker: "flicker 4s linear infinite",
        blink: "blink 1.2s step-start infinite",
        drift: "drift 40s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
