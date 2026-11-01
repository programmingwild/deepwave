"use client";

import { useEffect, useRef, useState } from "react";
import { engine } from "@/lib/core/engine";
import { useTelemetry, useClock } from "@/lib/hooks/useTelemetry";
import { Panel, Chip } from "@/components/ui";
import { fmtDuration } from "@/lib/core/utils";
import { assessVisualFrame, DATASET_SOURCES, type VisionAssessment } from "@/lib/core/vision";
import { createOnnxDetector, type OnnxDetector } from "@/lib/core/onnxVision";
import type { Detection } from "@/lib/types";

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

type CamMode = "sim" | "live" | "ip";

export function CameraPanel() {
  const state = useTelemetry();
  const now = useClock();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [liveCam, setLiveCam] = useState(false);
  const [ipCam, setIpCam] = useState(false);
  const [ipUrl, setIpUrl] = useState("");
  const [ipUrlInput, setIpUrlInput] = useState("");
  const [camError, setCamError] = useState<string | null>(null);
  const [visionAssessment, setVisionAssessment] = useState<VisionAssessment | null>(null);
  const [onnxStatus, setOnnxStatus] = useState<"LOADING" | "READY" | "UNAVAILABLE">("LOADING");
  const [onnxDetections, setOnnxDetections] = useState(0);
  const detectorRef = useRef<OnnxDetector | null>(null);
  const modelDetectionsRef = useRef<Detection[]>([]);
  const modeRef = useRef<CamMode>("sim");

  const cam = state.camera;
  const missionTime = fmtDuration(now - state.mission.startedAt);

  const S = (n: number) => (n === 1 ? "" : "S");

  useEffect(() => {
    let cancelled = false;
    createOnnxDetector()
      .then((detector) => {
        if (cancelled) return;
        detectorRef.current = detector;
        setOnnxStatus("READY");
      })
      .catch(() => {
        if (!cancelled) setOnnxStatus("UNAVAILABLE");
      });
    return () => { cancelled = true; };
  }, []);

  // keep mode ref in sync
  useEffect(() => {
    if (liveCam) modeRef.current = "live";
    else if (ipCam) modeRef.current = "ip";
    else modeRef.current = "sim";
  }, [liveCam, ipCam]);

  // phone camera stream management
  useEffect(() => {
    if (!liveCam) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 360 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCamError(null);
      } catch (e: any) {
        setCamError(e?.message ?? "Camera access denied");
        setLiveCam(false);
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [liveCam]);

  // main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const particles: Particle[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 6, vy: -(4 + Math.random() * 10),
      r: 0.6 + Math.random() * 1.6, a: 0.15 + Math.random() * 0.4,
    }));

    const fishes: Fish[] = Array.from({ length: 3 }, () => ({
      x: Math.random() * W, y: 60 + Math.random() * (H - 140),
      vx: 14 + Math.random() * 20, vy: (Math.random() - 0.5) * 4,
      s: 0.7 + Math.random() * 0.8, flip: Math.random() > 0.5,
      phase: Math.random() * Math.PI * 2,
    }));

    const caustics: Caustic[] = Array.from({ length: 8 }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.6,
      r: 20 + Math.random() * 50, speed: 6 + Math.random() * 12,
    }));

    const BLOCK = 16;
    const cols = Math.ceil(W / BLOCK);
    const rows = Math.ceil(H / BLOCK);
    let prevFrame: Uint8ClampedArray | null = null;
    let motionBoxes: { x: number; y: number; w: number; h: number; intensity: number }[] = [];
    let visionFrameCount = 0;

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

    const drawSimulated = () => {
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
        if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
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
        if (f.x > W + 20) { f.x = -20; f.flip = false; }
        if (f.x < -20) { f.x = W + 20; f.flip = true; }
        if (f.y < 30) f.y = 30;
        if (f.y > H - 60) f.y = H - 60;
        drawFish(f, t);
      }

      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

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
        ctx.strokeStyle = "rgba(56,189,248,0.18)";
        ctx.lineWidth = 1;
        const sy = (t * 3) % H;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(W, sy);
        ctx.stroke();
      }
      ctx.restore();
    };

    const detectMotion = (imageData: ImageData) => {
      const data = imageData.data;
      if (!prevFrame) {
        prevFrame = new Uint8ClampedArray(data);
        return;
      }
      const blockDiff: number[][] = [];
      for (let by = 0; by < rows; by++) {
        blockDiff[by] = [];
        for (let bx = 0; bx < cols; bx++) {
          let sum = 0;
          let count = 0;
          for (let y = by * BLOCK; y < Math.min((by + 1) * BLOCK, H); y++) {
            for (let x = bx * BLOCK; x < Math.min((bx + 1) * BLOCK, W); x++) {
              const idx = (y * W + x) * 4;
              const diff = Math.abs(data[idx] - prevFrame[idx]) + Math.abs(data[idx + 1] - prevFrame[idx + 1]) + Math.abs(data[idx + 2] - prevFrame[idx + 2]);
              sum += diff;
              count++;
            }
          }
          blockDiff[by][bx] = count > 0 ? sum / count : 0;
        }
      }
      prevFrame = new Uint8ClampedArray(data);

      const motion: boolean[][] = blockDiff.map((row) => row.map((v) => v > 30));
      const visited: boolean[][] = motion.map((row) => row.map(() => false));
      const boxes: { x: number; y: number; w: number; h: number; intensity: number }[] = [];

      for (let by = 0; by < rows; by++) {
        for (let bx = 0; bx < cols; bx++) {
          if (motion[by][bx] && !visited[by][bx]) {
            let minBx = bx, maxBx = bx, minBy = by, maxBy = by;
            let totalDiff = 0;
            let count = 0;
            const stack: [number, number][] = [[bx, by]];
            visited[by][bx] = true;
            while (stack.length) {
              const [cx, cy] = stack.pop()!;
              minBx = Math.min(minBx, cx); maxBx = Math.max(maxBx, cx);
              minBy = Math.min(minBy, cy); maxBy = Math.max(maxBy, cy);
              totalDiff += blockDiff[cy][cx];
              count++;
              for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && motion[ny][nx] && !visited[ny][nx]) {
                  visited[ny][nx] = true;
                  stack.push([nx, ny]);
                }
              }
            }
            if (count >= 3) {
              boxes.push({
                x: minBx * BLOCK, y: minBy * BLOCK,
                w: (maxBx - minBx + 1) * BLOCK, h: (maxBy - minBy + 1) * BLOCK,
                intensity: totalDiff / count,
              });
            }
          }
        }
      }
      motionBoxes = boxes;
    };

    const drawLiveOrIp = () => {
      const video = videoRef.current;
      const img = imgRef.current;
      let source: CanvasImageSource | null = null;
      if (modeRef.current === "live" && video && video.readyState >= 2) {
        source = video;
      } else if (modeRef.current === "ip" && img && img.complete && img.naturalWidth > 0) {
        source = img;
      }

      if (!source) {
        ctx.fillStyle = "#02101e";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#64748b";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        const msg = modeRef.current === "ip" ? "WAITING FOR IP STREAM..." : "CAMERA STARTING...";
        ctx.fillText(msg, W / 2, H / 2);
        ctx.textAlign = "left";
        return;
      }

      ctx.drawImage(source, 0, 0, W, H);

      try {
        const imageData = ctx.getImageData(0, 0, W, H);
        detectMotion(imageData);
        visionFrameCount += 1;
        if (visionFrameCount % 12 === 0) {
          setVisionAssessment(assessVisualFrame(imageData));
          if (detectorRef.current && visionFrameCount % 30 === 0) {
            void detectorRef.current.detect(imageData).then((detections) => {
              modelDetectionsRef.current = detections;
              setOnnxDetections(detections.length);
            }).catch(() => {
              modelDetectionsRef.current = [];
              setOnnxDetections(0);
            });
          }
        }
      } catch {
        // cross-origin canvas taint — skip motion detection
      }

      for (const box of motionBoxes) {
        const col = box.intensity > 60 ? "rgba(248,113,113," : "rgba(52,211,153,";
        ctx.strokeStyle = col + "0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.fillStyle = col + "0.15)";
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.fillStyle = col + "0.9)";
        ctx.font = "600 10px monospace";
        const label = box.intensity > 60 ? "MOTION" : "LIFE DETECTED";
        const tw = ctx.measureText(label).width + 8;
        ctx.fillRect(box.x, Math.max(0, box.y - 14), tw, 14);
        ctx.fillStyle = "#020d1c";
        ctx.fillText(label, box.x + 4, Math.max(10, box.y - 4));
      }

      for (const detection of modelDetectionsRef.current) {
        const bx = detection.x * W;
        const by = detection.y * H;
        const bw = detection.w * W;
        const bh = detection.h * H;
        ctx.strokeStyle = "rgba(248,113,113,0.95)";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = "rgba(248,113,113,0.85)";
        ctx.font = "600 10px monospace";
        const label = `ONNX ${detection.label} ${detection.conf}%`;
        const tw = ctx.measureText(label).width + 8;
        ctx.fillRect(bx, Math.max(0, by - 14), tw, 14);
        ctx.fillStyle = "#020d1c";
        ctx.fillText(label, bx + 4, Math.max(10, by - 4));
      }

      ctx.strokeStyle = "rgba(56,189,248,0.12)";
      ctx.lineWidth = 1;
      const sy = (t * 3) % H;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
      ctx.stroke();

      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, W, 18);
      ctx.fillStyle = modeRef.current === "ip" ? "#fbbf24" : "#34d399";
      ctx.font = "600 10px monospace";
      ctx.fillText(modeRef.current === "ip" ? "IP CAMERA · MOTION DETECTION" : "LIVE CAMERA · MOTION DETECTION", 6, 13);
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "right";
      ctx.fillText(`${motionBoxes.length} region${motionBoxes.length === 1 ? "" : "s"}`, W - 6, 13);
      ctx.textAlign = "left";
    };

    const frame = () => {
      t += 1;
      const mode = modeRef.current;
      if (mode === "live" || mode === "ip") {
        drawLiveOrIp();
      } else {
        drawSimulated();
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleIpConnect = () => {
    if (!ipUrlInput.trim()) return;
    setIpUrl(ipUrlInput.trim());
    setIpCam(true);
    setLiveCam(false);
    setCamError(null);
  };

  const handleIpDisconnect = () => {
    setIpCam(false);
    setIpUrl("");
    setVisionAssessment(null);
  };

  const proxiedIpUrl = ipUrl
    ? process.env.NEXT_PUBLIC_STATIC_EXPORT === "1"
      ? ipUrl
      : `/api/camera-proxy?url=${encodeURIComponent(ipUrl)}`
    : "";

  return (
    <Panel
      title="LIVE UNDERWATER SURVEILLANCE"
      right={
        <div className="flex items-center gap-2">
          <Chip tone={cam.recording ? "crit" : "default"}>
            <span className={cam.recording ? "rec-dot" : ""}>●</span> {cam.recording ? "REC" : "STANDBY"}
          </Chip>
          <Chip tone={liveCam || ipCam ? "ok" : "default"}>
            {liveCam ? "LIVE CAM" : ipCam ? "IP CAM" : "SIMULATION"}
          </Chip>
        </div>
      }
      className="h-full"
    >
      <div>
        <div className="relative aspect-video w-full overflow-hidden">
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className="block h-full w-full"
          />
          <video ref={videoRef} playsInline muted className="hidden" />
          <img ref={imgRef} src={ipCam ? proxiedIpUrl : undefined} alt="" className="hidden" />

        {/* overlays */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 border border-cyan-400/10" />
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
            {(liveCam || ipCam) ? (ipCam ? "IP CAMERA · MOTION DETECTION" : "LIVE CAMERA · MOTION DETECTION") : "FRAME: " + state.edge.framesPerSec + " FPS · 1080P UPSCALED · H.264 ENCODER"}
          </div>
          <div className="absolute bottom-2 right-2 font-mono text-[10px] text-slate-500">
            ZOOM ×{cam.zoom.toFixed(1)}
          </div>
          {cam.vision && !liveCam && !ipCam && (
            <div className="absolute right-2 top-10 font-mono text-[9px] tracking-widest text-violet-300/90">
              AI DETECTOR: {cam.detections.length} OBJECT{S(cam.detections.length)}
            </div>
          )}
          {camError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <span className="font-mono text-[11px] text-red-400">{camError}</span>
            </div>
          )}
          </div>
        </div>

        {ipCam && visionAssessment && (
          <div className="border-t border-[var(--line)] bg-black/50 px-3 py-2 font-mono text-[10px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="section-label">VISUAL POLLUTION SCREEN</span>
              <span className={visionAssessment.risk === "SUSPECTED_EVENT" ? "text-red-300" : visionAssessment.risk === "WATCH" ? "text-amber-300" : "text-emerald-300"}>
                {visionAssessment.risk.replace("_", " ")} · {visionAssessment.probability}% · CONF {visionAssessment.confidence}%
              </span>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2 text-slate-400">
              <span>MURK {visionAssessment.turbidity}%</span>
              <span>SHEEN {visionAssessment.sheen}%</span>
              <span>DEBRIS {visionAssessment.debris}%</span>
            </div>
            <div className="mt-1 text-slate-300">EVIDENCE: {visionAssessment.evidence.join("; ")}</div>
            <div className="mt-1 text-cyan-300">NEXT: {visionAssessment.instruction}</div>
            <div className="mt-1 text-violet-300">PC ONNX: {onnxStatus} · {onnxDetections} DETECTION{onnxDetections === 1 ? "" : "S"}</div>
          </div>
        )}

        {/* IP camera URL input */}
        {ipCam && (
          <div className="camera-input-row flex items-center gap-2 border-t border-[var(--line)] bg-black/40 px-3 py-2">
            <span className="section-label shrink-0">IP URL</span>
            <input
              type="text"
              value={ipUrl}
              onChange={(e) => setIpUrl(e.target.value)}
              placeholder="http://192.168.1.x:8080/video"
              className="flex-1 bg-black/30 border border-[var(--line)] px-2 py-1 font-mono text-[10px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50"
            />
            <button
              onClick={handleIpDisconnect}
              className="clip-corners border border-red-400/40 bg-red-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-widest text-red-300 transition-all hover:bg-red-500/20"
            >
              DISCONNECT
            </button>
          </div>
        )}

        {!ipCam && (
          <div className="camera-input-row flex items-center gap-2 border-t border-[var(--line)] bg-black/40 px-3 py-2">
            <input
              type="text"
              value={ipUrlInput}
              onChange={(e) => setIpUrlInput(e.target.value)}
              placeholder="IP camera URL (e.g. http://192.168.1.x:8080/video)"
              className="flex-1 bg-black/30 border border-[var(--line)] px-2 py-1 font-mono text-[10px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50"
            />
            <button
              onClick={handleIpConnect}
              disabled={!ipUrlInput.trim()}
              className="clip-corners border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-widest text-amber-300 transition-all hover:bg-amber-500/20 disabled:opacity-30"
            >
              IP CAM
            </button>
          </div>
        )}

        {ipCam && (
          <details className="border-t border-[var(--line)] bg-black/30 px-3 py-2 font-mono text-[10px] text-slate-400">
            <summary className="cursor-pointer text-cyan-300">DATASETS + MODEL INSTRUCTIONS</summary>
            <p className="mt-2 text-slate-500">Use these sources to train a labeled detector. Validate licensing, enhance frames, and confirm visual alerts with water sensors.</p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {DATASET_SOURCES.map((dataset) => (
                <a key={dataset.name} href={dataset.url} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-cyan-300">
                  {dataset.name}: {dataset.use}
                </a>
              ))}
            </div>
          </details>
        )}

        {/* controls */}
        <div className="camera-controls flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-black/40 px-3 py-2">
          <button
            onClick={() => { setLiveCam((v) => !v); if (ipCam) setIpCam(false); }}
            className={`clip-corners border px-3 py-1.5 font-mono text-[10px] font-semibold tracking-widest transition-all ${
              liveCam
                ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                : "border-[var(--line)] bg-black/30 text-slate-300 hover:text-emerald-300"
            }`}
          >
            {liveCam ? "■ STOP LIVE CAM" : "◉ LIVE CAMERA"}
          </button>
          <button
            onClick={() => engine.captureFrame()}
            disabled={liveCam || ipCam}
            className="clip-corners border border-[var(--line)] bg-cyan-400/10 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-widest text-cyan-300 transition-all hover:bg-cyan-400/20 disabled:opacity-30"
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
            disabled={liveCam || ipCam}
            className="clip-corners border border-[var(--line)] bg-black/30 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-widest text-slate-300 transition-all hover:text-[var(--cyan)] disabled:opacity-30"
          >
            ZOOM −
          </button>
          <button
            onClick={() => engine.setZoom(Math.min(6, cam.zoom + 0.5))}
            disabled={liveCam || ipCam}
            className="clip-corners border border-[var(--line)] bg-black/30 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-widest text-slate-300 transition-all hover:text-[var(--cyan)] disabled:opacity-30"
          >
            ZOOM +
          </button>
          <button
            onClick={() => engine.toggleVision()}
            disabled={liveCam || ipCam}
            className={`clip-corners border px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-widest transition-all ${
              cam.vision
                ? "border-violet-400/60 bg-violet-500/15 text-violet-300 shadow-glow"
                : "border-[var(--line)] bg-black/30 text-slate-300 hover:text-violet-300"
            } disabled:opacity-30`}
          >
            {cam.vision ? "◉ AI VISION ON" : "AI VISION OFF"}
          </button>
          <div className="camera-light-control ml-auto flex items-center gap-2">
            <span className="section-label">LIGHT</span>
            <input
              type="range"
              min={0}
              max={100}
              value={cam.light}
              onChange={(e) => engine.setLight(Number(e.target.value))}
              disabled={liveCam || ipCam}
              className="h-1 w-28 accent-cyan-400 disabled:opacity-30"
            />
            <span className="mono w-8 text-right text-[10px] text-cyan-300">{cam.light}%</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}
