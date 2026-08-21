import type {
  AIAssessment,
  CameraState,
  DashboardState,
  Detection,
  EventEntry,
  FleetRoverEntry,
  ForecastPoint,
  ForecastState,
  Formation,
  MissionState,
  ParamId,
  PowerLoad,
  ReplanState,
  RoverId,
  RoverState,
  Sample,
  SensorHealthEntry,
} from "@/lib/types";
import { PARAMS, PARAM_ORDER } from "@/lib/types";
import { TelemetryBus, makeAlert, makeEvent } from "@/lib/core/bus";
import { detectAnomalies, assess } from "@/lib/core/anomaly";
import { computeHealthScore } from "@/lib/core/score";
import {
  clamp,
  clamp01,
  easeOutCubic,
  lerp,
  mulberry32,
} from "@/lib/core/utils";

const TICK_MS = 250;
const RATE_WINDOW_TICKS = 48; // ~12 s smoothed rate (noise floor ~+/-2 /min)
const SPARK_MAX = 90;
const LIVE_SERIES_MAX = 7200; // ~30 min at 4 Hz
const LONG_SERIES_MAX = 10080; // 7 days at 1-minute buckets
const EVENT_CAP = 80;
const ALERT_CAP = 40;

export type SimPhase = "NORMAL" | "RAMP" | "PEAK" | "RECOVERY";

interface PollutionOffsets {
  turbidity: number;
  do: number;
  ec: number;
  salinity: number;
  tds: number;
  temperature: number;
  ph: number;
}

const POLLUTION_TARGETS: Record<ParamId, { kind: "add" | "mul"; amount: number }> = {
  turbidity: { kind: "mul", amount: 3.4 },
  do: { kind: "mul", amount: -0.42 },
  ec: { kind: "mul", amount: 0.24 },
  salinity: { kind: "mul", amount: 0.65 },
  tds: { kind: "mul", amount: 0.38 },
  temperature: { kind: "add", amount: 2.4 },
  ph: { kind: "add", amount: -0.45 },
};

const SENSOR_BASE: Record<ParamId, number> = {
  ph: 7.42,
  turbidity: 4.8,
  tds: 178,
  temperature: 25.1,
  ec: 428,
  do: 7.6,
  salinity: 0.62,
};

export const MISSION_WAYPOINTS: { x: number; y: number }[] = [
  { x: 0.07, y: 0.76 },
  { x: 0.26, y: 0.58 },
  { x: 0.44, y: 0.7 },
  { x: 0.62, y: 0.5 },
  { x: 0.8, y: 0.62 },
  { x: 0.91, y: 0.32 },
  { x: 0.72, y: 0.16 },
  { x: 0.5, y: 0.24 },
  { x: 0.32, y: 0.38 },
  { x: 0.15, y: 0.18 },
  { x: 0.07, y: 0.76 },
];

export const POLLUTION_HOTSPOTS: { x: number; y: number; label: string }[] = [
  { x: 0.62, y: 0.5, label: "HS-01" },
  { x: 0.8, y: 0.62, label: "HS-02" },
];

export const FLEET_IDS: RoverId[] = ["DW-01", "DW-02", "DW-03"];

/** formation offsets in map units, relative to the fleet lead */
const FORMATION_OFFSETS: Record<Formation, Record<RoverId, { x: number; y: number }>> = {
  LINE: {
    "DW-01": { x: 0, y: 0 },
    "DW-02": { x: 0, y: -0.03 },
    "DW-03": { x: 0, y: -0.06 },
  },
  TRIANGLE: {
    "DW-01": { x: 0, y: 0 },
    "DW-02": { x: 0.05, y: -0.035 },
    "DW-03": { x: -0.05, y: -0.035 },
  },
  DIAMOND: {
    "DW-01": { x: 0, y: 0 },
    "DW-02": { x: 0.05, y: 0 },
    "DW-03": { x: -0.05, y: 0 },
  },
};

const FORECAST_HORIZON_MIN = 30;
const REPLAN_COOLDOWN_MS = 45_000;

function buildFleet(): Record<RoverId, FleetRoverEntry> {
  const p0 = MISSION_WAYPOINTS[0];
  const base: Omit<RoverState, "position"> = {
    depth: 8.4,
    speed: 0.4,
    heading: 122,
    pitch: 0,
    roll: 0,
    battery: 82,
    power: 184,
    thrusters: [true, true, true, true],
    headingRate: 0,
  };
  return {
    "DW-01": {
      id: "DW-01",
      role: "LEAD",
      status: "ACTIVE",
      rover: { ...base, position: { x: p0.x, y: p0.y } },
    },
    "DW-02": {
      id: "DW-02",
      role: "WINGMAN",
      status: "SURVEYING",
      rover: { ...base, position: { x: p0.x + 0.05, y: p0.y - 0.035 }, depth: 8.1, battery: 81 },
    },
    "DW-03": {
      id: "DW-03",
      role: "WINGMAN",
      status: "SURVEYING",
      rover: { ...base, position: { x: p0.x - 0.05, y: p0.y - 0.035 }, depth: 8.6, battery: 79 },
    },
  };
}

function buildForecast(now: number): ForecastState {
  const points = Object.fromEntries(
    PARAM_ORDER.map((id) => [
      id,
      Array.from({ length: 7 }, (_, i) => ({
        t: now + i * 5 * 60_000,
        mid: SENSOR_BASE[id],
        low: SENSOR_BASE[id],
        high: SENSOR_BASE[id],
      })) as ForecastPoint[],
    ]),
  ) as Record<ParamId, ForecastPoint[]>;
  return {
    horizonMin: FORECAST_HORIZON_MIN,
    confidence: 87,
    points,
    watch: false,
    watchParam: null,
    watchTMin: null,
    watchMessage: "",
  };
}

const INITIAL_MISSION_MIN = 18 * 60 + 42; // mission clock starts at 18:42

function buildInitialState(now: number): DashboardState {
  const values = { ...SENSOR_BASE } as Record<ParamId, number>;
  const sample: Sample = { t: now, values };
  const history = Object.fromEntries(
    PARAM_ORDER.map((id) => [id, Array(SPARK_MAX).fill(SENSOR_BASE[id])]),
  ) as Record<ParamId, number[]>;

  const sensorHealth = Object.fromEntries(
    PARAM_ORDER.map((id) => [
      id,
      {
        param: id,
        online: true,
        signalQuality: 92,
        lastCalibration: "2026-08-18",
        responseMs: 42,
        availability: 99.6,
        fault: false,
      } satisfies SensorHealthEntry,
    ]),
  ) as Record<ParamId, SensorHealthEntry>;

  const startedAt = now - INITIAL_MISSION_MIN * 60_000;

  const emptyAi: AIAssessment = {
    state: "NORMAL",
    anomalyProbability: 4,
    confidence: 91,
    anomalyCount: 0,
    anomalies: [],
    assessment: "All parameters within expected operating envelope.",
    isPollutionEvent: false,
  };

const fleet = buildFleet();
  const rover: RoverState = fleet["DW-01"].rover;
  return {
    version: 0,
    snapshot: {
      sample,
      rate: Object.fromEntries(PARAM_ORDER.map((id) => [id, 0])) as Record<ParamId, number>,
      history,
    },
    rover,
    fleet,
    selectedRover: "DW-01",
    formation: "TRIANGLE",
    edge: {
      cpu: 38,
      ram: 61,
      temp: 52,
      inferenceMs: 42,
      modelStatus: "RUNNING",
      samplesPerMin: 120,
      localProcessing: true,
      framesPerSec: 14,
    },
    sensors: sensorHealth,
    mission: {
      startedAt,
      distanceKm: 0.38,
      samples: 146,
      anomalies: 3,
      progress: 0.21,
      sector: "LAKE SURVEY - SECTOR A",
      samplingFreqHz: 1.0,
      cameraRecording: false,
      energySaving: false,
    },
    power: {
      thrusters: 92,
      raspberryPi: 6,
      sensors: 8,
      camera: 12,
      lighting: 52,
      communication: 14,
    },
camera: {
      recording: false,
      capturing: false,
      zoom: 1,
      light: 72,
      active: "FRONT",
      vision: false,
      detections: [],
    },
    control: {
      active: false,
      throttle: 0,
      steer: 0,
      depthTarget: null,
    },
    forecast: buildForecast(now),
    replan: {
      active: false,
      reason: "",
      replannedAt: 0,
      plannedPath: [],
      hotSpotTarget: null,
    },
    ai: emptyAi,
    events: [],
    alerts: [],
    recentActivity: "Routine survey underway",
  };
}

export class SimulationEngine {
  readonly sourceLabel = "SIMULATED" as const;
  readonly bus = new TelemetryBus();
  readonly phaseTimeline: { t: number; phase: SimPhase }[] = [];

private state: DashboardState;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tick = 0;
  private snapshotVersion = 0;
  /** cached snapshot: same identity until the next emit (required by useSyncExternalStore) */
  private lastSnapshot: DashboardState;
  /** fleet roster: each member carries its own full RoverState */
  private fleet: Record<RoverId, FleetRoverEntry>;

  // simulation internals
  private rng = mulberry32(1337);
  private drift: Record<ParamId, number> = { ...SENSOR_BASE } as Record<ParamId, number>;
private rateWindow = Object.fromEntries(
    PARAM_ORDER.map((id) => [id, [] as number[]]),
  ) as unknown as Record<ParamId, number[]>;
  private liveSeries = Object.fromEntries(
    PARAM_ORDER.map((id) => [id, [{ t: Date.now(), v: SENSOR_BASE[id] }]]),
  ) as unknown as Record<ParamId, { t: number; v: number }[]>;
  private longSeries = Object.fromEntries(
    PARAM_ORDER.map((id) => [id, [] as { t: number; v: number }[]]),
  ) as unknown as Record<ParamId, { t: number; v: number }[]>;

private phase: SimPhase = "NORMAL";
  private phaseStartedAt = 0;
  private phaseInjected = false;
  private lastEventKeys = new Map<string, number>();
  private lastLongBucket = -1;
  private eventCounter = 0;
  /** hysteresis: keep the system escalated briefly after state drops back */
  private escalationUntil = 0;

constructor() {
    this.state = buildInitialState(Date.now());
    this.fleet = this.state.fleet;
    this.lastSnapshot = { ...this.state, version: 0 } as DashboardState;
    this.backfillLongSeries();
  }

  /* ------------------------------ lifecycle ------------------------------ */

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.step(), TICK_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

subscribe(listener: (state: DashboardState) => void): () => void {
    return this.bus.subscribe(listener);
  }

  /**
   * Returns the cached snapshot - SAME object identity between emits.
   * useSyncExternalStore requires a stable reference; a fresh object per
   * call would trigger an infinite render loop (React error #185).
   */
  getState(): DashboardState {
    return this.lastSnapshot;
  }

  /** Zero-allocation access for hot loops (canvas renderer). */
  peek(): DashboardState {
    return this.state;
  }

  private emit(): void {
    this.snapshotVersion++;
    this.lastSnapshot = { ...this.state, version: this.snapshotVersion } as DashboardState;
    this.bus.emit(this.lastSnapshot);
  }

  /* --------------------------- demo controls ----------------------------- */

  triggerPollution(): void {
    if (this.phase !== "NORMAL") return;
    this.phase = "RAMP";
    this.phaseStartedAt = Date.now();
    this.phaseInjected = true;
    this.addEvent("WARNING", "Pollution simulation triggered", "Manual operator input", "Increase sampling to 2 Hz");
  }

  toggleEnergySaving(): void {
    this.state.mission.energySaving = !this.state.mission.energySaving;
    this.emit();
  }

  setCamera(active: CameraState["active"]): void {
    this.state.camera.active = active;
    this.emit();
  }

  setLight(v: number): void {
    this.state.camera.light = clamp(Math.round(v), 0, 100);
    this.emit();
  }

setZoom(v: number): void {
    this.state.camera.zoom = clamp(v, 1, 6);
    this.emit();
  }

  /* --------------------------- manual joystick ---------------------------- */

  /** Feed joystick axes (-1..1). Only emits when the value moves meaningfully. */
  setJoystick(throttle: number, steer: number): void {
    const c = this.state.control;
    const nt = clamp(throttle, -1, 1);
    const ns = clamp(steer, -1, 1);
    if (Math.abs(nt - c.throttle) < 0.03 && Math.abs(ns - c.steer) < 0.03) return;
    c.throttle = nt;
    c.steer = ns;
    this.emit();
  }

  /** Operator override of the autonomous waypoint autopilot. */
  setManualMode(active: boolean): void {
    const c = this.state.control;
    if (c.active === active) return;
    c.active = active;
    c.throttle = 0;
    c.steer = 0;
    this.addEvent(
      active ? "WARNING" : "INFO",
      active ? "Manual piloting engaged" : "Autonomous mission resumed",
      active ? "Operator override - waypoint autopilot paused" : "Operator released controls",
      active ? "Joystick: throttle / steering / depth hold" : "Resuming survey path",
    );
    this.emit();
  }

  /** Depth hold target in metres (null = automatic depth control). */
  setDepthTarget(target: number | null): void {
    const c = this.state.control;
    c.depthTarget = target === null ? null : clamp(target, 3, 20);
    this.emit();
  }

  /* --------------------------- fleet + AI systems ------------------------- */

  /** Switch which fleet member the telemetry view and joystick control. */
  selectRover(id: RoverId): void {
    if (!this.fleet[id] || this.state.selectedRover === id) return;
    this.state.selectedRover = id;
    this.state.rover = this.fleet[id].rover;
    this.addEvent("INFO", "Telemetry focus switched", `${id} selected as control vessel`, "Joystick + telemetry now bound to this ROV");
    this.emit();
  }

  setFormation(f: Formation): void {
    if (this.state.formation === f) return;
    this.state.formation = f;
    this.addEvent("INFO", "Fleet formation changed", `${f} formation`, "Wingmen repositioning");
    this.emit();
  }

  toggleVision(): void {
    const cam = this.state.camera;
    cam.vision = !cam.vision;
    this.addEvent(cam.vision ? "INFO" : "INFO", cam.vision ? "AI vision engaged" : "AI vision disengaged", cam.vision ? "YOLOv8-lite object detector running on edge" : "Vision overlay disabled", cam.vision ? "Detecting plumes / biology / debris" : "Raw camera feed");
    this.emit();
  }

  /** Recompute the survey path: spiral sweep around the active hotspot, or a full-area grid sweep. */
  triggerReplan(): void {
    const rp = this.state.replan;
    const r = this.state.rover;
    let path: { x: number; y: number }[] = [];
    let hotspot: { x: number; y: number } | null = null;
    if (this.phase !== "NORMAL") {
      const hs = POLLUTION_HOTSPOTS.reduce((best, h) =>
        Math.hypot(h.x - r.position.x, h.y - r.position.y) < Math.hypot(best.x - r.position.x, best.y - r.position.y) ? h : best,
        POLLUTION_HOTSPOTS[0],
      );
      hotspot = { x: hs.x, y: hs.y };
      path = this.spiralPath(hs, r.position);
      rp.reason = `Contamination sweep re-prioritized around ${hs.label}`;
    } else {
      path = this.gridSweepPath();
      rp.reason = "Systematic full-area grid sweep";
    }
    rp.active = true;
    rp.plannedPath = path;
    rp.hotSpotTarget = hotspot;
    rp.replannedAt = Date.now();
    this.addEvent("WARNING", "Mission replanned", rp.reason, "Autopilot following new survey path");
    this.emit();
  }

  private spiralPath(hs: { x: number; y: number }, start: { x: number; y: number }): { x: number; y: number }[] {
    const pts = [{ x: start.x, y: start.y }];
    for (let i = 1; i <= 7; i++) {
      const ang = i * 0.85;
      const rad = 0.04 + i * 0.028;
      pts.push({
        x: clamp(hs.x + Math.cos(ang) * rad, 0.02, 0.98),
        y: clamp(hs.y + Math.sin(ang) * rad, 0.02, 0.98),
      });
    }
    pts.push({ x: hs.x, y: hs.y });
    return pts;
  }

  private gridSweepPath(): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    const rows = 5;
    for (let i = 0; i < rows; i++) {
      const y = 0.14 + (i * 0.72) / (rows - 1);
      pts.push({ x: 0.06, y });
      pts.push({ x: 0.94, y });
    }
    return pts;
  }

  /* --------------------------- prediction -------------------------------- */

  private forecastWatchUntil = 0;

  private stepForecast(now: number): void {
    const f = this.state.forecast;
    const sample = this.state.snapshot.sample;
    const rate = this.state.snapshot.rate;
    let worst: { id: ParamId; breachMin: number } | null = null;

    for (const id of PARAM_ORDER) {
      const def = PARAMS[id];
      const v = sample.values[id];
      const r = rate[id];
      const pts: ForecastPoint[] = [];
      for (let i = 0; i <= 6; i++) {
        const dtMin = i * (FORECAST_HORIZON_MIN / 6);
        const mid = v + r * dtMin;
        const spread = Math.abs(r) * dtMin * 0.55 + def.noise * (1 + dtMin * 0.12);
        pts.push({ t: now + dtMin * 60_000, mid, low: mid - spread, high: mid + spread });
      }
      f.points[id] = pts;

      const end = v + r * FORECAST_HORIZON_MIN;
      if (Math.abs(r) >= def.noise * 0.35 && (end > def.range.max || end < def.range.min)) {
        const tBreach = Math.abs(def.range.max - v) / Math.max(Math.abs(r), 0.001);
        if (end < def.range.min) {
          const tLow = Math.abs(v - def.range.min) / Math.max(Math.abs(r), 0.001);
          if (!worst || tLow < worst.breachMin) worst = { id, breachMin: tLow };
        } else if (!worst || tBreach < worst.breachMin) {
          worst = { id, breachMin: tBreach };
        }
      }
    }

    if (worst) {
      const eventActive = this.state.ai.state !== "NORMAL" || this.state.ai.isPollutionEvent;
      if (eventActive) {
        this.forecastWatchUntil = now + 15000;
        f.watch = true;
        f.watchParam = worst.id;
        f.watchTMin = Math.min(worst.breachMin, FORECAST_HORIZON_MIN);
        f.confidence = clamp(94 - f.watchTMin * 0.9, 62, 94);
        f.watchMessage = `${PARAMS[worst.id].label} projected to breach operating range in ~${Math.max(1, Math.round(f.watchTMin))} min`;
        if (this.cooldown("forecast-watch", REPLAN_COOLDOWN_MS)) {
          this.addEvent("WARNING", "Pre-emptive forecast watch raised", f.watchMessage, "Monitoring cadence increased");
        }
      }
    } else if (now < this.forecastWatchUntil || this.phase !== "NORMAL") {
      f.watch = true;
      f.watchParam = f.watchParam ?? "turbidity";
      f.watchTMin = f.watchTMin ?? FORECAST_HORIZON_MIN;
      f.watchMessage =
        f.watchMessage || `${PARAMS[f.watchParam].label} under elevated risk — extended projection hold`;
    } else {
      f.watch = false;
      f.watchParam = null;
      f.watchTMin = null;
      f.confidence = clamp(f.confidence + 0.4, 87, 96);
      f.watchMessage = "All parameters projected within range";
    }
  }

  /* ----------------------------- fleet sim ------------------------------- */

  private stepFleet(now: number): void {
    const c = this.state.control;
    const sel = this.state.selectedRover;
    const lead = this.state.rover;
    const manual = c.active;

    for (const id of FLEET_IDS) {
      const entry = this.fleet[id];
      const rv = entry.rover;
      if (id === sel) {
        entry.status = "ACTIVE";
        continue;
      }
      if (manual) {
        entry.status = "STANDBY";
        rv.speed = 0;
        rv.thrusters = [false, false, false, false];
        rv.heading = lead.heading;
        rv.depth = clamp(lerp(rv.depth, lead.depth + 0.4, 0.01), 3, 20);
      } else {
        entry.status = "SURVEYING";
        const off = FORMATION_OFFSETS[this.state.formation][id];
        rv.position.x = clamp(lerp(rv.position.x, lead.position.x + off.x, 0.08), 0.02, 0.98);
        rv.position.y = clamp(lerp(rv.position.y, lead.position.y + off.y, 0.08), 0.02, 0.98);
        rv.speed = lead.speed;
        rv.heading = lead.heading;
        rv.depth = clamp(
          lead.depth + (id === "DW-02" ? -0.3 : 0.4) + Math.sin(now / 50_000 + id.charCodeAt(4)) * 0.12,
          3,
          20,
        );
        rv.thrusters = [true, true, true, true];
      }
      rv.power = lead.power;
      rv.pitch = lead.pitch;
      rv.roll = lead.roll;
      rv.battery -= (rv.power / 100) * (TICK_MS / 3600_000) * 2.3;
      rv.battery = clamp(rv.battery, 0, 100);
    }

    // pairwise collision avoidance
    for (let i = 0; i < FLEET_IDS.length; i++) {
      for (let j = i + 1; j < FLEET_IDS.length; j++) {
        const a = this.fleet[FLEET_IDS[i]].rover.position;
        const b = this.fleet[FLEET_IDS[j]].rover.position;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 0.015 && d > 0) {
          const push = (0.015 - d) / 2;
          const nx = (a.x - b.x) / d;
          const ny = (a.y - b.y) / d;
          a.x = clamp(a.x + nx * push, 0, 1);
          a.y = clamp(a.y + ny * push, 0, 1);
          b.x = clamp(b.x - nx * push, 0, 1);
          b.y = clamp(b.y - ny * push, 0, 1);
          if (this.cooldown("avoid", 5000)) {
            this.addEvent("INFO", "Collision avoidance engaged", `${FLEET_IDS[i]} / ${FLEET_IDS[j]} separation enforced`, "Formation adjusted");
          }
        }
      }
    }
  }

  /* ------------------------- vision detections --------------------------- */

  private stepVision(now: number): void {
    const cam = this.state.camera;
    if (!cam.vision) {
      cam.detections = [];
      return;
    }
    const p = this.pollutionProgress(now);
    const dets: Detection[] = [];
    if (p > 0.25) {
      dets.push({
        label: "POLLUTION PLUME",
        x: 0.5 + (this.rng() - 0.5) * 0.08,
        y: 0.3 + (this.rng() - 0.5) * 0.05,
        w: 0.32,
        h: 0.24,
        conf: 62 + p * 34,
      });
    }
    if (p > 0.55) {
      dets.push({
        label: "SUSPENDED SEDIMENT",
        x: 0.22 + (this.rng() - 0.5) * 0.06,
        y: 0.5 + (this.rng() - 0.5) * 0.08,
        w: 0.24,
        h: 0.16,
        conf: 66 + p * 28,
      });
    }
    if (this.rng() > 0.68) {
      dets.push({
        label: "BIOLOGICAL · FISH",
        x: this.rng() * 0.75,
        y: 0.25 + this.rng() * 0.45,
        w: 0.09,
        h: 0.055,
        conf: 55 + this.rng() * 38,
      });
    }
    if (this.rng() > 0.82) {
      dets.push({
        label: "DEBRIS",
        x: this.rng() * 0.8,
        y: 0.45 + this.rng() * 0.4,
        w: 0.06,
        h: 0.05,
        conf: 50 + this.rng() * 30,
      });
    }
    cam.detections = dets;
    this.state.edge.inferenceMs = Math.round(34 + p * 24 + dets.length * 6 + (this.rng() - 0.5) * 8);
    void now;
  }

  toggleRecording(): void {
    this.state.camera.recording = !this.state.camera.recording;
    this.state.mission.cameraRecording = this.state.camera.recording;
    this.emit();
  }

  captureFrame(): void {
    this.state.camera.capturing = true;
    this.addEvent("INFO", "Camera frame captured", "Front camera", "Frame stored to local buffer");
    this.emit();
    setTimeout(() => {
      this.state.camera.capturing = false;
      this.emit();
    }, 1200);
  }

  acknowledgeAlert(id: string): void {
    const a = this.state.alerts.find((x) => x.id === id);
    if (a) {
      a.read = true;
      this.emit();
    }
  }

acknowledgeAllAlerts(): void {
    for (const a of this.state.alerts) a.read = true;
    this.emit();
  }

  /** Simulates a sensor failure for ~10 s, then auto-recovers. */
  simulateSensorFault(id: ParamId): void {
    const s = this.state.sensors[id];
    if (!s || s.fault) return;
    s.fault = true;
    s.online = false;
    s.signalQuality = 8;
    s.availability = Math.max(40, s.availability - 45);
    this.addEvent("WARNING", "Sensor fault detected", `${PARAMS[id].label} sensor lost signal`, "Restarting sensor channel");
    this.emit();
    setTimeout(() => {
      const cur = this.state.sensors[id];
      cur.fault = false;
      cur.online = true;
      cur.signalQuality = 94;
      cur.availability = Math.min(99.8, cur.availability + 50);
      this.addEvent("INFO", "Sensor recovered", `${PARAMS[id].label} signal restored`, "Resuming normal sampling");
      this.emit();
    }, 10_000);
  }

  clearAlerts(): void {
    this.state.alerts = [];
    this.emit();
  }

  clearEvents(): void {
    this.state.events = [];
    this.emit();
  }

  /* ------------------------------ simulation ----------------------------- */

  private backfillLongSeries(): void {
    const now = Date.now();
    const rng = mulberry32(777);
    const base: Record<ParamId, number> = { ...SENSOR_BASE };
    const current: Record<ParamId, number> = { ...base };
    const minute = 60_000;
    for (let i = 7 * 24 * 60; i >= 0; i--) {
      const t = now - i * minute;
      const driftV = new Map<ParamId, number>();
      for (const id of PARAM_ORDER) {
        const def = PARAMS[id];
        const w = (rng() - 0.5) * def.noise * 6;
        current[id] += w;
        current[id] = clamp(current[id], def.range.min, def.range.max);
        driftV.set(id, current[id]);
      }
      if (i % 30 === 0) {
        // occasional ambient excursion in history for realistic trend charts
        if (rng() > 0.82) {
          current.turbidity += 3 + rng() * 6;
          current.do -= 0.6 + rng() * 0.8;
          current.ec += 40 + rng() * 60;
        }
      }
      for (const id of PARAM_ORDER) {
        this.longSeries[id].push({ t, v: current[id] });
      }
    }
    for (const id of PARAM_ORDER) {
      this.longSeries[id] = this.longSeries[id].slice(-LONG_SERIES_MAX);
    }
  }

  private step(): void {
    this.tick++;
    const now = Date.now();
    const dt = TICK_MS / 1000;

    this.advancePollutionPhase(now);

// slow ambient drift + noise (kept below anomaly trigger thresholds)
    for (const id of PARAM_ORDER) {
      const def = PARAMS[id];
      const w = (this.rng() - 0.5) * def.noise * 0.3;
      this.drift[id] += w;
      // gentle pull back toward baseline
      this.drift[id] = lerp(this.drift[id], SENSOR_BASE[id], 0.004);
      this.drift[id] = clamp(this.drift[id], def.range.min, def.range.max);
    }

    const offset = this.pollutionOffset(now);
    const values = {} as Record<ParamId, number>;
    for (const id of PARAM_ORDER) {
      const def = PARAMS[id];
      let v = this.drift[id];
      if (offset[id] !== 0) {
        const t = POLLUTION_TARGETS[id];
        if (t.kind === "add") {
          v = v + offset[id];
        } else if (t.amount > 0) {
          v = v * (1 + offset[id] / v);
        } else {
          v = v * (1 + offset[id] / Math.max(0.1, v));
        }
      }
v += (this.rng() - 0.5) * def.noise * 0.25;
      // sensor fault: readings go noisy/unstable until the channel recovers
      if (this.state.sensors[id].fault) v += (this.rng() - 0.5) * def.noise * 8;
      values[id] = clamp(v, def.range.min - def.range.max * 0.3, def.range.max * 1.4);
    }

    const sample: Sample = { t: now, values };
    const prevValues = this.state.snapshot.sample.values;

    // rate of change per minute
    for (const id of PARAM_ORDER) {
      const win = this.rateWindow[id];
      win.push(values[id]);
      if (win.length > RATE_WINDOW_TICKS) win.shift();
    }
const rate = {} as Record<ParamId, number>;
    for (const id of PARAM_ORDER) {
      const win = this.rateWindow[id];
      // least-squares slope over the window (robust vs. endpoint jitter)
      const n = win.length;
      let perSec = 0;
      if (n >= 8) {
        let sx = 0, sy = 0, sxy = 0, sxx = 0;
        for (let i = 0; i < n; i++) {
          sx += i;
          sy += win[i];
          sxy += i * win[i];
          sxx += i * i;
        }
        const denom = n * sxx - sx * sx;
        perSec = denom > 0 ? (n * sxy - sx * sy) / denom : 0;
      }
      rate[id] = perSec * 60;
    }

    this.state.snapshot.sample = sample;
    this.state.snapshot.rate = rate;
    for (const id of PARAM_ORDER) {
      const hist = this.state.snapshot.history[id];
      hist.push(values[id]);
      if (hist.length > SPARK_MAX) hist.shift();
      this.liveSeries[id].push({ t: now, v: values[id] });
      if (this.liveSeries[id].length > LIVE_SERIES_MAX) this.liveSeries[id].shift();
    }

    // minute-resolution long series
    const bucket = Math.floor(now / 60_000);
    if (bucket !== this.lastLongBucket) {
      this.lastLongBucket = bucket;
      for (const id of PARAM_ORDER) {
        this.longSeries[id].push({ t: now, v: values[id] });
        if (this.longSeries[id].length > LONG_SERIES_MAX) this.longSeries[id].shift();
      }
    }

// anomaly detection + AI assessment
    const faultySensors = PARAM_ORDER.filter((id) => this.state.sensors[id].fault);
    const anomalies = detectAnomalies(sample, rate, SENSOR_BASE, faultySensors);
    const ai = assess(anomalies, { sample, rate, baseline: SENSOR_BASE });
    this.state.ai = ai;

    // hysteresis: hold escalation for 12s after conditions normalize,
    // so the system does not flap between NORMAL and ANOMALY every tick
    if (ai.state !== "NORMAL") this.escalationUntil = now + 12_000;
    const effectiveState =
      ai.state === "NORMAL" && now < this.escalationUntil ? "PARAMETER_CHANGE" : ai.state;

    // adaptive sampling frequency
    const baseFreq = this.state.mission.energySaving ? 0.5 : 1.0;
    const freq =
      effectiveState === "ALERT" ? 2.0 : effectiveState === "ANOMALY" ? 1.5 : baseFreq;
    this.state.mission.samplingFreqHz = freq;
    this.state.edge.samplesPerMin = Math.round(freq * 60);
    this.state.edge.inferenceMs = Math.round(38 + this.rng() * 18 + (ai.anomalyCount > 0 ? 14 : 0));

// events + alerts derived from state transitions
    this.deriveEvents(ai, sample, now, effectiveState);
    this.deriveAlerts(ai, sample, now);

// rover + power
    this.state.rover = this.fleet[this.state.selectedRover].rover;
    this.stepRover(now, ai);
    this.stepFleet(now);
    this.stepForecast(now);
    this.stepVision(now);
    this.stepEdge(now);

    // autonomous replanning around a live contamination event
    const rp = this.state.replan;
    if (ai.isPollutionEvent && !rp.active && this.cooldown("auto-replan", REPLAN_COOLDOWN_MS)) {
      this.triggerReplan();
    } else if (rp.active && this.phase === "NORMAL" && this.cooldown("replan-clear", REPLAN_COOLDOWN_MS)) {
      rp.active = false;
      rp.plannedPath = [];
      rp.hotSpotTarget = null;
      this.addEvent("INFO", "Survey path restored", "Contamination cleared - standard waypoint route resumed", "Autopilot back on nominal path");
    }

    this.emit();
  }

  /* ------------------------- pollution scripting ------------------------- */

  private advancePollutionPhase(now: number): void {
    if (this.phase === "NORMAL") return;
    const el = now - this.phaseStartedAt;
    if (this.phase === "RAMP" && el > 45_000) {
      this.phase = "PEAK";
      this.phaseStartedAt = now;
      this.addEvent("CRITICAL", "Pollution event at peak intensity", "Multi-parameter anomaly sustained", "Camera recording active");
    } else if (this.phase === "PEAK" && el > 22_000) {
      this.phase = "RECOVERY";
      this.phaseStartedAt = now;
      this.addEvent("INFO", "Pollution event receding", "Parameters returning to baseline", "Resuming standard sampling");
    } else if (this.phase === "RECOVERY" && el > 75_000) {
      this.phase = "NORMAL";
      this.phaseInjected = false;
      this.addEvent("INFO", "Pollution simulation complete", "All parameters within envelope", "System restored to NORMAL");
    }
    this.phaseTimeline.push({ t: now, phase: this.phase });
    if (this.phaseTimeline.length > 200) this.phaseTimeline.shift();
  }

private pollutionOffset(now: number): Record<ParamId, number> {
    const zero = { turbidity: 0, do: 0, ec: 0, salinity: 0, tds: 0, temperature: 0, ph: 0 } as Record<ParamId, number>;
    const p = this.pollutionProgress(now);
    if (p === 0) return zero;
    const out = { ...zero } as Record<ParamId, number>;
    for (const id of PARAM_ORDER) {
      const t = POLLUTION_TARGETS[id];
      const base = SENSOR_BASE[id];
      out[id] = t.kind === "add" ? t.amount * p : base * t.amount * p;
    }
    return out;
  }

  /** 0..1 intensity of the pollution script at time `now`. */
  private pollutionProgress(now: number): number {
    if (this.phase === "NORMAL") return 0;
    const el = now - this.phaseStartedAt;
    switch (this.phase) {
      case "RAMP":
        return easeOutCubic(clamp01(el / 45_000));
      case "PEAK":
        return 1;
      case "RECOVERY":
        return 1 - clamp01(el / 75_000);
      default:
        return 0;
    }
  }

  /* ----------------------- event + alert derivation ---------------------- */

  private cooldown(key: string, ms: number): boolean {
    const last = this.lastEventKeys.get(key) ?? 0;
    const now = Date.now();
    if (now - last < ms) return false;
    this.lastEventKeys.set(key, now);
    return true;
  }

  private addEvent(level: EventEntry["level"], title: string, detail?: string, action?: string): void {
    const e = makeEvent({ level, title, detail, action });
    this.state.events.push(e);
    if (this.state.events.length > EVENT_CAP) this.state.events.shift();
    this.emit();
  }

private deriveEvents(ai: AIAssessment, sample: Sample, now: number, effectiveState: AIAssessment["state"]): void {
    const anomalies = ai.anomalies;
    for (const a of anomalies) {
const key = `param-${a.param}`;
      if (this.cooldown(key, 20_000)) {
        const label = PARAMS[a.param].label.toLowerCase();
        const dir = a.direction === "up" ? "increase" : "deviation";
        this.addEvent(
          a.level,
          `${label} ${dir} detected`,
          `${PARAMS[a.param].label}: ${sample.values[a.param].toFixed(PARAMS[a.param].decimals)} ${PARAMS[a.param].unit}`,
          "Monitoring trend",
        );
        this.state.mission.anomalies += 1;
      }
    }

    if (ai.isPollutionEvent && this.cooldown("multiparam", 20_000)) {
      this.addEvent(
        "CRITICAL",
        "Multi-parameter anomaly confirmed",
        ai.assessment,
        "Escalating to adaptive monitoring",
      );
    }

if (effectiveState === "ANOMALY" || effectiveState === "ALERT") {
      if (this.cooldown("sampling-up", 30_000)) {
        this.addEvent("WARNING", "Sampling frequency increased", `${this.state.mission.samplingFreqHz.toFixed(1)} Hz`, "Adaptive sampling");
      }
      if (!this.state.camera.recording && this.cooldown("cam-start", 30_000)) {
        this.state.camera.recording = true;
        this.state.mission.cameraRecording = true;
        this.addEvent("WARNING", "Camera recording triggered", "Anomaly escalation", "Recording in progress");
      }
    }

    if (effectiveState === "NORMAL" && this.state.camera.recording && this.cooldown("cam-stop", 30_000)) {
      this.state.camera.recording = false;
      this.state.mission.cameraRecording = false;
      this.addEvent("INFO", "Camera recording stopped", "Conditions normalized", "Recording archived");
    }

    // event log timestamp is generated by makeEvent with real now
    void now;
  }

  private deriveAlerts(ai: AIAssessment, sample: Sample, now: number): void {
    for (const a of ai.anomalies) {
      const key = `alert-${a.param}`;
      if (this.cooldown(key, 25_000)) {
        const def = PARAMS[a.param];
        const alert = makeAlert({
          level: a.level,
          title: a.level === "CRITICAL" ? "Multi-parameter anomaly detected" : `${def.label} deviation detected`,
          param: a.param,
          value: sample.values[a.param],
          expectedRange: `${def.range.min}-${def.range.max} ${def.unit}`,
          assessment: ai.assessment,
          action:
            ai.state === "ALERT"
              ? "Alert operator + record event + mark location"
              : "Increase sampling frequency",
          ts: now,
        });
        this.state.alerts.unshift(alert);
        if (this.state.alerts.length > ALERT_CAP) this.state.alerts.pop();
        this.recentActivity = `Alert: ${alert.title}`;
      }
    }
  }

  private set recentActivity(v: string) {
    this.state.recentActivity = v;
  }

  /* --------------------------- rover + power ----------------------------- */

private stepRover(now: number, ai: AIAssessment): void {
    const r = this.state.rover;
    const m = this.state.mission;
    const c = this.state.control;

    if (c.active) {
      // MANUAL PILOTING: joystick drives heading + translation.
      // Waypoint autopilot is paused; mission progress stays frozen.
      const stepSec = TICK_MS / 1000;
      const rad = (r.heading * Math.PI) / 180;
      const spd01 = c.throttle * 0.018; // full map width in ~55 s
      r.position.x = clamp(r.position.x + Math.sin(rad) * spd01 * stepSec, 0, 1);
      r.position.y = clamp(r.position.y - Math.cos(rad) * spd01 * stepSec, 0, 1);
      r.heading = (((r.heading + c.steer * 30 * stepSec) % 360) + 360) % 360;
      r.headingRate = c.steer * 30;
      r.speed = Math.abs(c.throttle) * (m.energySaving ? 0.32 : 0.42);
      r.pitch = -c.throttle * 2.5 + (this.rng() - 0.5) * 0.8;
      r.roll = c.steer * 3 + (this.rng() - 0.5) * 0.6;

      if (c.depthTarget !== null) {
        r.depth = clamp(r.depth + Math.sign(c.depthTarget - r.depth) * 0.35 * stepSec, 3, 20);
      } else {
        r.depth = 8.2 + Math.sin(now / 60_000) * 0.6 + (this.rng() - 0.5) * 0.15;
        r.depth = clamp(r.depth, 3, 20);
      }

      const thrustOn = Math.abs(c.throttle) > 0.05 || Math.abs(c.steer) > 0.05;
      r.thrusters = [thrustOn, thrustOn, thrustOn, thrustOn];
      this.state.power.thrusters = Math.round(26 + 66 * Math.abs(c.throttle));
      m.distanceKm += (Math.abs(c.throttle) * (m.energySaving ? 0.3 : 0.42) * stepSec) / 1000;
      r.battery -= Math.abs(c.throttle) * 0.012 * stepSec;

      this.state.recentActivity =
        Math.abs(c.throttle) > 0.15 || Math.abs(c.steer) > 0.15
          ? "Manual piloting - operator control"
          : "Manual piloting - station keeping";

      // manual mode: skip the autonomous branches below
    } else {
      // advance along mission path
      const speedMps = m.energySaving ? 0.3 : 0.42;
      m.distanceKm += (speedMps * (TICK_MS / 1000)) / 1000;
      m.progress = clamp((m.distanceKm / 1.8) * 100, 0, 100);

      const rp = this.state.replan;
      const pos =
        rp.active && rp.plannedPath.length > 0
          ? this.pathPositionOn(rp.plannedPath, m.progress / 100)
          : this.pathPosition(m.progress / 100);
      r.position = pos;
      r.speed = speedMps * (m.energySaving ? 0.75 : 1);
      r.heading += (this.rng() - 0.5) * 2.4;
      r.heading = ((r.heading % 360) + 360) % 360;
      r.headingRate = 0;
      r.pitch = (this.rng() - 0.5) * 1.2;
      r.roll = (this.rng() - 0.5) * 0.8;
      r.depth = 8.2 + Math.sin(now / 60_000) * 0.6 + (this.rng() - 0.5) * 0.15;
      r.depth = clamp(r.depth, 3, 20);
    }

    // battery + power (shared)
    const saving = m.energySaving ? 0.78 : 1;
    const power =
      (this.state.power.thrusters +
        this.state.power.raspberryPi +
        this.state.power.sensors +
        this.state.power.camera +
        this.state.power.lighting +
        this.state.power.communication) *
      saving;
    r.power = Math.round(power);
    r.battery -= (power / 100) * (TICK_MS / 3600_000) * 2.4;
    r.battery = clamp(r.battery, 0, 100);

    if (!c.active) {
      const throttle = m.energySaving ? 0.72 : 1;
      const thrustOn = this.rng() > 0.08;
      r.thrusters = [thrustOn, thrustOn, thrustOn, thrustOn];
    }

    // mission samples increment
    const added = m.samplingFreqHz * (TICK_MS / 1000);
    this.sampleAccum += added;
    while (this.sampleAccum >= 1) {
      this.sampleAccum -= 1;
      m.samples += 1;
    }

    // power distribution shifts under load
    if (!c.active) this.state.power.thrusters = Math.round(92 * (r.speed / 0.42));
    this.state.power.lighting = Math.round(52 * (this.state.camera.light / 100));
    this.state.power.camera = Math.round(12 + (this.state.camera.recording ? 6 : 0));

    if (!c.active) {
      this.state.recentActivity =
        ai.isPollutionEvent
          ? "Pollution event - alerting operator"
          : ai.state !== "NORMAL"
            ? "Adaptive monitoring engaged"
            : "Routine survey underway";
    }

    void now;
  }

  private sampleAccum = 0;

private stepEdge(now: number): void {
    const e = this.state.edge;
    const visionLoad = this.state.camera.vision ? 7 : 0;
    e.cpu = clamp(e.cpu + (this.rng() - 0.5) * 6 + visionLoad, 12, 96);
    e.ram = clamp(e.ram + (this.rng() - 0.5) * 2, 40, 92);
    e.temp = clamp(48 + e.cpu * 0.16 + (this.rng() - 0.5) * 1.5, 38, 85);
    e.framesPerSec = Math.round(13 + this.rng() * 4);
    if (this.state.ai.state === "ALERT") e.cpu = clamp(e.cpu + 6, 0, 100);
    e.modelStatus = this.phaseInjected ? "RUNNING" : "RUNNING";
    void now;
  }

/** Interpolate rover position along the mission path. */
  pathPosition(progress01: number): { x: number; y: number } {
    return this.pathPositionOn(MISSION_WAYPOINTS, progress01);
  }

  pathPositionOn(pts: { x: number; y: number }[], progress01: number): { x: number; y: number } {
    const lens: number[] = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      lens.push(d);
      total += d;
    }
    if (total === 0) return pts[0] ?? { x: 0, y: 0 };
    let target = clamp01(progress01) * total;
    for (let i = 0; i < lens.length; i++) {
      if (target <= lens[i]) {
        const t = lens[i] === 0 ? 0 : target / lens[i];
        return {
          x: lerp(pts[i].x, pts[i + 1].x, t),
          y: lerp(pts[i].y, pts[i + 1].y, t),
        };
      }
      target -= lens[i];
    }
    return pts[pts.length - 1];
  }

  /* ----------------------------- data access ----------------------------- */

  getLiveSeries(param: ParamId): { t: number; v: number }[] {
    return this.liveSeries[param];
  }

  getLongSeries(param: ParamId): { t: number; v: number }[] {
    return this.longSeries[param];
  }

  getSparkline(param: ParamId): number[] {
    return this.state.snapshot.history[param];
  }

  getPhase(): SimPhase {
    return this.phase;
  }

  isSimulatingPollution(): boolean {
    return this.phase !== "NORMAL";
  }
}
export const engine = new SimulationEngine();
