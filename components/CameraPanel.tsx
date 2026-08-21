"use client";

import { useEffect, useRef } from "react";
import { engine } from "@/lib/core/engine";
import { useTelemetry, useClock } from "@/lib/hooks/useTelemetry";
import { Panel, Chip } from "@/components/ui";
import { fmtDuration } from "@/lib/core/utils";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
}
interface Fish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: number;
  flip: boolean;
  phase: number;
}
interface Caustic {
  x: number;
  y: number;
  r: number;
  speed: number;
}

export function CameraPanel() {
  const state = useTelemetry();
  const now = useClock();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cam = state.camera;
  const missionTime = fmtDuration(now - state.mission.startedAt);

  const S = (n: number) => (n === 1 ? "" : "S");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const particles: Particle[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 6,
      vy: -(4 + Math.random() * 10),
      r: 0.6 + Math.random() * 1.6,
      a: 0.15 + Math.random() * 0.4,
    }));

    const fishes: Fish[] = Array.from({ length: 3 }, () => ({
      x: Math.random() * W,
      y: 60 + Math.random() * (H - 140),
      vx: 14 + Math.random() * 20,
      vy: (Math.random() - 0.5) * 4,
      s: 0.7 + Math.random() * 0.8,
      flip: Math.random() > 0.5,
      phase: Math.random() * Math.PI * 2,
    }));

    const caustics: Caustic[] = Array.from({ length: 8 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.6,
      r: 20 + Math.random() * 50,
      speed: 6 + Math.random() * 12,
    }));

    let raf = 0;
    let t = 0;

    const drawFish = (f: Fish, time: number) => {
      ctx.save();
      ctx.translate(f.x, f.y + Math.sin(time * 0.002 + f.phase) * 4);
      ctx.scale(f.flip ? -f.s : f.s, f.s);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.quadraticCurveTo(2, -5, -8, -2);
      ctx.quadraticCurveTo(-4, 0, -8, 2);
      ctx.quadraticCurveTo(2, 5, 10, 0);
      ctx.fillStyle = "rgba(125,211,252,0.35)";
      ctx.fill();
      ctx.strokeStyle = "rgba(125,211,252,0.5)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();
    };

    const frame = () => {
      t += 1;
      const g = engine.peek().camera;
      const light = g.light / 100;
      const zoom = g.zoom;

      ctx.save();
      ctx.fillStyle = "#02101e";
      ctx.fillRect(0, 0, W, H);

      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#04202f");
      grad.addColorStop(0.55, "#031627");
      grad.addColorStop(1, "#020d1a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.globalAlpha = 0.1 * light;
      for (const c of caustics) {
        c.x += c.speed * 0.02;
        if (c.x > W + c.r) c.x = -c.r;
        ctx.beginPath();
        ctx.ellipse(c.x + Math.sin(t * 0.01) * 8, c.y + Math.sin(t * 0.02 + c.x) * 5, c.r * 0.8, c.r * 0.35, 0.3, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(56,189,248,0.9)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      const cone = ctx.createLinearGradient(0, 0, 0, H);
      cone.addColorStop(0, `rgba(125,211,252,${0.16 * light})`);
      cone.addColorStop(1, "rgba(125,211,252,0)");
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 60 - Math.sin(t * 0.005) * 30, 0);
      ctx.lineTo(W / 2 + 60 + Math.cos(t * 0.006) * 30, 0);
      ctx.lineTo(W / 2 + 190, H);
      ctx.lineTo(W / 2 - 190, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.save();
      for (const p of particles) {
        p.x += p.vx * 0.02;
        p.y += p.vy * 0.02;
        if (p.y < -5) {
          p.y = H + 5;
          p.x = Math.random() * W;
        }
        if (p.x < -5) p.x = W + 5;
        if (p.x > W + 5) p.x = -5;
        ctx.globalAlpha = p.a * light + 0.06;
        ctx.fillStyle = "#a5f3fc";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.fillStyle = "#04121f";
      ctx.beginPath();
      ctx.moveTo(0, H - 34);
      for (let x = 0; x <= W; x += 14) {
        ctx.lineTo(x, H - 34 - Math.sin(x * 0.02 + t * 0.003) * 8);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(15,42,66,0.8)";
      for (const rx of [40, 150, 300, 460, 600]) {
        const rw = 18 + ((rx * 7) % 20);
        ctx.beginPath();
        ctx.ellipse(rx + Math.sin(t * 0.002 + rx) * 3, H - 30, rw, 9, 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(52,211,153,0.28)";
      ctx.lineWidth = 2;
      for (const kx of [90, 230, 370, 520, 640]) {
        ctx.beginPath();
        for (let y = 0; y < 46; y++) {
          const yy = H - 30 - y;
          const xx = kx + Math.sin(y * 0.16 + t * 0.02) * 7;
          if (y === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
      ctx.restore();

      for (const f of fishes) {
        f.x += f.vx * 0.02 * (zoom / 1.5);
        f.y += f.vy * 0.02 + Math.sin(t * 0.01 + f.phase) * 0.15;
        if (f.x > W + 20) {
          f.x = -20;
          f.flip = false;
        }
        if (f.x < -20) {
          f.x = W + 20;
          f.flip = true;
        }
        if (f.y < 30) f.y = 30;
        if (f.y > H - 60) f.y = H - 60;
        drawFish(f, t);
      }

      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      // edge AI vision overlay: detection boxes + labels
      if (g.vision && g.detections.length) {
        for (const d of g.detections) {
          const bx = d.x * W;
          const by = d.y * H;
          const bw = d.w * W;
          const bh = d.h * H;
          const col = d.label.startsWith("POLLUTION") ? "rgba(248,113,113," : d.label.startsWith("DEBRIS") ? "rgba(251,191,36," : "rgba(34,211,238,";
          ctx.strokeStyle = col + "0.9)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx, by, bw, bh);
          ctx.fillStyle = col + "0.2)";
          ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = col + "0.9)";
          ctx.font = "600 10px monospace";
          const label = `${d.label} ${Math.round(d.conf)}%`;
          const tw = ctx.measureText(label).width + 8;
          ctx.fillRect(bx, Math.max(0, by - 14), tw, 14);
          ctx.fillStyle = "#020d1c";
          ctx.fillText(label, bx + 4, Math.max(10, by - 4));
        }
        // scanline sweep
        ctx.strokeStyle = "rgba(56,189,248,0.18)";
        ctx.lineWidth = 1;
        const sy = (t * 3) % H;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(W, sy);
        ctx.stroke();
      }

      ctx.restore();
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Panel
      title="LIVE UNDERWATER SURVEILLANCE"
      right={
        <div className="flex items-center gap-2">
          <Chip tone={cam.recording ? "crit" : "default"}>
            <span className={cam.recording ? "rec-dot" : ""}>●</span> {cam.recording ? "REC" : "STANDBY"}
          </Chip>
          <Chip>SIMULATION / CAMERA FEED</Chip>
        </div>
      }
      className="h-full"
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          className="block h-auto w-full"
        />

        {/* overlays */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 border border-cyan-400/10" />
          {/* crosshair */}
          <div className="absolute left-1/2 top-1/2 h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-cyan-400/30" />
          <div className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-cyan-400/30" />

          <div className="absolute left-2 top-2 flex items-center gap-3 font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-red-400">
              <span className={`h-2 w-2 rounded-full bg-red-500 ${cam.recording ? "rec-dot" : "opacity-30"}`} />
              REC
            </span>
            <span className="text-slate-300">DEPTH: {state.rover.depth.toFixed(1)} m</span>
          </div>
          <div className="absolute right-2 top-2 text-right font-mono text-[11px] text-slate-300">
            <div>MISSION TIME: {missionTime}</div>
            <div>CAMERA: {cam.active}</div>
            <div>LIGHT: {cam.light}%</div>
          </div>
          <div className="absolute bottom-2 left-2 font-mono text-[10px] text-slate-500">
            FRAME: {state.edge.framesPerSec} FPS · 1080P UPSCALED · H.264 ENCODER
          </div>
          <div className="absolute bottom-2 right-2 font-mono text-[10px] text-slate-500">
            ZOOM ×{cam.zoom.toFixed(1)}
          </div>
          {cam.vision && (
            <div className="absolute right-2 top-10 font-mono text-[9px] tracking-widest text-violet-300/90">
              AI DETECTOR: {cam.detections.length} OBJECT{S(cam.detections.length)}
            </div>
          )}
        </div>

        {/* controls */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-black/40 px-3 py-2">
          <button
            onClick={() => engine.captureFrame()}
            className="clip-corners border border-[var(--line)] bg-cyan-400/10 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-widest text-cyan-300 transition-all hover:bg-cyan-400/20"
          >
            {cam.capturing ? "CAPTURED" : "● CAPTURE"}
          </button>
          <button
            onClick={() => engine.toggleRecording()}
            className={`clip-corners border px-3 py-1.5 font-mono text-[10px] font-semibold tracking-widest transition-all ${
              cam.recording
                ? "border-red-400/60 bg-red-500/15 text-red-300"
                : "border-[var(--line)] bg-black/30 text-slate-300 hover:text-red-300"
            }`}
          >
            {cam.recording ? "■ STOP REC" : "● RECORD"}
          </button>
          <button
            onClick={() => engine.setZoom(Math.max(1, cam.zoom - 0.5))}
            className="clip-corners border border-[var(--line)] bg-black/30 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-widest text-slate-300 transition-all hover:text-[var(--cyan)]"
          >
            ZOOM −
          </button>
          <button
            onClick={() => engine.setZoom(Math.min(6, cam.zoom + 0.5))}
            className="clip-corners border border-[var(--line)] bg-black/30 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-widest text-slate-300 transition-all hover:text-[var(--cyan)]"
          >
            ZOOM +
          </button>
          <button
            onClick={() => engine.toggleVision()}
            className={`clip-corners border px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-widest transition-all ${
              cam.vision
                ? "border-violet-400/60 bg-violet-500/15 text-violet-300 shadow-glow"
                : "border-[var(--line)] bg-black/30 text-slate-300 hover:text-violet-300"
            }`}
          >
            {cam.vision ? "◉ AI VISION ON" : "AI VISION OFF"}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="section-label">LIGHT</span>
            <input
              type="range"
              min={0}
              max={100}
              value={cam.light}
              onChange={(e) => engine.setLight(Number(e.target.value))}
              className="h-1 w-28 accent-cyan-400"
            />
            <span className="mono w-8 text-right text-[10px] text-cyan-300">{cam.light}%</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}