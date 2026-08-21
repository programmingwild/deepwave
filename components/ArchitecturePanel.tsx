"use client";

import { useState } from "react";
import { Panel } from "@/components/ui";

const LAYERS: { name: string; components: string[]; highlight?: boolean }[] = [
  { name: "UNDERWATER ROVER", components: ["DW-01 chassis", "4x T200 thrusters", "Pressure hull", "Camera dome", "Buoyancy modules"] },
  { name: "SENSOR LAYER", components: ["pH probe (GP)", "Turbidity sensor (NTU)", "TDS meter", "DS18B20 temperature", "EC sensor", "DO optical sensor", "Salinity (derived)"] },
  { name: "DATA ACQUISITION", components: ["Analog front-end", "ADC 16-bit", "I2C/UART multiplexer", "Timestamp + sequence", "Calibration tables"] },
  { name: "RASPBERRY PI", components: ["Raspberry Pi 4 Model B", "ARM Cortex-A72 4 cores", "4 GB RAM", "Python 3.11 runtime", "NumPy / Pandas pipeline"] },
  { name: "EDGE PROCESSING", components: ["Noise filtering (median)", "Outlier rejection", "Normalization", "Unit conversion", "Rolling baseline stats"] },
  { name: "AI ANOMALY DETECTION", components: ["Threshold envelope model", "Rate-of-change detector", "Multi-parameter fusion", "Scikit-learn pipeline", "Explainable rules"] },
  { name: "DECISION ENGINE", components: ["State machine (4 levels)", "Adaptive sampling control", "Camera trigger policy", "Alert policy", "Event logging"] },
  { name: "COMMUNICATION", components: ["LoRa uplink (900 MHz)", "WebSocket JSON bridge", "MQTT topics", "Offline buffer", "Reconnect logic"] },
  { name: "DASHBOARD", components: ["Next.js 14 + TypeScript", "Realtime store (bus)", "Recharts visualization", "Alert center", "Mission reports"] },
];

export function ArchitecturePanel() {
  const [open, setOpen] = useState<string | null>("EDGE PROCESSING");
  const [expanded, setExpanded] = useState(false);

  return (
    <Panel
      title="SYSTEM ARCHITECTURE"
      right={
        <button
          onClick={() => setExpanded(!expanded)}
          className="border border-[var(--line)] px-2 py-0.5 font-mono text-[9px] tracking-widest text-slate-400 transition-colors hover:text-[var(--cyan)]"
        >
          {expanded ? "COLLAPSE" : "EXPAND"}
        </button>
      }
      className="h-full"
    >
      <div className="overflow-x-auto p-3">
        <div className="flex min-w-[760px] flex-col items-center">
          {LAYERS.map((l, i) => (
            <div key={l.name} className="flex w-full flex-col items-center">
              <button
                onClick={() => setOpen(open === l.name ? null : l.name)}
                className={`clip-corners w-full max-w-[620px] border px-3 py-2 text-left transition-all ${
                  open === l.name
                    ? "border-cyan-400/50 bg-cyan-400/10 shadow-glow"
                    : "border-[var(--line)] bg-black/25 hover:border-[var(--line-strong)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="mono text-[11px] font-bold tracking-[0.18em]" style={{ color: open === l.name ? "var(--cyan)" : "var(--txt)" }}>
                    {l.name}
                  </span>
                  <span className="mono text-[10px] text-slate-500">{open === l.name ? "−" : "+"}</span>
                </div>
              </button>

              {open === l.name && (
                <div className="my-1 w-full max-w-[620px] border border-[var(--line)]/60 bg-black/30 p-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {l.components.map((c) => (
                      <span key={c} className="border border-[var(--line)] bg-[#0a1630]/80 px-2 py-0.5 font-mono text-[9px] text-slate-400">
                        {c}
                      </span>
                    ))}
                  </div>
                  {l.name === "AI ANOMALY DETECTION" && (
                    <div className="mt-2 text-[10px] text-slate-500">
                      Model scope: deviation detection only. Pollutant identification and source attribution are NOT implemented.
                    </div>
                  )}
                </div>
              )}

              {i < LAYERS.length - 1 && (
                <div className="flex flex-col items-center py-1">
                  <svg width="14" height="18">
                    <line x1="7" y1="0" x2="7" y2="14" stroke="rgba(34,211,238,0.5)" strokeWidth="1.2" className="flow-line" />
                    <polygon points="3,12 7,17 11,12" fill="rgba(34,211,238,0.6)" />
                  </svg>
                  <span className="mono text-[8px] tracking-widest text-slate-600">
                    {i === 0 ? "HOUSING" : i === 1 ? "I2C/UART" : i === 2 ? "USB" : i === 3 ? "PYTHON" : i === 4 ? "NUMBA/SKLEARN" : i === 5 ? "RULES" : i === 6 ? "JSON" : "WSS"}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-2">
          <span className="section-label">DATA FLOW</span>
          <span className="mono text-[10px] text-slate-500">
            SENSOR → PI → EDGE → MODEL → DECISION → WIRELESS → DASHBOARD
          </span>
        </div>
      </div>
    </Panel>
  );
}