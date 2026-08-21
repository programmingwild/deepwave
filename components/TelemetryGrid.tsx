"use client";

import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { PARAMS, PARAM_ORDER, type ParamId, type Status } from "@/lib/types";
import { valueStatus } from "@/lib/core/anomaly";
import { fmtTime } from "@/lib/core/utils";
import { Chip } from "@/components/ui";

export function Sparkline({ data, color, height = 28 }: { data: number[]; color: string; height?: number }) {
  const w = 120;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 2 - ((v - min) / span) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = pts.join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const gid = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const statusChip: Record<Status, "ok" | "warn" | "crit" | "cyan"> = {
  NORMAL: "ok",
  GOOD: "cyan",
  WARNING: "warn",
  CRITICAL: "crit",
  FAULT: "crit",
};

const statusColor: Record<Status, string> = {
  NORMAL: "var(--health)",
  GOOD: "var(--cyan)",
  WARNING: "var(--warn)",
  CRITICAL: "var(--crit)",
  FAULT: "var(--crit)",
};

export function TelemetryCard({ id }: { id: ParamId }) {
  const state = useTelemetry();
  const def = PARAMS[id];
  const value = state.snapshot.sample.values[id];
  const rate = state.snapshot.rate[id];
  const hist = state.snapshot.history[id];
  const status = valueStatus(value, def.range, def.target);
  const inRange = value >= def.range.min && value <= def.range.max;
  const color = inRange ? def.color : status === "CRITICAL" ? "var(--crit)" : "var(--warn)";
  const signedRate = rate >= 0 ? `+${rate.toFixed(def.decimals)}` : rate.toFixed(def.decimals);

  return (
    <div className="glass-panel group relative overflow-hidden p-3 transition-colors hover:border-[var(--line-strong)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="mono text-[9px] tracking-[0.2em] text-[var(--txt-dim)]">{def.label}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="mono text-[22px] font-bold leading-none" style={{ color }}>
              {value.toFixed(def.decimals)}
            </span>
            <span className="mono text-[10px] text-[var(--txt-dim)]">{def.unit}</span>
          </div>
        </div>
        <Chip tone={statusChip[status]}>{status}</Chip>
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="space-y-1">
          <div className="section-label">REF RANGE</div>
          <div className="mono text-[11px] text-slate-300">{def.refLabel}</div>
          <div className="section-label">Δ RATE</div>
          <div
            className={`mono text-[11px] ${Math.abs(rate) > 0.02 ? "text-amber-300" : "text-slate-300"}`}
          >
            Δ {signedRate} /min
          </div>
        </div>
        <div className="w-[52%]">
          <Sparkline data={hist} color={color} />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-1">
        <span className="section-label">SENSOR SAMPLE</span>
        <span className="mono text-[10px] text-[var(--txt-dim)]">{fmtTime(state.snapshot.sample.t)}</span>
      </div>
    </div>
  );
}

export function TelemetryGrid() {
  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
      {PARAM_ORDER.map((id) => (
        <TelemetryCard key={id} id={id} />
      ))}
    </div>
  );
}