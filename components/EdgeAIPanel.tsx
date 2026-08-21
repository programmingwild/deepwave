"use client";

import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { Panel, StatusLed, Bar, Chip } from "@/components/ui";

const FLOW = ["SENSORS", "RASPBERRY PI", "PREPROCESSING", "ANOMALY MODEL", "DECISION ENGINE", "DASHBOARD"];

export function EdgeAIPanel() {
  const state = useTelemetry();
  const e = state.edge;
  const alertMode = state.ai.state === "ALERT";

  const cpuColor = e.cpu > 80 ? "var(--warn)" : "var(--cyan)";
  const tempColor = e.temp > 70 ? "var(--warn)" : e.temp > 82 ? "var(--crit)" : "var(--health)";

  return (
    <Panel title="EDGE AI — RASPBERRY PI" right={<Chip tone="cyan">LOCAL PROCESSING</Chip>} className="h-full">
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1 rounded border border-[var(--line)] bg-black/25 p-3">
            <div className="section-label">MODEL</div>
            <div className="mono mt-1 text-[11px] font-semibold leading-tight text-slate-200">
              Water Anomaly<br />Detector
            </div>
            <div className="mt-2">
              <StatusLed status={e.modelStatus} />
            </div>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <Metric label="CPU" value={`${Math.round(e.cpu)}%`} bar={e.cpu} color={cpuColor} />
            <Metric label="RAM" value={`${Math.round(e.ram)}%`} bar={e.ram} color="#a78bfa" />
            <Metric label="TEMP" value={`${e.temp.toFixed(1)}°C`} bar={e.temp / 1.1} color={tempColor} />
            <Metric label="INFERENCE" value={`${e.inferenceMs} ms`} bar={Math.min(100, e.inferenceMs / 2)} color="var(--cyan)" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded border border-[var(--line)] bg-black/25 p-3">
            <div className="section-label">DATA PROCESSED</div>
            <div className="mono mt-1 text-[20px] font-bold text-[var(--cyan)]">
              {state.mission.samplingFreqHz.toFixed(1)} Hz
            </div>
            <div className="mono text-[10px] text-slate-500">≈ {e.samplesPerMin} samples/min</div>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/25 p-3">
            <div className="section-label">PROCESSING LOCATION</div>
            <div className="mono mt-1 text-[13px] font-bold text-[var(--health)]">
              LOCAL EDGE DEVICE
            </div>
            <div className="mono text-[10px] text-slate-500">ARM Cortex-A72 · 4×1.8 GHz</div>
          </div>
        </div>

        {/* data flow */}
        <div className="mt-3">
          <div className="section-label mb-2">DATA FLOW — RAW SENSORS PROCESSED ON-BOARD</div>
          <div className="flex flex-wrap items-center gap-y-2">
            {FLOW.map((node, i) => (
              <div key={node} className="flex items-center">
                <div
                  className={`clip-corners border px-2 py-1.5 text-[9px] font-semibold tracking-wider ${
                    i === 2 || i === 3
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                      : "border-[var(--line)] bg-black/30 text-slate-300"
                  }`}
                >
                  {node}
                </div>
                {i < FLOW.length - 1 && (
                  <svg width="26" height="10" className="mx-0.5 shrink-0">
                    <line x1="0" y1="5" x2="24" y2="5" stroke="rgba(34,211,238,0.5)" strokeWidth="1.2" className="flow-line" />
                    <polygon points="20,2 26,5 20,8" fill="rgba(34,211,238,0.5)" />
                  </svg>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 border-t border-[var(--line)] pt-2">
            <span className={alertMode ? "text-amber-300" : "text-[var(--health)]"}>
              {alertMode ? "▲" : "●"}
            </span>
            <span className="text-[11px] text-slate-400">
              {alertMode
                ? "Edge inference load elevated — anomaly pipeline active"
                : "Raw sensor data is preprocessed locally before visualization. No raw telemetry leaves the rover."}
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Metric({ label, value, bar, color }: { label: string; value: string; bar: number; color: string }) {
  return (
    <div className="rounded border border-[var(--line)] bg-black/25 p-2.5">
      <div className="section-label">{label}</div>
      <div className="mono mt-1 text-[16px] font-bold" style={{ color }}>
        {value}
      </div>
      <Bar value={bar} color={color} className="mt-1.5" />
    </div>
  );
}