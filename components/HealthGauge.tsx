"use client";

import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { computeHealthScore, healthLabel } from "@/lib/core/score";
import { Chip } from "@/components/ui";

const R = 88;
const CIRC = 2 * Math.PI * R;

export function HealthGauge() {
  const state = useTelemetry();
  const score = computeHealthScore(state.snapshot.sample);
  const label = healthLabel(score);
  const color =
    label === "HEALTHY"
      ? "var(--health)"
      : label === "WATCH"
        ? "var(--warn)"
        : label === "DEGRADED"
          ? "#fb923c"
          : "var(--crit)";

  const offset = CIRC * (1 - score / 100);

  return (
    <div className="relative flex flex-col items-center px-4 pb-4 pt-2">
      <div className="mono text-[9px] tracking-[0.3em] text-[var(--txt-dim)]">
        PROTOTYPE ENVIRONMENTAL HEALTH SCORE
      </div>

      <div className="relative mt-2 h-[240px] w-[240px]">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="10" />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke="rgba(34,211,238,0.12)"
            strokeWidth="10"
            strokeDasharray="2 6"
          />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{
              filter: `drop-shadow(0 0 6px ${color})`,
              transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.8s",
            }}
          />
          {/* tick marks */}
          {Array.from({ length: 40 }).map((_, i) => {
            const a = (i / 40) * Math.PI * 2;
            const x1 = 100 + Math.cos(a) * (R + 10);
            const y1 = 100 + Math.sin(a) * (R + 10);
            const x2 = 100 + Math.cos(a) * (R + (i % 10 === 0 ? 15 : 12.5));
            const y2 = 100 + Math.sin(a) * (R + (i % 10 === 0 ? 15 : 12.5));
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(125,211,252,0.25)" strokeWidth="1" />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="mono text-[40px] font-bold leading-none text-glow" style={{ color }}>
            {score}
          </div>
          <div className="mono text-[11px] tracking-[0.3em] text-[var(--txt-dim)]">/ 100</div>
          <div className="mono mt-2 border px-2 py-0.5 text-[11px] font-bold tracking-[0.2em]" style={{ color, borderColor: `${color}55` }}>
            {label}
          </div>
        </div>
      </div>

      <div className="mt-1 max-w-[280px] text-center text-[12px] leading-relaxed text-slate-400">
        Environmental conditions within expected operating range
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Chip tone="cyan">SCORE METHOD: WEIGHTED DEVIATION COMPOSITE</Chip>
        <Chip>NOT A REGULATORY INDEX</Chip>
      </div>
    </div>
  );
}