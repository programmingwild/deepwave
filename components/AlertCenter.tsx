"use client";

import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { engine } from "@/lib/core/engine";
import { Panel, Chip } from "@/components/ui";
import { fmtClock, fmtTime } from "@/lib/core/utils";

const LEVEL_ICON: Record<string, string> = {
  INFO: "ℹ",
  WARNING: "⚠",
  CRITICAL: "🔴",
};

export function AlertCenter() {
  const state = useTelemetry();
  const unread = state.alerts.filter((a) => !a.read).length;

  return (
    <Panel
      title="ALERT CENTER"
      right={
        <div className="flex items-center gap-2">
          <span className="mono text-[9px] tracking-widest text-slate-500">
            {unread > 0 ? `${unread} UNREAD` : "ALL CLEAR"}
          </span>
          <button
            onClick={() => engine.acknowledgeAllAlerts()}
            className="border border-[var(--line)] px-2 py-0.5 font-mono text-[9px] tracking-widest text-slate-400 transition-colors hover:text-[var(--cyan)]"
          >
            ACK ALL
          </button>
        </div>
      }
      className="h-full"
    >
      <div className="max-h-[360px] overflow-y-auto">
        {state.alerts.length === 0 && (
          <div className="p-4 text-center font-mono text-[11px] text-slate-600">
            NO ALERTS — SYSTEM MONITORING
          </div>
        )}
        {state.alerts.map((a) => {
          const color = a.level === "CRITICAL" ? "var(--crit)" : a.level === "WARNING" ? "var(--warn)" : "var(--health)";
          return (
            <div
              key={a.id}
              className={`relative border-b border-[var(--line)]/50 px-3 py-2.5 ${a.read ? "opacity-50" : ""}`}
            >
              {!a.read && (
                <span className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
              )}
              <div className="flex items-center gap-2">
                <span className="text-[13px]">{LEVEL_ICON[a.level]}</span>
                <span className="mono text-[10px] font-bold tracking-widest" style={{ color }}>
                  {a.level}
                </span>
                <span className="mono text-[11px] font-semibold text-slate-200">{a.title}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-500">{fmtClock(a.ts)}</span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] sm:grid-cols-3">
                {a.param && (
                  <div>
                    <span className="section-label">PARAM </span>
                    <span className="mono text-slate-300">{a.param.toUpperCase()}</span>
                  </div>
                )}
                {a.value !== undefined && (
                  <div>
                    <span className="section-label">VALUE </span>
                    <span className="mono" style={{ color }}>{a.value.toFixed(2)}</span>
                  </div>
                )}
                {a.expectedRange && (
                  <div>
                    <span className="section-label">EXPECTED </span>
                    <span className="mono text-slate-300">{a.expectedRange}</span>
                  </div>
                )}
              </div>
              {a.assessment && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="section-label">AI ASSESSMENT</span>
                  <span className="text-slate-400">{a.assessment}</span>
                </div>
              )}
              {a.action && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="section-label">ACTION TAKEN</span>
                  <span className="mono text-[10px] text-[var(--cyan)]">{a.action}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}