"use client";

import { useMemo } from "react";
import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { Panel, Bar, Chip } from "@/components/ui";
import { engine } from "@/lib/core/engine";

const LOAD_ITEMS: { key: keyof import("@/lib/types").PowerLoad; label: string }[] = [
  { key: "thrusters", label: "THRUSTERS" },
  { key: "raspberryPi", label: "RASPBERRY PI" },
  { key: "sensors", label: "SENSORS" },
  { key: "camera", label: "CAMERA" },
  { key: "lighting", label: "LIGHTING" },
  { key: "communication", label: "COMMUNICATION" },
];

export function PowerPanel() {
  const state = useTelemetry();
  const p = state.power;
  const m = state.mission;
  const r = state.rover;

  const total = Object.values(p).reduce((a, b) => a + b, 0);
  const actualPower = Math.round(total * (m.energySaving ? 0.78 : 1));
  const etaMinSimple = useMemo(() => {
    // battery % drained per minute at current draw
    const drainPerMin = (total / 100) * 2.4 * (m.energySaving ? 0.78 : 1);
    return r.battery / drainPerMin;
  }, [r.battery, total, m.energySaving]);

  return (
    <Panel
      title="MISSION ENERGY"
      right={
        <button
          onClick={() => engine.toggleEnergySaving()}
          className={`flex items-center gap-2 border px-2 py-1 font-mono text-[9px] font-bold tracking-widest transition-all ${
            m.energySaving
              ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300 shadow-glow"
              : "border-[var(--line)] bg-black/30 text-slate-500"
          }`}
        >
          ENERGY SAVING MODE
          <span className={m.energySaving ? "text-[var(--health)]" : "text-slate-600"}>
            {m.energySaving ? "● ACTIVE" : "○ INACTIVE"}
          </span>
        </button>
      }
      className="h-full"
    >
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded border border-[var(--line)] bg-black/25 p-3 text-center">
            <div className="section-label">BATTERY</div>
            <div className="mono text-[28px] font-bold leading-none" style={{ color: r.battery > 50 ? "var(--health)" : "var(--warn)" }}>
              {Math.round(r.battery)}%
            </div>
            <Bar value={r.battery} color={r.battery > 50 ? "var(--health)" : "var(--warn)"} className="mt-2" />
          </div>
          <div className="rounded border border-[var(--line)] bg-black/25 p-3 text-center">
            <div className="section-label">POWER</div>
            <div className="mono text-[28px] font-bold leading-none text-[var(--cyan)]">
              {actualPower}
              <span className="text-[12px] text-slate-500"> W</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500">current draw</div>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/25 p-3 text-center">
            <div className="section-label">EST. REMAINING</div>
            <div className="mono text-[28px] font-bold leading-none text-amber-300">
              {Math.max(0, Math.round(etaMinSimple))}
              <span className="text-[12px] text-slate-500"> min</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500">{m.energySaving ? "saving mode" : "standard mode"}</div>
          </div>
        </div>

        {/* power consumption chart */}
        <div className="mt-4">
          <div className="section-label mb-2">POWER CONSUMPTION BY SUBSYSTEM</div>
          <div className="space-y-2">
            {LOAD_ITEMS.map((item) => {
              const v = p[item.key];
              const pct = (v / total) * 100;
              const color =
                item.key === "thrusters"
                  ? "var(--cyan)"
                  : item.key === "lighting"
                    ? "var(--warn)"
                    : item.key === "raspberryPi"
                      ? "var(--health)"
                      : "#94a3b8";
              return (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="section-label w-28 shrink-0">{item.label}</span>
                  <div className="flex-1">
                    <Bar value={pct} color={color} />
                  </div>
                  <span className="mono w-14 text-right text-[11px] text-slate-300">{v} W</span>
                  <span className="mono w-10 text-right text-[9px] text-slate-600">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-2">
          <Chip tone={m.energySaving ? "cyan" : "default"}>
            {m.energySaving ? "THROTTLE REDUCED TO 72%" : "FULL THROTTLE"}
          </Chip>
          <span className="mono text-[10px] text-slate-500">Li-Ion 2×58 Wh · 48 V</span>
        </div>
      </div>
    </Panel>
  );
}