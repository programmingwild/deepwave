"use client";

import { engine } from "@/lib/core/engine";
import { FLEET_IDS } from "@/lib/core/engine";
import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { Panel, Bar, Chip } from "@/components/ui";
import type { Formation, RoverId } from "@/lib/types";

const FORMATIONS: Formation[] = ["LINE", "TRIANGLE", "DIAMOND"];

const ROLES: Record<RoverId, string> = {
  "DW-01": "LEAD",
  "DW-02": "WINGMAN",
  "DW-03": "WINGMAN",
};

export function FleetPanel() {
  const state = useTelemetry();
  const fleet = state.fleet;
  const sel = state.selectedRover;

  return (
    <Panel
      title="FLEET — MULTI-ROV FORMATION"
      right={
        <div className="flex gap-1">
          {FORMATIONS.map((f) => (
            <button
              key={f}
              onClick={() => engine.setFormation(f)}
              className={`px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider transition-colors ${
                state.formation === f
                  ? "bg-[var(--cyan)]/15 text-[var(--cyan)] shadow-[inset_0_0_0_1px_rgba(34,211,238,0.4)]"
                  : "border border-[var(--line)] bg-black/30 text-[var(--txt-dim)] hover:text-slate-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      }
      className="h-full"
    >
      <div className="space-y-2 p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {FLEET_IDS.map((id) => {
            const e = fleet[id];
            const r = e.rover;
            const active = id === sel;
            const batColor = r.battery > 50 ? "var(--health)" : r.battery > 25 ? "var(--warn)" : "var(--crit)";
            const statusTone =
              e.status === "FAULT" ? "crit" : e.status === "ACTIVE" ? "cyan" : e.status === "STANDBY" ? "default" : "ok";
            return (
              <button
                key={id}
                onClick={() => engine.selectRover(id)}
                className={`relative rounded border p-2 text-left transition-all ${
                  active
                    ? "border-[var(--cyan)]/50 bg-[var(--cyan)]/5 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                    : "border-[var(--line)] bg-black/25 hover:border-slate-500/50"
                }`}
              >
                {active && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--cyan)] shadow-glow" />
                )}
                <div className="flex items-center justify-between">
                  <span className="mono text-[12px] font-bold" style={{ color: active ? "var(--cyan)" : "var(--txt)" }}>
                    {id}
                  </span>
                  <span className="font-mono text-[8px] tracking-wider text-slate-500">{ROLES[id]}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <Chip tone={statusTone}>{e.status}</Chip>
                  <span className="mono text-[10px] text-slate-400">{r.depth.toFixed(1)} m</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="section-label">BAT</span>
                  <Bar value={r.battery} color={batColor} className="flex-1" />
                  <span className="mono text-[9px]" style={{ color: batColor }}>
                    {Math.round(r.battery)}%
                  </span>
                </div>
                <div className="mt-1 font-mono text-[8px] tracking-wider text-slate-600">
                  HDG {Math.round(r.heading)}° · SPD {r.speed.toFixed(2)} m/s
                </div>
                {active && (
                  <div className="mt-1 font-mono text-[8px] tracking-widest text-[var(--cyan)]">
                    ◀ CONTROL VESSEL
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded border border-[var(--line)] bg-black/25 px-2.5 py-2">
          <div>
            <div className="section-label">COLLISION AVOIDANCE</div>
            <div className="mono text-[10px] text-[var(--health)]">
              ENFORCING 12 m KEEP-OUT SEPARATION
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1">
              {FLEET_IDS.map((id) => (
                <span
                  key={id}
                  className="h-2 w-2 rotate-45"
                  style={{
                    backgroundColor: id === sel ? "var(--cyan)" : "rgba(34,211,238,0.3)",
                    boxShadow: id === sel ? "0 0 8px rgba(34,211,238,0.6)" : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="text-[9px] leading-relaxed text-slate-500">
          Select a vessel to bind telemetry + joystick to it. The selected vessel leads the formation;
          wingmen hold station while manual piloting is engaged.
        </p>
      </div>
    </Panel>
  );
}