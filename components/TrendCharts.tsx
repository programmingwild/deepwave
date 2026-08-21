"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
} from "recharts";
import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { PARAMS, PARAM_ORDER, type ParamId } from "@/lib/types";
import { engine } from "@/lib/core/engine";
import { downsample, fmtTime } from "@/lib/core/utils";
import { Panel, Seg } from "@/components/ui";

const RANGES = [
  { label: "1H", value: "1H" },
  { label: "6H", value: "6H" },
  { label: "12H", value: "12H" },
  { label: "24H", value: "24H" },
  { label: "7D", value: "7D" },
];

function useSeries(param: ParamId, range: string, version: number) {
  return useMemo(() => {
    const now = Date.now();
    const windowMs =
      range === "1H" ? 3600_000 : range === "6H" ? 6 * 3600_000 : range === "12H" ? 12 * 3600_000 : range === "24H" ? 24 * 3600_000 : 7 * 24 * 3600_000;

    const live = engine.getLiveSeries(param);
    const long = engine.getLongSeries(param);

    let src = range === "1H" ? live : long;
    let data = src.filter((d) => d.t >= now - windowMs).map((d) => ({ t: d.t, v: d.v }));
    if (data.length < 2) {
      data = live.filter((d) => d.t >= now - windowMs).map((d) => ({ t: d.t, v: d.v }));
    }
    const maxPoints = range === "1H" ? 700 : range === "7D" ? 1400 : 800;
    return downsample(data, maxPoints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param, range, version]);
}

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-[var(--line-strong)] bg-[#050d1c]/95 px-2.5 py-1.5 font-mono text-[11px] shadow-xl">
      <div className="text-slate-400">{fmtTime(label)}</div>
      <div className="text-[var(--cyan)]">
        {payload[0].value?.toFixed(2)} {unit}
      </div>
    </div>
  );
}

export function TrendCharts() {
  const state = useTelemetry();
  const [range, setRange] = useState("24H");
  const [param, setParam] = useState<ParamId>("turbidity");

  const def = PARAMS[param];
  const data = useSeries(param, range, state.version);
  const now = Date.now();
  const windowMs =
    range === "1H" ? 3600_000 : range === "6H" ? 6 * 3600_000 : range === "12H" ? 12 * 3600_000 : range === "24H" ? 24 * 3600_000 : 7 * 24 * 3600_000;
  const from = now - windowMs;
  const horizonMs = state.forecast.horizonMin * 60_000;

  const forecast = state.forecast.points[param];
  const combined = useMemo(() => {
    const fc = (state.forecast.points[param] ?? []).map((p) => ({
      t: p.t,
      v: p.mid,
      low: p.low,
      delta: Math.max(0.0001, p.high - p.low),
      mid: p.mid,
      forecast: true,
    }));
    const past = data.map((d) => ({ t: d.t, v: d.v, low: null as number | null, delta: null as number | null, mid: null as number | null, forecast: false }));
    return [...past, ...fc];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, state.forecast.points, param]);

  const anomalyActive =
    state.ai.anomalies.some((a) => a.param === param) ||
    (param === "turbidity" && state.snapshot.sample.values.turbidity > def.range.max);
  const watchActive = state.forecast.watch && state.forecast.watchParam === param;

  return (
    <Panel
      title="WATER QUALITY TREND ANALYSIS + AI FORECAST"
      right={
        <div className="flex items-center gap-3">
          <span className="mono text-[9px] tracking-widest" style={{ color: state.forecast.watch ? "var(--warn)" : "var(--txt-dim)" }}>
            {state.forecast.watch
              ? `⏱ PRE-EMPTIVE WATCH · ${state.forecast.watchMessage}`
              : `MODEL CONFIDENCE ${Math.round(state.forecast.confidence)}%`}
          </span>
          <Seg options={RANGES} value={range} onChange={setRange} />
        </div>
      }
      className="h-full"
    >
      <div className="p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {PARAM_ORDER.map((id) => (
            <button
              key={id}
              onClick={() => setParam(id)}
              className={`px-2.5 py-1 font-mono text-[10px] tracking-wider transition-all ${
                param === id
                  ? "bg-[var(--cyan)]/15 text-[var(--cyan)] shadow-[inset_0_0_0_1px_rgba(34,211,238,0.4)]"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {PARAMS[id].label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="flex items-baseline gap-2">
            <span className="mono text-[16px] font-bold" style={{ color: def.color }}>
              {def.label}
            </span>
            <span className="mono text-[11px] text-slate-500">
              {state.snapshot.sample.values[param].toFixed(def.decimals)} {def.unit}
            </span>
          </div>
          <span className="mono text-[9px] tracking-widest" style={{ color: watchActive ? "var(--warn)" : "var(--txt-dim)" }}>
            {watchActive ? "⚠ AI FORECAST: BREACH IMMINENT" : "NORMAL WINDOW"}
          </span>
        </div>

        <div className="mt-1 h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={combined} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${param}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={def.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={def.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(56,189,248,0.08)" vertical={false} strokeDasharray="3 6" />
              <XAxis
                dataKey="t"
                domain={[from, now + horizonMs]}
                type="number"
                tickFormatter={(t) => fmtTime(t)}
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
                axisLine={{ stroke: "rgba(34,211,238,0.2)" }}
                tickLine={false}
                minTickGap={50}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
                axisLine={{ stroke: "rgba(34,211,238,0.2)" }}
                tickLine={false}
                width={54}
              />
              <Tooltip content={<ChartTooltip unit={def.unit} />} />
              {/* normal band */}
              <ReferenceArea y1={def.range.min} y2={def.range.max} fill="rgba(52,211,153,0.05)" />
              {/* anomaly regions above/below range */}
              <ReferenceArea y1={def.range.max} y2={def.range.max * 1.6} fill="rgba(248,113,113,0.12)" />
              <ReferenceArea y1={def.range.min * 0.4} y2={def.range.min} fill="rgba(248,113,113,0.12)" />
              {/* forecast band: stacked low + delta = high */}
              <Area
                type="monotone"
                dataKey="low"
                stackId="fc"
                stroke="none"
                fill="none"
                isAnimationActive={false}
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="delta"
                stackId="fc"
                stroke="none"
                fill={def.color}
                fillOpacity={0.12}
                isAnimationActive={false}
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={def.color}
                strokeWidth={1.6}
                fill={`url(#grad-${param})`}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="mid"
                stroke="#e2e8f0"
                strokeWidth={1.4}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-1 flex items-center justify-between px-1 text-[9px] text-slate-600">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-2">
              <span className="inline-block h-px w-4 bg-[var(--health)]" /> REFERENCE BAND
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 bg-red-400/20" /> ANOMALY REGION
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-px w-4 border-t border-dashed border-slate-200" /> AI FORECAST · {state.forecast.horizonMin} MIN AHEAD
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2" style={{ backgroundColor: def.color, opacity: 0.25 }} /> CONFIDENCE BAND
            </span>
          </span>
          <span>RES: {range === "1H" ? "1 s" : "1 min"} · SOURCE: {range === "1H" ? "LIVE TICK STREAM" : "ROLLING MINUTE BUCKETS"}</span>
        </div>
      </div>
    </Panel>
  );
}