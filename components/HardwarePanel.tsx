"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, Chip, FieldRow } from "@/components/ui";

type Reading = { distance: number; speed: number; state: string; ts: number };

export function HardwarePanel() {
  const [supported] = useState(() => typeof navigator !== "undefined" && "serial" in navigator);
  const [connected, setConnected] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const writerRef = useRef<any>(null);
  const readingRef = useRef(false);

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
    pushLog("disconnected");
  }, [pushLog]);

  const connect = useCallback(async () => {
    if (!supported) return;
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
              if (parts.length < 3) { pushLog("bad: " + line); continue; }
              const dist = parseFloat(parts[0]);
              const speed = parseInt(parts[1], 10);
              const state = parts[2];
              if (isNaN(dist)) continue;
              setReading({ distance: dist, speed: isNaN(speed) ? 0 : speed, state, ts: Date.now() });
              if (dist > 0 && dist < 15) pushLog("⚠ CLOSE OBJECT @ " + dist.toFixed(1) + " cm");
            }
          }
        } catch (e: any) {
          pushLog("read error: " + (e?.message ?? e));
        }
      })();
    } catch (e: any) {
      pushLog("connect failed: " + (e?.message ?? e));
      setConnected(false);
    }
  }, [supported, pushLog]);

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
    return () => {
      readingRef.current = false;
      try { readerRef.current?.cancel(); } catch {}
      try { writerRef.current?.releaseLock(); } catch {}
      try { portRef.current?.close(); } catch {}
    };
  }, []);

  const close = reading && reading.distance > 0 && reading.distance < 15;
  const stale = reading && Date.now() - reading.ts > 3000;

  return (
    <Panel
      title="HARDWARE LINK — ARDUINO ROVER"
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
              disabled={!supported}
              className="clip-corners border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-mono text-[11px] font-bold tracking-widest text-cyan-300 transition-all hover:bg-cyan-400/20 disabled:opacity-30"
            >
              ◉ CONNECT (COM PORT)
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

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded border border-[var(--line)] bg-black/30 px-2 py-2 text-center">
            <div className="section-label">SONAR</div>
            <div
              className="mono text-[18px] font-bold"
              style={{ color: reading && !stale ? "var(--cyan)" : "var(--txt-dim)" }}
            >
              {reading && !stale ? reading.distance.toFixed(1) : "—"}
            </div>
            <div className="mono text-[9px] text-slate-500">cm</div>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/30 px-2 py-2 text-center">
            <div className="section-label">THRUSTER</div>
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
                  reading?.state === "FWD"
                    ? "var(--health)"
                    : reading?.state === "REV"
                    ? "var(--warn)"
                    : "var(--txt-dim)",
              }}
            >
              {reading && !stale ? reading.state : "—"}
            </div>
            <div className="mono text-[9px] text-slate-500">
              {close ? "⚠ CLOSE" : "OK"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => send("F")}
            disabled={!connected}
            className="flex-1 border border-[var(--line)] bg-black/30 py-1.5 font-mono text-[10px] font-bold tracking-widest text-slate-300 transition-colors hover:border-[var(--cyan)]/50 hover:text-[var(--cyan)] disabled:opacity-30"
          >
            ▲ FWD
          </button>
          <button
            onClick={() => send("R")}
            disabled={!connected}
            className="flex-1 border border-[var(--line)] bg-black/30 py-1.5 font-mono text-[10px] font-bold tracking-widest text-slate-300 transition-colors hover:border-[var(--cyan)]/50 hover:text-[var(--cyan)] disabled:opacity-30"
          >
            ▼ REV
          </button>
          <button
            onClick={() => send("S")}
            disabled={!connected}
            className="flex-1 border border-[var(--line)] bg-black/30 py-1.5 font-mono text-[10px] font-bold tracking-widest text-slate-300 transition-colors hover:border-[var(--crit)]/50 hover:text-[var(--crit)] disabled:opacity-30"
          >
            ■ STOP
          </button>
          <button
            onClick={() => send("A")}
            disabled={!connected}
            className="flex-1 border border-[var(--line)] bg-black/30 py-1.5 font-mono text-[10px] font-bold tracking-widest text-slate-300 transition-colors hover:border-[var(--warn)]/50 hover:text-[var(--warn)] disabled:opacity-30"
          >
            ◎ AUTO
          </button>
        </div>

        <div className="max-h-24 overflow-auto rounded border border-[var(--line)] bg-black/30 p-2 font-mono text-[9px] text-slate-500">
          {log.length === 0 ? "— no events —" : log.map((l, i) => <div key={i}>{l}</div>)}
        </div>

        <p className="text-[9px] leading-relaxed text-slate-500">
          Connects directly to the Arduino over the COM port via Web Serial (Chrome/Edge only). No separate bridge page needed. Keep the Arduino IDE Serial Monitor closed while connected.
        </p>
      </div>
    </Panel>
  );
}
