# DEEPWAVE — Underwater Environmental Intelligence & Pollution Early Warning System

Command center dashboard for an underwater survey rover (DW-01) that monitors water
quality, processes sensor data on an on-board Raspberry Pi (edge AI), detects abnormal
conditions, and provides early pollution warnings.

> **Data integrity notice**
> The dashboard currently runs on a **simulated telemetry layer**. The
> Environmental Health Score is a **PROTOTYPE composite** (weighted deviation
> score), not a scientifically validated regulatory index. The anomaly model is a
> threshold/rate/baseline-drift detector — it does **not** identify pollutants or
> their source. Live data must be validated before operational use.

---

## Stack

- **Frontend**: Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS
- **Charts**: Recharts
- **Real-time state**: custom telemetry bus (`useSyncExternalStore`-backed)
- **Edge target**: Python · NumPy · Pandas · Scikit-learn on Raspberry Pi

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production
```

## Demo

Click **`▶ ACTIVATE POLLUTION SCENARIO`** (SIMULATION MODE bar). The dashboard
reacts live: turbidity rises, DO drops, conductivity shifts → anomaly probability
climbs → `POTENTIAL POLLUTION EVENT` → health score falls → alert issued →
sampling frequency increases → camera recording starts → events logged. The
scenario self-recovers after ~2.5 minutes.

## Architecture

```
UNDERWATER ROVER
  └─ SENSOR LAYER (pH, turbidity, TDS, temp, EC, DO, salinity)
       └─ DATA ACQUISITION (ADC, I2C/UART)
            └─ RASPBERRY PI
                 └─ EDGE PROCESSING (filtering, normalization, baseline stats)
                      └─ AI ANOMALY DETECTION (threshold + rate + baseline drift)
                           └─ DECISION ENGINE (adaptive sampling, camera policy)
                                └─ COMMUNICATION (WebSocket / MQTT bridge)
                                     └─ DASHBOARD
```

### Data layer (the seam for live data)

- `lib/types.ts` — shared `DashboardState` shape (everything the UI renders).
- `lib/core/bus.ts` — `TelemetryBus` + `TelemetryProvider` interface
  (source label, start/stop, subscribe, getState).
- `lib/core/engine.ts` — `SimulationEngine` (mock provider, implements
  `TelemetryProvider`); produces the full `DashboardState` at 4 Hz.
- `lib/core/anomaly.ts` / `score.ts` — detection and health-score logic,
  deliberately isolated from UI.

**Replacing the mock with live Raspberry Pi data:** implement a
`TelemetryProvider` in front of your WebSocket/MQTT bridge, feed it the same
`DashboardState` shape (or map your wire format to it), and swap the single
`engine` export used by `lib/hooks/useTelemetry.ts`. No UI component changes
required. A recommended wire format is JSON `{ t, values: { ph, turbidity, ... } }`
published per sample at 1 Hz.

## Map of panels

| Panel | File |
| --- | --- |
| Command bar | `components/CommandBar.tsx` |
| Health score gauge | `components/HealthGauge.tsx` |
| Telemetry grid | `components/TelemetryGrid.tsx` |
| AI warning engine | `components/WarningEngine.tsx` |
| Edge AI (Raspberry Pi) | `components/EdgeAIPanel.tsx` |
| Rover telemetry + ROV | `components/RoverPanel.tsx` |
| Camera feed (simulated) | `components/CameraPanel.tsx` |
| Event log | `components/EventLog.tsx` |
| Decision engine | `components/DecisionEngine.tsx` |
| Mission map | `components/MissionMap.tsx` |
| Trend charts | `components/TrendCharts.tsx` |
| Sensor diagnostics | `components/SensorDiagnostics.tsx` |
| Mission energy | `components/PowerPanel.tsx` |
| Data & reporting | `components/ReportPanel.tsx` |
| Alert center | `components/AlertCenter.tsx` |
| System architecture | `components/ArchitecturePanel.tsx` |
| Simulation mode | `components/SimulationControls.tsx` |

## Verification

```bash
npm run test:engine    # data-layer dynamics (score, anomaly pipeline, recovery)
npm run e2e            # headless-browser smoke test (all panels + pollution flow)
```
