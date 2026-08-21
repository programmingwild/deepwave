"use client";

import { useMemo } from "react";
import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { Panel, Bar } from "@/components/ui";
import { engine, MISSION_WAYPOINTS, POLLUTION_HOTSPOTS } from "@/lib/core/engine";

export function MissionMap() {
  const state = useTelemetry();
  const r = state.rover;
  const m = state.mission;
  const rp = state.replan;

  const pathD = useMemo(() => {
    const pts = MISSION_WAYPOINTS.map((p) => `${(p.x * 100).toFixed(1)},${(p.y * 100).toFixed(1)}`);
    return pts.join(" ");
  }, []);

  const replanD = useMemo(() => {
    if (!rp.plannedPath.length) return "";
    const pts = rp.plannedPath.map((p) => `${(p.x * 100).toFixed(1)},${(p.y * 100).toFixed(1)}`);
    return pts.join(" ");
  }, [rp.plannedPath]);

  const rx = r.position.x * 100;
  const ry = r.position.y * 100;
  const alert = state.ai.isPollutionEvent;

  return (
    <Panel
      title="MISSION MAP — UNDERWATER SURVEY"
      right={
        <span className="mono text-[9px] tracking-widest text-slate-500">
          {alert ? "ACTIVE ALERT" : "ROUTINE"}
        </span>
      }
      className="h-full"
    >
      <div className="p-4">
        <div className="relative overflow-hidden rounded border border-[var(--line)] bg-[#04142a]">
          {/* bathymetric grid */}
          <svg viewBox="0 0 100 100" className="block h-auto w-full" preserveAspectRatio="none">
            <defs>
              <radialGradient id="mapGlow" cx="0.5" cy="0.5" r="0.7">
                <stop offset="0%" stopColor="rgba(14,60,110,0.5)" />
                <stop offset="100%" stopColor="rgba(3,10,24,0)" />
              </radialGradient>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(56,189,248,0.08)" strokeWidth="0.15" />
              </pattern>
              <pattern id="gridBig" width="25" height="25" patternUnits="userSpaceOnUse">
                <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(56,189,248,0.12)" strokeWidth="0.2" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#mapGlow)" />
            <rect width="100" height="100" fill="url(#gridBig)" />
            <rect width="100" height="100" fill="url(#grid)" />

            {/* depth contour lines */}
            <path d="M -5 68 Q 20 55 45 62 T 105 58" fill="none" stroke="rgba(56,189,248,0.1)" strokeWidth="0.4" />
            <path d="M -5 80 Q 30 70 60 78 T 105 76" fill="none" stroke="rgba(56,189,248,0.08)" strokeWidth="0.4" />
            <path d="M -5 90 Q 25 86 55 92 T 105 90" fill="none" stroke="rgba(56,189,248,0.06)" strokeWidth="0.4" />

            {/* sampling points */}
            {Array.from({ length: 12 }).map((_, i) => {
              const x = 6 + ((i * 37) % 90);
              const y = 8 + ((i * 53) % 80);
              return (
                <circle key={i} cx={x} cy={y} r="0.5" fill="rgba(125,211,252,0.35)" />
              );
            })}

            {/* survey path */}
            <polyline
              points={pathD}
              fill="none"
              stroke="rgba(34,211,238,0.55)"
              strokeWidth="0.7"
              strokeDasharray="2 2"
            />
            <polyline points={pathD} fill="none" stroke="rgba(34,211,238,0.2)" strokeWidth="1.4" />

            {/* hotspots */}
            {POLLUTION_HOTSPOTS.map((h, i) => (
              <g key={h.label}>
                <circle cx={h.x * 100} cy={h.y * 100} r="2.4" fill="none" stroke="rgba(248,113,113,0.6)" strokeWidth="0.4" className={alert ? "sonar-ping" : ""} />
                <circle cx={h.x * 100} cy={h.y * 100} r="1" fill="rgba(248,113,113,0.7)" />
                <text x={h.x * 100 + 3} y={h.y * 100 - 2} fill="rgba(248,113,113,0.8)" fontSize="2.2" fontFamily="monospace">
                  {h.label}
                </text>
              </g>
            ))}

            {/* depth markers */}
            {[
              { x: 12, y: 20, d: "4.2m" },
              { x: 55, y: 12, d: "6.8m" },
              { x: 85, y: 40, d: "9.1m" },
              { x: 30, y: 85, d: "11.5m" },
            ].map((mk) => (
              <text key={mk.d} x={mk.x} y={mk.y} fill="rgba(125,211,252,0.45)" fontSize="2.2" fontFamily="monospace">
                {mk.d}
              </text>
            ))}

            {/* replanned path (active) */}
            {rp.active && replanD && (
              <>
                <polyline
                  points={replanD}
                  fill="none"
                  stroke="rgba(251,191,36,0.9)"
                  strokeWidth="0.8"
                  strokeDasharray="3 2"
                  className={alert ? "path-flash" : ""}
                />
                <polyline points={replanD} fill="none" stroke="rgba(251,191,36,0.25)" strokeWidth="2" />
                {rp.hotSpotTarget && (
                  <g transform={`translate(${rp.hotSpotTarget.x * 100} ${rp.hotSpotTarget.y * 100})`}>
                    <circle r="5" fill="none" stroke="rgba(251,191,36,0.8)" strokeWidth="0.4" className="sonar-ping" />
                    <text x="6" y="-3" fill="rgba(251,191,36,0.9)" fontSize="2.4" fontFamily="monospace">
                      REPLAN TARGET
                    </text>
                  </g>
                )}
              </>
            )}

            {/* fleet members */}
            {(["DW-01", "DW-02", "DW-03"] as const).map((id) => {
              const e = state.fleet[id];
              const fr = e.rover;
              const isSel = id === state.selectedRover;
              const px = fr.position.x * 100;
              const py = fr.position.y * 100;
              return (
                <g key={id} transform={`translate(${px} ${py})`}>
                  <circle
                    r={isSel ? 2.6 : 2}
                    fill="none"
                    stroke={isSel ? "rgba(34,211,238,0.6)" : e.status === "STANDBY" ? "rgba(148,163,184,0.5)" : "rgba(34,211,238,0.35)"}
                    strokeWidth="0.3"
                    className={isSel ? "sonar-ping" : ""}
                  />
                  <circle
                    r={isSel ? 1.6 : 1.15}
                    fill={isSel ? "rgba(34,211,238,0.9)" : e.status === "STANDBY" ? "rgba(148,163,184,0.6)" : "rgba(34,211,238,0.55)"}
                    stroke="#22d3ee"
                    strokeWidth="0.2"
                  />
                  <path d="M 0 -3 L 0 3 L 5 0 Z" fill={isSel ? "#22d3ee" : "rgba(34,211,238,0.6)"} transform={`rotate(${fr.heading})`} />
                  <text x="3" y="5" fill={isSel ? "rgba(34,211,238,0.9)" : "rgba(125,211,252,0.5)"} fontSize="2.2" fontFamily="monospace">
                    {id}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* legend */}
          <div className="absolute left-2 top-2 space-y-1 font-mono text-[8px] text-slate-400">
            <div className="flex items-center gap-1.5"><span className="h-1 w-3 bg-cyan-400/70" /> SURVEY PATH</div>
            {rp.active && <div className="flex items-center gap-1.5"><span className="h-1 w-3 bg-amber-400" /> REPLANNED PATH</div>}
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400/80" /> POLLUTION HOTSPOT</div>
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-300" /> FLEET ROV</div>
          </div>

          <div className="absolute bottom-2 right-2 rounded border border-cyan-400/20 bg-black/50 px-2 py-1 font-mono text-[8px] text-cyan-300/80">
            GRID 25m · SECTOR A · FORMATION {state.formation}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <MapStat k="MISSION" v={m.sector} />
            <MapStat k="DISTANCE" v={`${m.distanceKm.toFixed(2)} km`} />
            <MapStat k="SAMPLES" v={String(m.samples)} />
            <MapStat k="ANOMALIES" v={String(m.anomalies)} accent={alert ? "var(--crit)" : undefined} />
          </div>
          <button
            onClick={() => engine.triggerReplan()}
            className={`clip-corners shrink-0 border px-3 py-2 font-mono text-[9px] font-bold tracking-widest transition-all ${
              rp.active
                ? "border-amber-400/50 bg-amber-500/10 text-amber-300"
                : "border-cyan-400/40 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20"
            }`}
          >
            {rp.active ? "✓ REPLANNED" : "⟳ REPLAN MISSION"}
          </button>
        </div>

        {rp.active && (
          <div className="mt-2 flex items-center justify-between rounded border border-amber-400/20 bg-amber-500/5 px-2.5 py-1.5">
            <span className="font-mono text-[9px] tracking-wider text-amber-300/90">
              ⟳ {rp.reason}
            </span>
            <span className="font-mono text-[8px] text-amber-400/60">
              {new Date(rp.replannedAt).toLocaleTimeString("en-GB")}
            </span>
          </div>
        )}

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="section-label">MISSION PROGRESS</span>
            <span className="mono text-[11px] font-bold text-[var(--cyan)]">{Math.round(m.progress)}%</span>
          </div>
          <Bar value={m.progress} color="var(--cyan)" />
        </div>
      </div>
    </Panel>
  );
}

function MapStat({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div className="rounded border border-[var(--line)] bg-black/25 px-2 py-1.5">
      <div className="section-label">{k}</div>
      <div className="mono text-[11px] font-semibold" style={{ color: accent ?? "var(--txt)" }}>
        {v}
      </div>
    </div>
  );
}