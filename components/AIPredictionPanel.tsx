"use client";

import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { Panel, Chip, Bar } from "@/components/ui";
import { PARAMS, PARAM_ORDER } from "@/lib/types";

export function AIPredictionPanel() {
  const state = useTelemetry();
  const forecast = state.forecast;
  const ai = state.ai;

  // overall risk: blend anomaly probability with forecast watch
  const riskPct = Math.round(
    Math.min(100, ai.anomalyProbability * 0.6 + (forecast.watch ? 40 : 0) + (forecast.confidence < 60 ? 15 : 0))
  );
  const riskLevel =
    riskPct >= 70 ? "CRITICAL" : riskPct >= 45 ? "HIGH" : riskPct >= 20 ? "MODERATE" : "LOW";
  const riskColor =
    riskPct >= 70 ? "var(--crit)" : riskPct >= 45 ? "var(--warn)" : riskPct >= 20 ? "var(--cyan)" : "var(--health)";

  // parameters trending toward breach (rate of change significant)
  const trending = PARAM_ORDER.filter((id) => {
    const r = state.snapshot.rate[id];
    const v = state.snapshot.sample.values[id];
    const def = PARAMS[id];
    const distToMax = def.range.max - v;
    const distToMin = v - def.range.min;
    const margin = Math.min(distToMax, distToMin);
    // trending toward a boundary
    return Math.abs(r) > 0.01 && margin < (def.range.max - def.range.min) * 0.25;
  });

  // predicted breach time from forecast watch
  const breachMin = forecast.watchTMin;

  return (
    <Panel
      title="AI POLLUTION PREDICTION"
      right={
        <Chip tone={riskPct >= 70 ? "crit" : riskPct >= 45 ? "warn" : riskPct >= 20 ? "cyan" : "ok"}>
          {riskLevel} RISK
        </Chip>
      }
      className="h-full"
    >
      <div className="space-y-3 p-4">
        {/* risk gauge */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="section-label">POLLUTION RISK (NEXT 30 MIN)</span>
            <span className="mono text-[12px] font-bold" style={{ color: riskColor }}>
              {riskPct}%
            </span>
          </div>
          <Bar value={riskPct} max={100} color={riskColor} />
        </div>

        {/* prediction summary */}
        <div className="rounded border border-[var(--line)] bg-black/30 p-3">
          <div className="mb-1 section-label">MODEL ASSESSMENT</div>
          <div className="text-[11px] leading-relaxed text-slate-300">
            {ai.assessment}
          </div>
        </div>

        {/* forecast watch */}
        {forecast.watch && (
          <div className="rounded border border-amber-400/40 bg-amber-400/10 p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-amber-400" />
              <span className="mono text-[10px] font-bold tracking-widest text-amber-300">
                ⏱ PRE-EMPTIVE WATCH
              </span>
            </div>
            <div className="text-[11px] text-amber-200">{forecast.watchMessage}</div>
            {breachMin !== null && (
              <div className="mt-1 mono text-[10px] text-amber-300/80">
                Estimated breach in ~{breachMin.toFixed(1)} min · Model confidence {Math.round(forecast.confidence)}%
              </div>
            )}
          </div>
        )}

        {/* trending params */}
        <div>
          <div className="mb-1.5 section-label">PARAMETERS TRENDING TOWARD BREACH</div>
          {trending.length === 0 ? (
            <div className="text-[10px] text-slate-500">All parameters within safe margins.</div>
          ) : (
            <div className="space-y-1">
              {trending.map((id) => {
                const def = PARAMS[id];
                const v = state.snapshot.sample.values[id];
                const r = state.snapshot.rate[id];
                const inRange = v >= def.range.min && v <= def.range.max;
                return (
                  <div key={id} className="flex items-center justify-between rounded border border-[var(--line)] bg-black/20 px-2 py-1">
                    <span className="mono text-[10px] text-slate-300">{def.label}</span>
                    <span className="mono text-[10px]" style={{ color: inRange ? "var(--txt)" : "var(--crit)" }}>
                      {v.toFixed(def.decimals)} {def.unit}
                    </span>
                    <span className="mono text-[9px]" style={{ color: r > 0 ? "var(--warn)" : "var(--cyan)" }}>
                      {r > 0 ? "↑" : "↓"} {Math.abs(r).toFixed(2)}/min
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI state */}
        <div className="flex items-center justify-between border-t border-[var(--line)] pt-2">
          <span className="section-label">AI STATE</span>
          <Chip tone={ai.state === "ALERT" ? "crit" : ai.state === "RISK" ? "warn" : ai.state === "ANOMALY" ? "cyan" : "ok"}>
            {ai.state}
          </Chip>
        </div>
        <div className="flex items-center justify-between">
          <span className="section-label">ANOMALY PROBABILITY</span>
          <span className="mono text-[11px]" style={{ color: riskColor }}>{Math.round(ai.anomalyProbability)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="section-label">MODEL CONFIDENCE</span>
          <span className="mono text-[11px] text-slate-300">{Math.round(forecast.confidence)}%</span>
        </div>

        <p className="text-[9px] leading-relaxed text-slate-500">
          The AI model continuously analyzes sensor trends, rates of change, and anomaly patterns to predict pollution events before they breach safety thresholds. Pre-emptive watch activates when a parameter is projected to exceed its operating range within the forecast horizon.
        </p>
      </div>
    </Panel>
  );
}
