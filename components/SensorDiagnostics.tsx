"use client";

import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { PARAMS, PARAM_ORDER, type SensorHealthEntry } from "@/lib/types";
import { Panel, Dot, Bar } from "@/components/ui";
import { engine } from "@/lib/core/engine";

export function SensorDiagnostics() {
  const state = useTelemetry();
  const faulted = PARAM_ORDER.filter((id) => state.sensors[id].fault);

  return (
    <Panel
      title="SENSOR DIAGNOSTICS"
      right={
        <div className="flex items-center gap-2">
          {faulted.length > 0 ? (
            <span className="mono text-[9px] tracking-widest text-red-400">
              ⚠ {faulted.length} SENSOR FAULT
            </span>
          ) : (
            <span className="mono text-[9px] tracking-widest text-slate-500">7 CHANNELS</span>
          )}
          <button
            onClick={() => engine.simulateSensorFault(PARAM_ORDER[Math.floor(Math.random() * PARAM_ORDER.length)])}
            className="border border-[var(--line)] px-2 py-0.5 font-mono text-[9px] tracking-widest text-slate-400 transition-colors hover:border-amber-400/40 hover:text-amber-300"
          >
            SIM FAULT
          </button>
        </div>
      }
      className="h-full"
    >
      <div className="divide-y divide-[var(--line)]/60">
        {PARAM_ORDER.map((id) => (
          <SensorRow key={id} s={state.sensors[id]} value={state.snapshot.sample.values[id]} />
        ))}
      </div>
    </Panel>
  );
}

function SensorRow({ s, value }: { s: SensorHealthEntry; value: number }) {
  const def = PARAMS[s.param];
  const inRange = value >= def.range.min && value <= def.range.max;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 sm:gap-3 ${s.fault ? "bg-red-500/5" : ""}`}>
      <div className="w-24 shrink-0 sm:w-32">
        <div className="mono text-[11px] font-semibold text-slate-200">{def.label}</div>
        <div className="mono text-[10px] text-slate-500">S-{s.param.toUpperCase()}</div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Dot color={s.fault ? "var(--crit)" : "var(--health)"} />
        <span className={`mono text-[10px] tracking-wider ${s.fault ? "text-red-400" : "text-emerald-300"}`}>
          {s.fault ? "FAULT" : "ONLINE"}
        </span>
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span className="section-label">SIGNAL QUALITY</span>
          <span className={`mono text-[10px] ${s.signalQuality > 85 ? "text-[var(--health)]" : s.signalQuality > 60 ? "text-[var(--warn)]" : "text-[var(--crit)]"}`}>
            {Math.round(s.signalQuality)}%
          </span>
        </div>
        <Bar
          value={s.signalQuality}
          color={s.signalQuality > 85 ? "var(--health)" : s.signalQuality > 60 ? "var(--warn)" : "var(--crit)"}
        />
        <div className="flex flex-wrap items-center justify-between gap-x-2 text-[9px] text-slate-600">
          <span>CAL: {s.lastCalibration}</span>
          <span>RESP: {s.responseMs} ms</span>
          <span>AVAIL: {s.availability.toFixed(1)}%</span>
        </div>
      </div>

      <div className="w-14 shrink-0 text-right sm:w-16">
        <div className="mono text-[12px] font-bold" style={{ color: inRange ? "var(--txt)" : "var(--crit)" }}>
          {value.toFixed(def.decimals)}
        </div>
        <div className="mono text-[9px] text-slate-500">{def.unit}</div>
      </div>
    </div>
  );
}