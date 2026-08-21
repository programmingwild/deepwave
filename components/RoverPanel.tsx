"use client";

import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { Panel, Bar, FieldRow } from "@/components/ui";

function RoverSVG({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 320 200" className="w-full">
      <defs>
        <radialGradient id="hullGrad" cx="0.5" cy="0.3" r="0.9">
          <stop offset="0%" stopColor="#1c3a5e" />
          <stop offset="55%" stopColor="#0d1f3c" />
          <stop offset="100%" stopColor="#060d1c" />
        </radialGradient>
        <linearGradient id="buoyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#163a4f" />
          <stop offset="100%" stopColor="#0a2231" />
        </linearGradient>
      </defs>

      {/* frame */}
      <rect x="38" y="58" width="244" height="84" rx="10" fill="none" stroke="rgba(34,211,238,0.25)" strokeWidth="1.5" />
      <rect x="46" y="66" width="228" height="68" rx="7" fill="none" stroke="rgba(34,211,238,0.12)" strokeWidth="1" strokeDasharray="4 4" />

      {/* buoyancy modules */}
      <rect x="46" y="62" width="56" height="18" rx="3" fill="url(#buoyGrad)" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />
      <rect x="218" y="62" width="56" height="18" rx="3" fill="url(#buoyGrad)" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />
      <rect x="46" y="120" width="56" height="18" rx="3" fill="url(#buoyGrad)" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />
      <rect x="218" y="120" width="56" height="18" rx="3" fill="url(#buoyGrad)" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />

      {/* cross beams */}
      <line x1="102" y1="80" x2="102" y2="120" stroke="rgba(34,211,238,0.15)" strokeWidth="1" />
      <line x1="218" y1="80" x2="218" y2="120" stroke="rgba(34,211,238,0.15)" strokeWidth="1" />
      <line x1="102" y1="100" x2="218" y2="100" stroke="rgba(34,211,238,0.15)" strokeWidth="1" />

      {/* pressure hull */}
      <rect x="96" y="84" width="128" height="32" rx="16" fill="url(#hullGrad)" stroke="#22d3ee" strokeWidth="1.5" />
      <rect x="102" y="88" width="116" height="8" rx="4" fill="rgba(34,211,238,0.08)" />
      {/* hull rings */}
      <line x1="150" y1="84" x2="150" y2="116" stroke="rgba(34,211,238,0.2)" strokeWidth="1" />
      <line x1="176" y1="84" x2="176" y2="116" stroke="rgba(34,211,238,0.2)" strokeWidth="1" />
      {/* hull label */}
      <text x="160" y="106" textAnchor="middle" fill="rgba(125,211,252,0.5)" fontSize="7" fontFamily="monospace" letterSpacing="2">
        DW-01
      </text>

      {/* camera dome */}
      <circle cx="224" cy="100" r="13" fill="rgba(14,42,66,0.9)" stroke="#38bdf8" strokeWidth="1.5" />
      <circle cx="224" cy="100" r="9" fill="rgba(8,20,34,0.95)" stroke="rgba(56,189,248,0.4)" strokeWidth="0.75" />
      <ellipse cx="220" cy="96" rx="4" ry="2.5" fill="rgba(255,255,255,0.14)" />
      <circle cx="224" cy="100" r="3.5" fill="none" stroke="rgba(34,211,238,0.6)" strokeWidth="0.5" />

      {/* sonar ping */}
      <circle cx="224" cy="100" r="6" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="0.6" className="sonar-ping" style={{ transformBox: "fill-box", transformOrigin: "center" }} />

      {/* thrusters */}
      <Thruster x={64} y={90} rot={0} active={active} />
      <Thruster x={64} y={112} rot={0} active={active} />
      <Thruster x={256} y={90} rot={0} active={active} />
      <Thruster x={256} y={112} rot={0} active={active} />

      {/* light pods */}
      <rect x="130" y="86" width="16" height="4" rx="1" fill="rgba(34,211,238,0.4)" />
      <rect x="174" y="86" width="16" height="4" rx="1" fill="rgba(34,211,238,0.4)" />
    </svg>
  );
}

function Thruster({ x, y, rot, active }: { x: number; y: number; rot: number; active: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-5" y="-6" width="10" height="12" rx="2" fill="#0c1e38" stroke={active ? "#22d3ee" : "rgba(34,211,238,0.3)"} strokeWidth="1" />
      <g className={active ? "thruster-on" : ""}>
        <ellipse cx="0" cy="0" rx="3.2" ry="1.6" fill={active ? "rgba(34,211,238,0.5)" : "rgba(100,116,139,0.4)"} />
        <line x1="-2" y1="0" x2="2" y2="0" stroke={active ? "#22d3ee" : "#64748b"} strokeWidth="0.6" />
        <line x1="0" y1="-1.5" x2="0" y2="1.5" stroke={active ? "#22d3ee" : "#64748b"} strokeWidth="0.6" />
      </g>
    </g>
  );
}

export function RoverPanel() {
  const state = useTelemetry();
  const r = state.rover;
  const m = state.mission;
  const active = r.thrusters.some(Boolean);
  const batColor = r.battery > 50 ? "var(--health)" : r.battery > 25 ? "var(--warn)" : "var(--crit)";

  return (
    <Panel
      title="ROVER TELEMETRY — DW-01"
      right={<span className="mono text-[10px] tracking-widest text-slate-500">TOP VIEW</span>}
      className="h-full"
    >
      <div className="grid grid-cols-[1fr_150px] gap-3 p-4">
        <div className="relative">
          <div className="floaty">
            <RoverSVG active={active} />
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-2">
            <div>
              <div className="section-label">THRUSTERS</div>
              <div className="mono text-[11px] font-semibold" style={{ color: active ? "var(--cyan)" : "var(--txt-dim)" }}>
                {active ? "4/4 PROPULSION ACTIVE" : "STANDBY"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {r.thrusters.map((on, i) => (
                <span
                  key={i}
                  className={`h-2 w-4 ${on ? "bg-[var(--cyan)] shadow-glow" : "bg-slate-700"}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <FieldRow label="DEPTH" value={`${r.depth.toFixed(1)} m`} accent="var(--cyan)" />
          <FieldRow label="SPEED" value={`${r.speed.toFixed(2)} m/s`} />
          <FieldRow label="HEADING" value={`${Math.round(r.heading)}°`} />
          <FieldRow label="PITCH" value={`${r.pitch.toFixed(1)}°`} />
          <FieldRow label="ROLL" value={`${r.roll.toFixed(1)}°`} />
          <div className="pt-1">
            <FieldRow label="BATTERY" value={`${Math.round(r.battery)}%`} accent={batColor} />
            <Bar value={r.battery} color={batColor} className="mt-1" />
          </div>
          <FieldRow label="POWER" value={`${r.power} W`} />
        </div>
      </div>
    </Panel>
  );
}