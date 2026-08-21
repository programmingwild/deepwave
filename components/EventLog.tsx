"use client";

import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { Panel, Chip } from "@/components/ui";
import { fmtClock } from "@/lib/core/utils";

export function EventLog() {
  const state = useTelemetry();
  const events = [...state.events].reverse();

  return (
    <Panel
      title="ENVIRONMENTAL EVENT LOG"
      right={<span className="mono text-[9px] tracking-widest text-slate-500">{events.length} EVENTS</span>}
      className="h-full"
    >
      <div className="max-h-[420px] overflow-y-auto p-2">
        {events.length === 0 && (
          <div className="p-4 text-center font-mono text-[11px] text-slate-600">
            NO EVENTS RECORDED
          </div>
        )}
        {events.map((e, i) => {
          const color =
            e.level === "CRITICAL" ? "var(--crit)" : e.level === "WARNING" ? "var(--warn)" : "var(--health)";
          return (
            <div key={e.id} className="relative flex gap-3 border-b border-[var(--line)]/50 px-2 py-2 last:border-b-0">
              {i < events.length - 1 && (
                <span
                  className="absolute left-[13px] top-7 bottom-0 w-px"
                  style={{ background: "rgba(100,116,139,0.2)" }}
                />
              )}
              <div className="relative mt-0.5 flex h-3 w-3 items-center justify-center">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                />
                {i === 0 && e.level !== "INFO" && (
                  <span className="sonar-ping absolute h-2 w-2 rounded-full" style={{ border: `1px solid ${color}` }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="mono text-[11px] font-semibold" style={{ color }}>
                    {e.title}
                  </span>
                  <span className="mono shrink-0 text-[10px] text-[var(--txt-dim)]">
                    {fmtClock(e.ts)}
                  </span>
                </div>
                {e.detail && (
                  <div className="mt-0.5 text-[11px] text-slate-400">{e.detail}</div>
                )}
                {e.action && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="section-label">ACTION</span>
                    <span className="mono text-[10px] text-slate-500">{e.action}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}