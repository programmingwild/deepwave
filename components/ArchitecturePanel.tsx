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
  const flow = ["SENSOR", "PI", "EDGE", "MODEL", "DECISION", "WIRELESS", "DASH"];
  const links = ["HOUSING", "I2C / UART", "USB", "PYTHON", "NUMBA / SKLEARN", "RULES", "JSON", "WSS"];

  return (
    <Panel
      title="SYSTEM ARCHITECTURE"
      right={
        <button
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="border border-[var(--line)] px-2 py-1 font-mono text-[9px] tracking-widest text-slate-400 transition-colors hover:border-[var(--line-strong)] hover:text-[var(--cyan)]"
        >
          {expanded ? "COLLAPSE" : "EXPAND"}
        </button>
      }
      className="h-full"
    >
      <div className="space-y-4 p-3 sm:p-4">
        <div className="border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="section-label text-cyan-300">DATA FLOW</span>
            <span className="mono text-[9px] tracking-widest text-slate-600">LIVE PIPELINE</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {flow.map((step, index) => (
              <div key={step} className="flex shrink-0 items-center gap-1">
                <span className="border border-cyan-400/30 bg-[#071a30] px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-widest text-cyan-200">
                  {step}
                </span>
                {index < flow.length - 1 && <span className="px-0.5 font-mono text-xs text-cyan-400/60">→</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {LAYERS.map((layer, index) => {
            const active = open === layer.name;
            const showDetails = expanded || active;
            return (
              <div key={layer.name} className={`relative border p-3 transition-colors ${active ? "border-cyan-400/50 bg-cyan-400/[0.07]" : "border-[var(--line)] bg-black/20 hover:border-[var(--line-strong)]"}`}>
                <button onClick={() => setOpen(active ? null : layer.name)} aria-expanded={showDetails} className="flex w-full items-start gap-3 text-left">
                  <span className={`mono flex h-6 w-6 shrink-0 items-center justify-center border text-[10px] ${active ? "border-cyan-300/60 text-cyan-200" : "border-[var(--line)] text-slate-500"}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`mono block text-[11px] font-bold tracking-[0.12em] ${active ? "text-cyan-200" : "text-[var(--txt)]"}`}>{layer.name}</span>
                    {index < links.length && <span className="mt-1 block font-mono text-[9px] tracking-widest text-slate-600">↓ {links[index]}</span>}
                  </span>
                  <span className="mono text-[11px] text-slate-500">{showDetails ? "−" : "+"}</span>
                </button>

                {showDetails && (
                  <div className="mt-3 border-t border-[var(--line)] pt-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {layer.components.map((component) => (
                        <span key={component} className="border border-[var(--line)] bg-[#0a1630]/80 px-2 py-1 font-mono text-[9px] text-slate-400">{component}</span>
                      ))}
                    </div>
                    {layer.name === "AI ANOMALY DETECTION" && <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Model scope: deviation detection only. Pollutant identification and source attribution are not implemented.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          <span className="section-label">TRANSPORT LINKS</span>
          <span className="mono text-[9px] tracking-widest text-slate-500">HOUSING · I2C / UART · USB · PYTHON · NUMBA / SKLEARN · RULES · JSON · WSS</span>
        </div>
      </div>
    </Panel>
  );
}