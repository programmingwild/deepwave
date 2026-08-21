"use client";

import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { Panel, StatusLed, Chip } from "@/components/ui";

const RULES = [
  {
    cond: "NORMAL CONDITION",
    action: "Standard sampling",
    level: "NORMAL",
    freq: "1.0 Hz",
    color: "var(--health)",
  },
  {
    cond: "MINOR ANOMALY",
    action: "Increase sampling frequency",
    level: "WARNING",
    freq: "1.5 Hz",
    color: "var(--warn)",
  },
  {
    cond: "SIGNIFICANT ANOMALY",
    action: "Increase sampling + camera recording",
    level: "WARNING",
    freq: "1.5-2.0 Hz",
    color: "var(--warn)",
  },
  {
    cond: "CRITICAL CONDITION",
    action: "Alert operator + record event + mark location",
    level: "CRITICAL",
    freq: "2.0 Hz",
    color: "var(--crit)",
  },
];

export function DecisionEngine() {
  const state = useTelemetry();
  const ai = state.ai;

  const activeRow =
    ai.state === "ALERT" ? 3 : ai.state === "ANOMALY" ? 2 : ai.state === "PARAMETER_CHANGE" ? 1 : 0;

  return (
    <Panel title="AUTONOMOUS RESPONSE — DECISION ENGINE" className="h-full">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between rounded border border-[var(--line)] bg-black/25 px-3 py-2">
          <span className="section-label">CURRENT MODE</span>
          <span className="mono text-[13px] font-bold tracking-widest text-[var(--cyan)]">
            ADAPTIVE MONITORING
          </span>
        </div>

        <div className="space-y-1.5">
          {RULES.map((r, i) => {
            const active = i === activeRow;
            const triggered = i < activeRow;
            return (
              <div
                key={r.cond}
                className={`flex items-center gap-3 border px-3 py-2 transition-all duration-300 ${
                  active
                    ? "border-cyan-400/50 bg-cyan-400/10 shadow-glow"
                    : triggered
                      ? "border-[var(--line)] bg-black/30 opacity-80"
                      : "border-[var(--line)] bg-black/20 opacity-50"
                }`}
              >
                <div className="w-3 text-center">
                  {active ? "►" : triggered ? "✓" : "·"}
                </div>
                <div className="flex-1">
                  <div className="mono text-[11px] font-semibold" style={{ color: active ? "var(--cyan)" : "var(--txt)" }}>
                    {r.cond}
                  </div>
                  <div className="text-[11px] text-slate-400">{r.action}</div>
                </div>
                <Chip tone={active ? "cyan" : triggered ? "ok" : "default"}>
                  {r.freq}
                </Chip>
                <StatusLed status={active ? r.level : triggered ? "ACTIVE" : "NORMAL"} />
              </div>
            );
          })}
        </div>

        <div className="mt-3 border-t border-[var(--line)] pt-2">
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>DECISION POLICY: RULE-BASED + AI RISK SCORE</span>
            <span className="mono text-[var(--cyan)]">SAMPLING: {state.mission.samplingFreqHz.toFixed(1)} Hz</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}