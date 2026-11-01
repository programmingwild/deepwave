"use client";

import { useEffect } from "react";
import { engine } from "@/lib/core/engine";
import { useMounted } from "@/lib/hooks/useTelemetry";
import { CommandBar } from "@/components/CommandBar";
import { HealthGauge } from "@/components/HealthGauge";
import { TelemetryGrid } from "@/components/TelemetryGrid";
import { WarningEngine } from "@/components/WarningEngine";
import { EdgeAIPanel } from "@/components/EdgeAIPanel";
import { RoverPanel } from "@/components/RoverPanel";
import { JoystickControl } from "@/components/JoystickControl";
import { FleetPanel } from "@/components/FleetPanel";
import { DigitalTwin } from "@/components/DigitalTwin";
import { HardwareCircuit } from "@/components/HardwareCircuit";
import { CameraPanel } from "@/components/CameraPanel";
import { EventLog } from "@/components/EventLog";
import { DecisionEngine } from "@/components/DecisionEngine";
import { MissionMap } from "@/components/MissionMap";
import { TrendCharts } from "@/components/TrendCharts";
import { SensorDiagnostics } from "@/components/SensorDiagnostics";
import { PowerPanel } from "@/components/PowerPanel";
import { ReportPanel } from "@/components/ReportPanel";
import { AlertCenter } from "@/components/AlertCenter";
import { ArchitecturePanel } from "@/components/ArchitecturePanel";
import { SimulationControls } from "@/components/SimulationControls";
import { HardwarePanel } from "@/components/HardwarePanel";
import { AIPredictionPanel } from "@/components/AIPredictionPanel";
import { Panel } from "@/components/ui";

export default function Page() {
  const mounted = useMounted();

  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, []);

  if (!mounted) {
    return (
      <div className="grid-bg flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="mono text-2xl font-bold tracking-[0.3em] text-[var(--cyan)] text-glow">
          DEEPWAVE
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] tracking-widest text-slate-400">
          <span className="h-2 w-2 animate-pulseSoft rounded-full bg-[var(--cyan)]" />
          TELEMETRY BUS STARTUP
        </div>
      </div>
    );
  }

  return (
    <div className="grid-bg min-h-screen pb-10">
      <CommandBar />

      <main className="pb-safe px-safe mx-auto max-w-[1600px] space-y-3 p-3 sm:p-4">
        <SimulationControls />

        {/* hero: health score + telemetry */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[320px_1fr]">
          <Panel
            title="ENVIRONMENTAL HEALTH"
            right={<span className="mono text-[9px] tracking-widest text-slate-500">PROTOTYPE INDEX</span>}
            className="h-full"
          >
            <HealthGauge />
          </Panel>
          <TelemetryGrid />
        </div>

        {/* warning engine + edge AI */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <WarningEngine />
          <EdgeAIPanel />
        </div>

        {/* rover + camera + joystick */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_270px]">
          <RoverPanel />
          <CameraPanel />
          <div className="md:col-span-2 xl:col-span-1">
            <JoystickControl />
          </div>
        </div>

        {/* hardware link — arduino rover (direct COM port via web serial) */}
        <HardwarePanel />

        {/* mission map + event log + decision engine */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_1fr]">
          <MissionMap />
          <EventLog />
        </div>
        <DecisionEngine />

        {/* digital twin + fleet */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <DigitalTwin />
          <HardwareCircuit />
          <FleetPanel />
        </div>

        {/* trend analysis */}
        <TrendCharts />

        {/* AI pollution prediction */}
        <AIPredictionPanel />

        {/* diagnostics + power + report */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SensorDiagnostics />
          <PowerPanel />
          <div className="md:col-span-2 xl:col-span-1">
            <ReportPanel />
          </div>
        </div>

        {/* alert center + architecture */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <AlertCenter />
          <ArchitecturePanel />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3 text-[9px] tracking-wider text-slate-600">
          <span className="font-mono">
            DEEPWAVE v1.0 · UNDERWATER ENVIRONMENTAL INTELLIGENCE &amp; POLLUTION EARLY WARNING
          </span>
          <span className="font-mono">
            DATA SOURCE: <span className="text-amber-300">SIMULATED</span> · HEALTH SCORE IS A PROTOTYPE
            COMPOSITE, NOT A REGULATORY INDEX · POLLUTANT/SOURCE IDENTIFICATION NOT IMPLEMENTED
          </span>
        </footer>
      </main>
    </div>
  );
}