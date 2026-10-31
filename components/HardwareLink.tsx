"use client";

import { useEffect, useState } from "react";

type Reading = { distance: number; speed: number; state: string; ts: number };

export function HardwareLink() {
  const [reading, setReading] = useState<Reading | null>(null);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const ch = new BroadcastChannel("deepwave-hw");
    ch.onmessage = (e) => {
      const r = e.data as Reading;
      if (r && typeof r.distance === "number") {
        setReading(r);
        setLinked(true);
      }
    };
    const stale = setInterval(() => {
      setReading((cur) => (cur && Date.now() - cur.ts > 3000 ? null : cur));
      setLinked((l) => (reading && Date.now() - reading.ts > 3000 ? false : l));
    }, 1000);
    return () => {
      clearInterval(stale);
      ch.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = reading && reading.distance > 0 && reading.distance < 15;

  return (
    <div
      className="pointer-events-none fixed bottom-3 right-3 z-50 flex flex-col items-end gap-1"
      style={{ fontFamily: "var(--font-jetbrains, monospace)" }}
    >
      <div
        className="pointer-events-auto rounded border px-3 py-2 text-[11px] tracking-wider backdrop-blur-md"
        style={{
          borderColor: linked ? "rgba(52,211,153,0.4)" : "rgba(34,211,238,0.25)",
          background: "rgba(6,13,28,0.75)",
          color: linked ? "#34d399" : "#64748b",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: linked ? "#34d399" : "#64748b",
              boxShadow: linked ? "0 0 8px #34d399" : "none",
            }}
          />
          {linked ? "HARDWARE LINKED" : "NO HARDWARE LINK"}
        </div>
        {linked && reading && (
          <div className="mt-1 mono text-[10px]" style={{ color: "#e0f2fe" }}>
            SONAR {reading.distance.toFixed(1)} cm · {reading.state} · THR {reading.speed}
            {close && <span style={{ color: "#fbbf24", marginLeft: 6 }}>⚠ CLOSE</span>}
          </div>
        )}
        {!linked && (
          <div className="mt-1 text-[9px]" style={{ color: "#64748b" }}>
            open hardware-bridge.html → CONNECT
          </div>
        )}
      </div>
    </div>
  );
}
