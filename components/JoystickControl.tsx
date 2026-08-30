"use client";

import { useCallback, useRef, useState } from "react";
import { engine } from "@/lib/core/engine";
import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { Panel, FieldRow, Chip } from "@/components/ui";

export function JoystickControl() {
  const state = useTelemetry();
  const control = state.control;
  const r = state.rover;

  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const applyAxis = useCallback((clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const mag = Math.hypot(dx, dy);
    if (mag > max) {
      dx = (dx / mag) * max;
      dy = (dy / mag) * max;
    }
    setKnob({ x: dx, y: dy });
    engine.setJoystick(-dy / max, dx / max);
  }, []);

  const releaseAxis = useCallback(() => {
    setKnob({ x: 0, y: 0 });
    engine.setJoystick(0, 0);
  }, []);

  const engageHaptic = useCallback(() => {
    if (!control.active) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
  }, [control.active]);

  const stepDepth = useCallback(
    (dir: 1 | -1) => {
      const cur = control.depthTarget ?? r.depth;
      engine.setDepthTarget(Math.round(Math.max(3, Math.min(20, cur + dir)) * 10) / 10);
    },
    [control.depthTarget, r.depth],
  );

  const throttlePct = Math.round(control.throttle * 100);
  const steerPct = Math.round(control.steer * 100);
  const moving = control.active && (Math.abs(control.throttle) > 0.05 || Math.abs(control.steer) > 0.05);

  return (
    <Panel
      title="MANUAL CONTROL — JOYSTICK"
      right={
        <Chip tone={control.active ? "cyan" : "default"}>
          {control.active ? "MANUAL" : "AUTO"}
        </Chip>
      }
      className="h-full"
    >
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <span className="section-label">MODE</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => engine.setManualMode(false)}
              disabled={!control.active}
              className={`px-2.5 py-1 text-[10px] font-semibold tracking-wider transition-colors ${
                !control.active
                  ? "bg-emerald-400/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.4)]"
                  : "border border-[var(--line)] bg-black/30 text-[var(--txt-dim)] hover:text-slate-300"
              }`}
            >
              AUTO PILOT
            </button>
            <button
              onClick={() => engine.setManualMode(true)}
              disabled={control.active}
              className={`px-2.5 py-1 text-[10px] font-semibold tracking-wider transition-colors ${
                control.active
                  ? "bg-[var(--cyan)]/15 text-[var(--cyan)] shadow-[inset_0_0_0_1px_rgba(34,211,238,0.4)]"
                  : "border border-[var(--line)] bg-black/30 text-[var(--txt-dim)] hover:text-slate-300"
              }`}
            >
              MANUAL
            </button>
          </div>
        </div>

        {/* joystick pad */}
        <div
          ref={padRef}
          className="relative mx-auto aspect-square w-full max-w-[280px] touch-none select-none rounded-full border border-[var(--line)] bg-black/40"
          style={{
            boxShadow: "inset 0 0 24px rgba(8,25,50,0.8)",
            cursor: control.active ? "crosshair" : "not-allowed",
          }}
          onPointerDown={(e) => {
            if (!control.active) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            engageHaptic();
            applyAxis(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!control.active || e.buttons === 0) return;
            applyAxis(e.clientX, e.clientY);
          }}
          onPointerUp={releaseAxis}
          onPointerCancel={releaseAxis}
          onPointerLeave={() => {
            if (control.active) releaseAxis();
          }}
        >
          {/* crosshair */}
          <div className="absolute inset-0 rounded-full">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--line)]/60" />
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[var(--line)]/60" />
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--cyan)]/40" />
            <div className="absolute left-1/2 top-[16%] -translate-x-1/2 font-mono text-[8px] tracking-widest text-slate-500">
              FWD
            </div>
            <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 font-mono text-[8px] tracking-widest text-slate-500">
              REV
            </div>
            <div className="absolute left-[10%] top-1/2 -translate-y-1/2 font-mono text-[8px] tracking-widest text-slate-500">
              PORT
            </div>
            <div className="absolute right-[10%] top-1/2 -translate-y-1/2 font-mono text-[8px] tracking-widest text-slate-500">
              STBD
            </div>
          </div>
          {/* knob */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--cyan)]/70"
            style={{
              transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
              background: moving
                ? "radial-gradient(circle, rgba(34,211,238,0.35) 0%, rgba(8,25,50,0.2) 70%)"
                : "radial-gradient(circle, rgba(34,211,238,0.12) 0%, rgba(8,25,50,0.2) 70%)",
              boxShadow: moving ? "0 0 16px rgba(34,211,238,0.5)" : "0 0 8px rgba(34,211,238,0.15)",
            }}
          >
            <div className="absolute inset-2 rounded-full border border-[var(--cyan)]/30" />
          </div>
          {!control.active && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <span className="font-mono text-[9px] tracking-widest text-slate-500">ENGAGE MANUAL TO PILOT</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-[var(--line)] bg-black/30 px-2 py-1.5">
            <div className="section-label">THROTTLE</div>
            <div className="mono text-[13px] font-semibold" style={{ color: Math.abs(control.throttle) > 0.05 ? "var(--cyan)" : "var(--txt-dim)" }}>
              {control.active ? `${throttlePct > 0 ? "AHEAD" : throttlePct < 0 ? "ASTERN" : "STOP"} ${Math.abs(throttlePct)}%` : "—"}
            </div>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/30 px-2 py-1.5">
            <div className="section-label">STEERING</div>
            <div className="mono text-[13px] font-semibold" style={{ color: Math.abs(control.steer) > 0.05 ? "var(--cyan)" : "var(--txt-dim)" }}>
              {control.active ? `${steerPct > 0 ? "STBD" : steerPct < 0 ? "PORT" : "CENTER"} ${Math.abs(steerPct)}%` : "—"}
            </div>
          </div>
        </div>

        {/* depth hold */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="section-label">DEPTH HOLD</span>
            <span className="mono text-[10px]" style={{ color: control.depthTarget !== null ? "var(--cyan)" : "var(--txt-dim)" }}>
              {control.depthTarget !== null ? `TARGET ${control.depthTarget.toFixed(1)} m` : "AUTO"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => stepDepth(-1)}
              disabled={!control.active}
              className="flex-1 border border-[var(--line)] bg-black/30 py-1.5 font-mono text-[10px] font-bold tracking-widest text-slate-300 transition-colors hover:border-[var(--cyan)]/50 hover:text-[var(--cyan)] disabled:opacity-30"
            >
              ▼ DIVE
            </button>
            <div className="mono w-16 text-center text-[11px] text-[var(--txt)]">
              {r.depth.toFixed(1)} m
            </div>
            <button
              onClick={() => stepDepth(1)}
              disabled={!control.active}
              className="flex-1 border border-[var(--line)] bg-black/30 py-1.5 font-mono text-[10px] font-bold tracking-widest text-slate-300 transition-colors hover:border-[var(--cyan)]/50 hover:text-[var(--cyan)] disabled:opacity-30"
            >
              ▲ SURFACE
            </button>
          </div>
          {control.depthTarget !== null && control.active && (
            <button
              onClick={() => engine.setDepthTarget(null)}
              className="mt-1 w-full border border-[var(--line)] bg-black/30 py-1 font-mono text-[9px] tracking-widest text-[var(--txt-dim)] transition-colors hover:text-slate-300"
            >
              CLEAR HOLD → AUTO DEPTH
            </button>
          )}
        </div>

        <div className="mt-auto space-y-1 border-t border-[var(--line)] pt-2">
          <FieldRow label="HEADING" value={`${Math.round(r.heading)}°`} accent="var(--cyan)" />
          <FieldRow
            label="THRUSTERS"
            value={moving ? "4/4 PROPULSION ACTIVE" : control.active ? "STANDBY" : "AUTOPILOT"}
            accent={moving ? "var(--cyan)" : "var(--txt-dim)"}
          />
          <p className="pt-1 text-[9px] leading-relaxed text-slate-500">
            Drag the pad to steer &amp; throttle. Manual mode pauses the waypoint autopilot; mission
            progress resumes on AUTO PILOT.
          </p>
        </div>
      </div>
    </Panel>
  );
}