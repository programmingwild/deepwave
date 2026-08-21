"use client";

import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { PARAM_ORDER, PARAMS } from "@/lib/types";
import { Panel, Chip, Seg } from "@/components/ui";
import { fmtClock } from "@/lib/core/utils";

export function ReportPanel() {
  const state = useTelemetry();

  const exportCSV = () => {
    const len = state.snapshot.history.turbidity.length;
    const rows = [
      ["timestamp", ...PARAM_ORDER.map((p) => PARAMS[p].label)],
      ...Array.from({ length: len }, (_, i) => {
        const t = new Date(Date.now() - (len - i) * 5000).toISOString();
        return [t, ...PARAM_ORDER.map((p) => state.snapshot.history[p][i].toFixed(4))];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deepwave_telemetry_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = PARAM_ORDER.map((p) => {
      const d = PARAMS[p];
      return `<tr><td>${d.label}</td><td>${state.snapshot.sample.values[p].toFixed(d.decimals)} ${d.unit}</td><td>${d.refLabel}</td></tr>`;
    }).join("");
    const body = `<html><head><title>DEEPWAVE Telemetry Export</title><style>
      body{background:#fff;color:#111;font-family:monospace;padding:32px}
      h1{font-size:16px;letter-spacing:2px} table{border-collapse:collapse;width:100%;margin-top:16px}
      th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:12px} th{background:#eee}
    </style></head><body>
      <h1>DEEPWAVE — WATER QUALITY TELEMETRY</h1>
      <p>Generated ${new Date().toISOString()} · SIMULATED DATA FOR DEMONSTRATION</p>
      <table><tr><th>Parameter</th><th>Value</th><th>Reference Range</th></tr>${rows}</table>
      <p style="margin-top:24px;font-size:10px;color:#666">Prototype Environmental Health Score: ${state.ai.anomalyProbability}% anomaly probability. Not a validated regulatory index.</p>
    </body></html>`;
    win.document.write(body);
    win.document.close();
    win.print();
  };

  const generateReport = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const body = `DEEPWAVE UNDERWATER ENVIRONMENTAL INTELLIGENCE
MISSION REPORT - GENERATED ${new Date().toISOString()}

NOTICE: This report is generated from SIMULATED telemetry for demonstration.
The Environmental Health Score is a PROTOTYPE composite and is NOT a
scientifically validated regulatory index. Pollutant identification and
source attribution are NOT implemented.

MISSION: ${state.mission.sector}
MISSION TIME: ${Math.floor((Date.now() - state.mission.startedAt) / 60000)} min
DISTANCE: ${state.mission.distanceKm.toFixed(2)} km   SAMPLES: ${state.mission.samples}   ANOMALIES: ${state.mission.anomalies}   PROGRESS: ${Math.round(state.mission.progress)}%

PARAMETER SUMMARY
${PARAM_ORDER.map((p) => {
  const d = PARAMS[p];
  return `${d.label.padEnd(20)} value ${state.snapshot.sample.values[p].toFixed(d.decimals).padEnd(8)} ref ${d.refLabel.padEnd(12)} status ${state.snapshot.sample.values[p] >= d.range.min && state.snapshot.sample.values[p] <= d.range.max ? "NORMAL" : "DEVIATION"}`;
}).join("\n")}

AI ASSESSMENT: ${state.ai.assessment} (confidence ${state.ai.confidence}%)

EVENT LOG
${state.events.map((e) => `[${fmtClock(e.ts)}] ${e.level.padEnd(8)} ${e.title}`).join("\n")}

SYSTEM: DEEPWAVE v1.0  |  EDGE AI: WATER ANOMALY DETECTOR v2.1  |  ROVER DW-01
`;
    win.document.write(`<pre style="background:#030812;color:#dbeafe;padding:24px;font-family:monospace;font-size:13px;white-space:pre-wrap">${body}</pre>`);
    win.document.title = "DEEPWAVE Mission Report";
    win.document.close();
    win.print();
  };

  return (
    <Panel title="DATA & REPORTING" className="h-full">
      <div className="p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded border border-[var(--line)] bg-black/25 p-3">
            <div className="section-label">TIME RANGE</div>
            <Seg
              className="mt-2"
              options={[
                { label: "30M", value: "30m" },
                { label: "6H", value: "6h" },
                { label: "24H", value: "24h" },
                { label: "7D", value: "7d" },
                { label: "MISSION", value: "mission" },
              ]}
              value="24h"
              onChange={() => {}}
            />
          </div>
          <div className="rounded border border-[var(--line)] bg-black/25 p-3">
            <div className="section-label">SENSORS</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {PARAM_ORDER.map((p) => (
                <span key={p} className="border border-[var(--line)] bg-cyan-400/5 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300/80">
                  {PARAMS[p].label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded border border-[var(--line)] bg-black/25 px-3 py-2">
          <span className="section-label">MISSION</span>
          <span className="mono text-[11px] text-slate-300">{state.mission.sector}</span>
          <span className="section-label">EVENTS</span>
          <span className="mono text-[11px] text-amber-300">{state.events.length} logged</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <button onClick={exportCSV} className="clip-corners border border-[var(--line)] bg-cyan-400/10 px-3 py-2 font-mono text-[11px] font-semibold tracking-widest text-cyan-300 transition-all hover:bg-cyan-400/20">
            EXPORT CSV
          </button>
          <button onClick={exportPDF} className="clip-corners border border-[var(--line)] bg-black/30 px-3 py-2 font-mono text-[11px] font-semibold tracking-widest text-slate-300 transition-all hover:text-[var(--cyan)]">
            EXPORT PDF
          </button>
          <button onClick={generateReport} className="clip-corners border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 font-mono text-[11px] font-semibold tracking-widest text-emerald-300 transition-all hover:bg-emerald-400/20">
            GENERATE MISSION REPORT
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-[var(--line)] pt-2">
          <Chip>LAST EXPORT: —</Chip>
          <Chip tone="default">DATA SINK: BROWSER LOCAL</Chip>
        </div>
      </div>
    </Panel>
  );
}