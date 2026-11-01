"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, Chip, FieldRow } from "@/components/ui";
import { engine } from "@/lib/core/engine";
import { useClock } from "@/lib/hooks/useTelemetry";

type Reading = { ph: number | null; turbidity: number | null; tds: number | null; distance: number; level: number | null; speed: number; state: string; ts: number };

export function HardwarePanel() {
  const [supported] = useState(() => typeof navigator !== "undefined" && "serial" in navigator);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const writerRef = useRef<any>(null);
  const readingRef = useRef(false);
  useClock();

  const pushLog = useCallback((m: string) => {
    setLog((prev) => [...prev.slice(-40), m]);
  }, []);

  const disconnect = useCallback(async () => {
    readingRef.current = false;
    try { await readerRef.current?.cancel(); } catch {}
    try { writerRef.current?.releaseLock(); } catch {}
    try { await portRef.current?.close(); } catch {}
    portRef.current = null;
    readerRef.current = null;
    writerRef.current = null;
    setConnected(false);
    setReading(null);
    engine.clearHardwareReadings();
    engine.setHardwareMotion(null);
    pushLog("disconnected");
  }, [pushLog]);

  const connect = useCallback(async () => {
    if (!supported || connecting || connected) return;
    setConnecting(true);
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      writerRef.current = port.writable.getWriter();
      readerRef.current = port.readable.getReader();
      readingRef.current = true;
      setConnected(true);
      pushLog("connected @ 9600 baud");

      const dec = new TextDecoder();
      let buf = "";
      (async () => {
        try {
          while (readingRef.current) {
            const { value, done } = await readerRef.current.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, i).trim();
              buf = buf.slice(i + 1);
              if (!line || line.startsWith("DEEPWAVE")) {
                if (line) pushLog("» " + line);
                continue;
              }
              const parts = line.split(",");
              // New format: ph,turbidity,tds,distance,level,speed,state (7 fields)
              // Legacy:     dist,level,speed,state (4 fields) or dist,speed,state (3 fields)
              let ph: number | null = null;
              let turbidity: number | null = null;
              let tds: number | null = null;
              let dist = NaN;
              let level: number | null = null;
              let speed = 0;
              let state = parts[parts.length - 1];
              if (parts.length >= 7) {
                ph = parseFloat(parts[0]); if (isNaN(ph)) ph = null;
                turbidity = parseFloat(parts[1]); if (isNaN(turbidity)) turbidity = null;
                tds = parseFloat(parts[2]); if (isNaN(tds)) tds = null;
                dist = parseFloat(parts[3]);
                level = parseFloat(parts[4]); if (isNaN(level)) level = null;
                speed = parseInt(parts[5], 10); if (isNaN(speed)) speed = 0;
              } else if (parts.length >= 4) {
                dist = parseFloat(parts[0]);
                level = parseFloat(parts[1]); if (isNaN(level)) level = null;
                speed = parseInt(parts[2], 10); if (isNaN(speed)) speed = 0;
              } else {
                dist = parseFloat(parts[0]);
                speed = parseInt(parts[1], 10); if (isNaN(speed)) speed = 0;
              }
              if (isNaN(dist)) continue;
              const r: Reading = { ph, turbidity, tds, distance: dist, level, speed, state, ts: Date.now() };
              setReading(r);
              engine.setHardwareMotion(r);
              // feed real water-quality readings into the dashboard engine
              const hw: Partial<Record<"ph" | "turbidity" | "tds", number>> = {};
              if (ph !== null) hw.ph = ph;
              if (turbidity !== null) hw.turbidity = turbidity;
              if (tds !== null) hw.tds = tds;
              if (Object.keys(hw).length) engine.setHardwareReadings(hw as any);
              else if (ph === null && turbidity === null && tds === null) {
                /* keep existing override if any; only clear when explicitly disconnected */
              }
              if (dist > 0 && dist < 15) pushLog("⚠ CLOSE OBJECT @ " + dist.toFixed(1) + " cm");
              if (level !== null && level < 30) pushLog("⚠ LOW LEVEL " + level.toFixed(0) + "%");
            }
          }
        } catch (e: any) {
          pushLog("read error: " + (e?.message ?? e));
        }
      })();
    } catch (e: any) {
      pushLog("connect failed: " + (e?.message ?? e));
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [connected, connecting, supported, pushLog]);

  const send = useCallback(
    async (cmd: string) => {
      if (!writerRef.current) return;
      try {
        await writerRef.current.write(new TextEncoder().encode(cmd));
        pushLog("« " + cmd);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
      } catch (e: any) {
        pushLog("write error: " + (e?.message ?? e));
      }
    },
    [pushLog]
  );

  useEffect(() => {
    if (!supported || typeof navigator === "undefined") return;
    const serial = (navigator as any).serial;
    const onSerialDisconnect = (event: Event) => {
      const port = (event as any).port;
      if (port === portRef.current) void disconnect();
    };
    serial.addEventListener("disconnect", onSerialDisconnect);
    return () => {
      serial.removeEventListener("disconnect", onSerialDisconnect);
      readingRef.current = false;
      try { readerRef.current?.cancel(); } catch {}
      try { writerRef.current?.releaseLock(); } catch {}
      try { portRef.current?.close(); } catch {}
    };
  }, [disconnect, supported]);

  const lowLevel = reading && reading.level !== null && reading.level < 30;
  const stale = reading && Date.now() - reading.ts > 3000;

  return (
    <Panel
      title="HARDWARE LINK — WATER QUALITY NODE"
      right={
        <Chip tone={connected ? "ok" : "default"}>
          {connected ? "LINKED · COM" : "DISCONNECTED"}
        </Chip>
      }
      className="h-full"
    >
      <div className="space-y-3 p-4">
        {!supported && (
          <div className="rounded border border-amber-400/30 bg-amber-400/5 p-3 text-[11px] text-amber-300">
            Web Serial not supported in this browser. Use Chrome or Edge.
          </div>
        )}

        <div className="flex items-center gap-2">
          {!connected ? (
            <button
              onClick={connect}
              disabled={!supported || connecting}
              className="clip-corners border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-mono text-[11px] font-bold tracking-widest text-cyan-300 transition-all hover:bg-cyan-400/20 disabled:opacity-30"
            >
              {connecting ? "… OPENING COM PORT" : "◉ CONNECT (COM PORT)"}
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="clip-corners border border-red-400/40 bg-red-500/10 px-4 py-2 font-mono text-[11px] font-bold tracking-widest text-red-300 transition-all hover:bg-red-500/20"
            >
              ✕ DISCONNECT
            </button>
          )}
          <span className="section-label">
            {connected ? "9600 BAUD · ARDUINO UNO" : "NO PORT OPEN"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded border border-[var(--line)] bg-black/30 px-2 py-2 text-center">
            <div className="section-label">DISTANCE</div>
            <div
              className="mono text-[18px] font-bold"
              style={{ color: reading && !stale ? "var(--cyan)" : "var(--txt-dim)" }}
            >
              {reading && !stale ? reading.distance.toFixed(1) : "—"}
            </div>
            <div className="mono text-[9px] text-slate-500">cm to surface</div>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/30 px-2 py-2 text-center">
            <div className="section-label">WATER LEVEL</div>
            <div
              className="mono text-[18px] font-bold"
              style={{
                color:
                  reading && reading.level !== null && reading.level < 30
                    ? "var(--crit)"
                    : reading && reading.level !== null && reading.level > 85
                    ? "var(--warn)"
                    : "var(--health)",
              }}
            >
              {reading && !stale && reading.level !== null ? reading.level.toFixed(0) + "%" : "—"}
            </div>
            <div className="mono text-[9px] text-slate-500">tank fill</div>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/30 px-2 py-2 text-center">
            <div className="section-label">PUMP</div>
            <div
              className="mono text-[18px] font-bold"
              style={{ color: reading && reading.speed > 0 ? "var(--cyan)" : "var(--txt-dim)" }}
            >
              {reading && !stale ? reading.speed : "—"}
            </div>
            <div className="mono text-[9px] text-slate-500">0–255</div>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/30 px-2 py-2 text-center">
            <div className="section-label">STATE</div>
            <div
              className="mono text-[14px] font-bold"
              style={{
                color:
                  reading?.state === "PUMPING"
                    ? "var(--cyan)"
                    : reading?.state === "IDLE"
                    ? "var(--health)"
                    : "var(--txt-dim)",
              }}
            >
              {reading && !stale ? reading.state : "—"}
            </div>
            <div className="mono text-[9px] text-slate-500">
              {reading && reading.level !== null && reading.level < 30 ? "⚠ LOW" : "OK"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded border border-[var(--line)] bg-black/30 px-2 py-2 text-center">
            <div className="section-label">pH</div>
            <div className="mono text-[18px] font-bold" style={{ color: reading && !stale && reading.ph !== null ? "var(--cyan)" : "var(--txt-dim)" }}>
              {reading && !stale && reading.ph !== null ? reading.ph.toFixed(2) : "—"}
            </div>
            <div className="mono text-[9px] text-slate-500">0–14</div>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/30 px-2 py-2 text-center">
            <div className="section-label">TURBIDITY</div>
            <div className="mono text-[18px] font-bold" style={{ color: reading && !stale && reading.turbidity !== null ? "var(--health)" : "var(--txt-dim)" }}>
              {reading && !stale && reading.turbidity !== null ? reading.turbidity.toFixed(1) : "—"}
            </div>
            <div className="mono text-[9px] text-slate-500">NTU</div>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/30 px-2 py-2 text-center">
            <div className="section-label">TDS</div>
            <div className="mono text-[18px] font-bold" style={{ color: reading && !stale && reading.tds !== null ? "#a78bfa" : "var(--txt-dim)" }}>
              {reading && !stale && reading.tds !== null ? Math.round(reading.tds) : "—"}
            </div>
            <div className="mono text-[9px] text-slate-500">mg/L</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => send("P")}
            disabled={!connected}
            className="flex-1 border border-[var(--line)] bg-black/30 py-1.5 font-mono text-[10px] font-bold tracking-widest text-slate-300 transition-colors hover:border-[var(--cyan)]/50 hover:text-[var(--cyan)] disabled:opacity-30"
          >
            ▶ PUMP ON
          </button>
          <button
            onClick={() => send("O")}
            disabled={!connected}
            className="flex-1 border border-[var(--line)] bg-black/30 py-1.5 font-mono text-[10px] font-bold tracking-widest text-slate-300 transition-colors hover:border-[var(--crit)]/50 hover:text-[var(--crit)] disabled:opacity-30"
          >
            ■ PUMP OFF
          </button>
          <button
            onClick={() => send("A")}
            disabled={!connected}
            className="flex-1 border border-[var(--line)] bg-black/30 py-1.5 font-mono text-[10px] font-bold tracking-widest text-slate-300 transition-colors hover:border-[var(--warn)]/50 hover:text-[var(--warn)] disabled:opacity-30"
          >
            ◎ AUTO
          </button>
          <button
            onClick={() => send("T20")}
            disabled={!connected}
            className="flex-1 border border-[var(--line)] bg-black/30 py-1.5 font-mono text-[10px] font-bold tracking-widest text-slate-300 transition-colors hover:border-[var(--health)]/50 hover:text-[var(--health)] disabled:opacity-30"
          >
            TANK 20cm
          </button>
        </div>

        <div className="max-h-24 overflow-auto rounded border border-[var(--line)] bg-black/30 p-2 font-mono text-[9px] text-slate-500">
          {log.length === 0 ? "— no events —" : log.map((l, i) => <div key={i}>{l}</div>)}
        </div>

        <p className="text-[9px] leading-relaxed text-slate-500">
          Reads pH, turbidity, TDS, water level and pump state directly from the Arduino over the COM port (Web Serial, Chrome/Edge only). Real pH/turbidity/TDS values override the simulated telemetry in the dashboard above. Keep the Arduino IDE Serial Monitor closed while connected.
        </p>
      </div>
    </Panel>
  );
}
