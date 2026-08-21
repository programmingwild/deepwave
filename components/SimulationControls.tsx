"use client";

import { useEffect, useState } from "react";
import { engine } from "@/lib/core/engine";
import { useTelemetry } from "@/lib/hooks/useTelemetry";

const SEQUENCE = [
  "NORMAL WATER",
  "TURBIDITY RISING",
  "DO DECREASING",
  "CONDUCTIVITY CHANGING",
  "AI DETECTS ANOMALY",
  "HEALTH SCORE DROPS",
  "ALERT ISSUED",
  "SAMPLING INCREASED",
  "CAMERA RECORDING",
  "EVENT LOGGED",
];

export function SimulationControls() {
  useTelemetry(); // subscribe to engine emits so the phase indicator re-renders
  const [step, setStep] = useState(0);
  const running = engine.isSimulatingPollution();

  useEffect(() => {
    if (!running) {
      setStep(0);
      return;
    }
    const iv = setInterval(() => {
      setStep((s) => Math.min(s + 1, SEQUENCE.length - 1));
    }, 4200);
    return () => clearInterval(iv);
  }, [running]);

  const trigger = () => {
    setStep(1);
    engine.triggerPollution();
  };

  return (
    <div className="glass-panel panel-corners panel-accent flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
      <div className="lg:w-[280px]">
        <div className="mono text-[11px] font-bold tracking-[0.25em] text-[var(--cyan)]">
          SIMULATION MODE
        </div>
        <div className="mt-1 text-[11px] leading-relaxed text-slate-400">
          Injects a scripted pollution scenario (turbidity rise, DO drop, conductivity shift) so the full
          early-warning pipeline can be demonstrated without the physical rover.
        </div>
      </div>

      <button
        onClick={trigger}
        disabled={running}
        className={`clip-corners border px-6 py-2.5 font-mono text-[12px] font-bold tracking-[0.2em] transition-all ${
          running
            ? "border-amber-400/50 bg-amber-500/10 text-amber-300"
            : "border-cyan-400/40 bg-cyan-400/10 text-cyan-300 shadow-glow hover:bg-cyan-400/20"
        }`}
      >
        {running ? "● EVENT IN PROGRESS" : "▶ ACTIVATE POLLUTION SCENARIO"}
      </button>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {SEQUENCE.map((s, i) => {
          const done = i < step;
          const active = i === step && running;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span
                className={`clip-corners border px-1.5 py-0.5 font-mono text-[8px] tracking-wider transition-all duration-300 ${
                  done
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                    : active
                      ? "border-amber-400/60 bg-amber-400/10 text-amber-300 shadow-glow-amber"
                      : "border-[var(--line)] bg-black/25 text-slate-600"
                }`}
              >
                {done ? "✓ " : active ? "▶ " : ""}
                {s}
              </span>
              {i < SEQUENCE.length - 1 && <span className="text-slate-700">→</span>}
            </div>
          );
        })}
      </div>

      <div className="shrink-0 pl-3 lg:border-l lg:border-[var(--line)]">
        <div className="section-label">SOURCE</div>
        <div className="mono mt-0.5 text-[10px] text-slate-400">
          SIMULATED TELEMETRY
          <span className="text-[var(--health)]"> ●</span>
        </div>
      </div>
    </div>
  );
}