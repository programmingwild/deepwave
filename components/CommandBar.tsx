"use client";

import { useEffect, useState } from "react";
import { engine } from "@/lib/core/engine";
import { useTelemetry, useClock } from "@/lib/hooks/useTelemetry";
import { fmtDuration } from "@/lib/core/utils";
import { Dot, StatusLed } from "@/components/ui";

export function CommandBar() {
  const state = useTelemetry();
  const now = useClock();
  const [confirmEStop, setConfirmEStop] = useState(false);
  const [estopArmed, setEstopArmed] = useState(false);

  useEffect(() => {
    if (confirmEStop) {
      const t = setTimeout(() => setConfirmEStop(false), 4000);
      return () => clearTimeout(t);
    }
  }, [confirmEStop]);

  const missionMs = now - state.mission.startedAt;
  const connected = true;

  const handleEStop = () => {
    if (!confirmEStop) {
      setConfirmEStop(true);
      return;
    }
    setEstopArmed(true);
    engine.stop();
    setConfirmEStop(false);
    setTimeout(() => {
      setEstopArmed(false);
      engine.start();
    }, 5000);
  };

  return (
    <header className="glass-panel border-x-0 border-t-0 rounded-none">
      <div className="flex flex-wrap items-stretch gap-x-8 gap-y-3 px-4 py-2.5">
        {/* brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <svg viewBox="0 0 40 40" className="h-10 w-10">
              <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(34,211,238,0.25)" strokeWidth="1.5" />
              <circle cx="20" cy="20" r="14" fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx="20" cy="20" r="5" fill="rgba(34,211,238,0.15)" stroke="#22d3ee" strokeWidth="1.5">
                <animate attributeName="r" values="5;6;5" dur="3s" repeatCount="indefinite" />
              </circle>
              <path d="M20 2 L22 8 L20 6 L18 8 Z" fill="#22d3ee" />
            </svg>
            <span className="absolute inset-0 rounded-full shadow-glow" />
          </div>
          <div>
            <div className="mono text-xl font-bold leading-none tracking-[0.28em] text-[var(--cyan)] text-glow">
              DEEPWAVE
            </div>
            <div className="section-label mt-1">Underwater Environmental Intelligence</div>
          </div>
        </div>

        {/* status strip */}
        <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2 sm:gap-x-6 xl:gap-x-8">
          <div className="flex items-center gap-2">
            <Dot color={connected ? "var(--health)" : "var(--crit)"} />
            <span className="mono text-[11px] font-semibold tracking-widest text-emerald-300">
              SYSTEM ONLINE
            </span>
          </div>
          <Stat k="ROVER" v={state.selectedRover} />
          <Stat k="FLEET" v="3 UNITS · TRIANGLE" accent="var(--cyan)" />
          <Stat k="MISSION" v="WATER QUALITY SURVEY" />
          <Stat k="DEPTH" v={`${state.rover.depth.toFixed(1)} m`} accent="var(--cyan)" />
          <Stat k="BATTERY" v={`${Math.round(state.rover.battery)}%`} accent="var(--health)" />
          <Stat k="EDGE AI" v="ACTIVE" accent="var(--cyan)" />
          <Stat k="DATA LINK" v="CONNECTED" accent="var(--health)" />
          <Stat k="MISSION TIME" v={fmtDuration(missionMs)} />
          <Stat k="CLOCK" v={new Date(now).toLocaleTimeString("en-GB")} accent="var(--txt)" />
        </div>

        {/* controls */}
        <div className="flex items-center gap-2">
          <div className="mr-2 hidden items-center gap-2 lg:flex">
            <StatusLed status={estopArmed ? "ACTIVE" : "INACTIVE"} />
          </div>
          <button
            onClick={handleEStop}
            className={`clip-corners border px-4 py-2 text-[10px] font-bold tracking-widest transition-all ${
              estopArmed
                ? "border-red-400/60 bg-red-500/20 text-red-300 shadow-glow-red"
                : confirmEStop
                  ? "border-amber-400/60 bg-amber-500/15 text-amber-300 shadow-glow-amber"
                  : "border-red-400/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            }`}
          >
            {estopArmed ? "ESTOP ARMED" : confirmEStop ? "CONFIRM ESTOP?" : "E-STOP"}
          </button>
        </div>
      </div>

      {/* bottom hairline with mission context */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--line)] px-4 py-1.5">
        <div className="section-label">
          SIMULATED TELEMETRY LAYER <span className="text-[var(--cyan)]">&#9654;</span> MOCK PROVIDER ACTIVE — READY FOR LIVE RASPBERRY PI STREAM
        </div>
        <div className="section-label hidden md:block">
          DEEPWAVE v1.0 · EDGE AI: WATER ANOMALY DETECTOR v2.1
        </div>
      </div>
    </header>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div className="flex flex-col">
      <span className="section-label">{k}</span>
      <span className="mono text-[12px] font-medium" style={{ color: accent ?? "var(--txt)" }}>
        {v}
      </span>
    </div>
  );
}