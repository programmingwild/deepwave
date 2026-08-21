"use client";

import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { PARAMS } from "@/lib/types";
import { Panel, Chip, StatusLed, Bar } from "@/components/ui";

const STAGES = ["NORMAL", "PARAMETER CHANGE", "ANOMALY DETECTED", "RISK ASSESSMENT", "ALERT"] as const;

const stageIndex: Record<string, number> = {
  NORMAL: 0,
  PARAMETER_CHANGE: 1,
  ANOMALY: 2,
  RISK: 3,
  ALERT: 4,
};

export function WarningEngine() {
  const state = useTelemetry();
  const ai = state.ai;
  const current = stageIndex[ai.state] ?? 0;
  const multi = ai.anomalies.length >= 2;

  const probColor =
    ai.anomalyProbability < 20 ? "var(--health)" : ai.anomalyProbability < 50 ? "var(--warn)" : "var(--crit)";

  return (
    <Panel
      title="AI POLLUTION EARLY WARNING ENGINE"
      right={<StatusLed status={ai.isPollutionEvent ? "ACTIVE" : "MONITORING"} />}
      className="h-full"
    >
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded border border-[var(--line)] bg-black/25 p-3">
            <div className="section-label">AI STATUS</div>
            <div className="mono mt-1 text-[16px] font-bold tracking-widest text-[var(--cyan)]">
              {ai.isPollutionEvent ? "ESCALATED" : "MONITORING"}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">Edge model · {state.edge.modelStatus}</div>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/25 p-3">
            <div className="section-label">ANOMALY PROBABILITY</div>
            <div className="mono mt-1 text-[24px] font-bold leading-none" style={{ color: probColor }}>
              {ai.anomalyProbability}%
            </div>
            <Bar value={ai.anomalyProbability} color={probColor} className="mt-2" />
            <div className="mt-1 text-[10px] text-slate-500">rolling 60 s window</div>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/25 p-3">
            <div className="section-label">ENVIRONMENTAL STATE</div>
            <div className="mono mt-1 text-[16px] font-bold tracking-widest" style={{ color: ai.isPollutionEvent ? "var(--crit)" : "var(--health)" }}>
              {ai.state}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">{ai.anomalyCount} active anomaly signal{ai.anomalyCount === 1 ? "" : "s"}</div>
          </div>
        </div>

        {/* pipeline timeline */}
        <div className="mt-4">
          <div className="section-label mb-2">DETECTION PIPELINE</div>
          <div className="relative flex items-center">
            {STAGES.map((s, i) => (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`h-2.5 w-2.5 rotate-45 border transition-all duration-500 ${
                      i <= current
                        ? i === 4
                          ? "border-red-400 bg-red-400/60 shadow-glow-red"
                          : "border-[var(--cyan)] bg-[var(--cyan)]/70 shadow-glow"
                        : "border-slate-600 bg-transparent"
                    }`}
                  />
                  <span
                    className={`mono text-[8px] tracking-wider ${
                      i <= current ? "text-[var(--cyan)]" : "text-slate-600"
                    }`}
                  >
                    {s}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className="relative mx-1 mb-4 h-px flex-1 bg-slate-700">
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-500 ${i < current ? "bg-[var(--cyan)] shadow-glow" : "bg-transparent"}`}
                      style={{ width: i < current ? "100%" : "0%" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* pollution event callout */}
        {multi ? (
          <div className="mt-4 border border-red-400/40 bg-red-500/5 p-3 shadow-glow-red">
            <div className="flex items-center gap-2">
              <span className="text-[15px] text-red-400">⚠</span>
              <span className="mono text-[13px] font-bold tracking-widest text-red-300">
                POTENTIAL POLLUTION EVENT
              </span>
              <div className="ml-auto">
                <Chip tone="crit">CONFIDENCE {ai.confidence}%</Chip>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
              {ai.anomalies.map((a) => {
                const def = PARAMS[a.param];
                return (
                  <div key={a.param} className="rounded border border-[var(--line)] bg-black/30 px-2 py-1.5">
                    <div className="section-label">{def.label}</div>
                    <div className="mono text-[13px] font-semibold" style={{ color: a.level === "CRITICAL" ? "var(--crit)" : "var(--warn)" }}>
                      {a.direction === "up" ? "↑" : "↓"} {Math.abs(a.deviationPct)}%
                      <span className="ml-1 text-[9px] text-slate-500">{a.value.toFixed(def.decimals)} {def.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-red-400/20 pt-2">
              <span className="section-label text-red-300/70">AI ASSESSMENT</span>
              <span className="text-[12px] text-slate-300">{ai.assessment}</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500">
              Note: System flags deviation patterns only. Pollutant identification and source attribution are NOT implemented.
            </div>
            <div className="mt-1 text-[9px] text-slate-600">% = deviation from reference range midpoint</div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 border border-[var(--line)] bg-black/20 p-3">
            <span className="text-[15px] text-[var(--health)]">✓</span>
            <div>
              <div className="mono text-[12px] font-semibold text-emerald-300">NO ACTIVE ANOMALIES</div>
              <div className="text-[11px] text-slate-500">{ai.assessment}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="section-label">BASELINE MODEL</div>
              <div className="mono text-[10px] text-slate-400">THRESHOLD + RATE ENVELOPE</div>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-600">
          <span>MODEL: WATER ANOMALY DETECTOR v2.1</span>
          <span>NORMAL 0-20% · WATCH 20-50% · CRITICAL &gt;50%</span>
        </div>
      </div>
    </Panel>
  );
}