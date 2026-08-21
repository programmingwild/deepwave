"use client";

import type { ReactNode } from "react";

export function Panel({
  title,
  right,
  children,
  className = "",
  accent = true,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <section
      className={`glass-panel panel-corners ${accent ? "panel-accent" : ""} ${className}`}
    >
      {(title || right) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[var(--line)] px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rotate-45 bg-[var(--cyan)]/70 shadow-glow" />
            {title && <div className="panel-title">{title}</div>}
          </div>
          {right && <div className="flex min-w-0 flex-wrap items-center gap-2">{right}</div>}
        </header>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}

export function Dot({ color, pulse = true }: { color: string; pulse?: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? "animate-pulseSoft" : ""}`}
      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
    />
  );
}

export function Seg({ options, value, onChange, className = "" }: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-1 rounded border border-[var(--line)] bg-black/30 p-0.5 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2 py-1 text-[10px] font-medium tracking-wider transition-colors ${
            value === o.value
              ? "bg-[var(--cyan)]/15 text-[var(--cyan)] shadow-[inset_0_0_0_1px_rgba(34,211,238,0.4)]"
              : "text-[var(--txt-dim)] hover:text-slate-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Bar({
  value,
  max = 100,
  color = "var(--cyan)",
  className = "",
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-black/50 ${className}`}>
      <div
        className="h-full transition-all duration-300"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }}
      />
    </div>
  );
}

export function Chip({ children, tone = "default" }: { children: ReactNode; tone?: "ok" | "warn" | "crit" | "default" | "cyan" }) {
  const tones: Record<string, string> = {
    ok: "border-emerald-400/30 text-emerald-300 bg-emerald-400/5",
    warn: "border-amber-400/30 text-amber-300 bg-amber-400/5",
    crit: "border-red-400/40 text-red-300 bg-red-400/5",
    cyan: "border-cyan-400/30 text-cyan-300 bg-cyan-400/5",
    default: "border-slate-500/30 text-slate-400 bg-slate-500/5",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function FieldRow({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[3px]">
      <span className="section-label">{label}</span>
      <span className="mono text-[12px]" style={{ color: accent ?? "var(--txt)" }}>
        {value}
      </span>
    </div>
  );
}

export function StatusLed({ status }: { status: string }) {
  const map: Record<string, { c: string; label: string }> = {
    NORMAL: { c: "var(--health)", label: "NORMAL" },
    GOOD: { c: "var(--cyan)", label: "GOOD" },
    WARNING: { c: "var(--warn)", label: "WARNING" },
    CRITICAL: { c: "var(--crit)", label: "CRITICAL" },
    FAULT: { c: "var(--crit)", label: "FAULT" },
    ONLINE: { c: "var(--health)", label: "ONLINE" },
    OFFLINE: { c: "var(--crit)", label: "OFFLINE" },
    ACTIVE: { c: "var(--cyan)", label: "ACTIVE" },
    INACTIVE: { c: "var(--txt-dim)", label: "INACTIVE" },
    RUNNING: { c: "var(--health)", label: "RUNNING" },
    MONITORING: { c: "var(--cyan)", label: "MONITORING" },
    CONNECTED: { c: "var(--health)", label: "CONNECTED" },
    WARMUP: { c: "var(--warn)", label: "WARMUP" },
  };
  const m = map[status] ?? { c: "var(--txt-dim)", label: status };
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot color={m.c} />
      <span className="mono text-[10px] tracking-wider" style={{ color: m.c }}>
        {m.label}
      </span>
    </span>
  );
}