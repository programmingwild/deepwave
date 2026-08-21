export type ParamId =
  | "ph"
  | "turbidity"
  | "tds"
  | "temperature"
  | "ec"
  | "do"
  | "salinity";

export type Level = "INFO" | "NORMAL" | "WARNING" | "CRITICAL";
export type Status = "NORMAL" | "GOOD" | "WARNING" | "CRITICAL" | "FAULT";

export interface Range {
  min: number;
  max: number;
}

export interface ParamDef {
  id: ParamId;
  label: string;
  unit: string;
  range: Range;
  /** ideal mid-point for scoring */
  target: number;
  /** sensitivity of the value (scoring weight) */
  weight: number;
  color: string;
  decimals: number;
  /** faster dynamic range keeps a healthy steady state */
  noise: number;
  refLabel: string;
}

export const PARAMS: Record<ParamId, ParamDef> = {
  ph: {
    id: "ph",
    label: "pH",
    unit: "",
    range: { min: 6.5, max: 8.5 },
    target: 7.5,
    weight: 0.18,
    color: "#22d3ee",
    decimals: 2,
    noise: 0.02,
    refLabel: "6.5–8.5",
  },
  turbidity: {
    id: "turbidity",
    label: "TURBIDITY",
    unit: "NTU",
    range: { min: 0, max: 30 },
    target: 5,
    weight: 0.18,
    color: "#34d399",
    decimals: 1,
    noise: 0.4,
    refLabel: "0–30",
  },
  tds: {
    id: "tds",
    label: "TDS",
    unit: "mg/L",
    range: { min: 0, max: 500 },
    target: 180,
    weight: 0.12,
    color: "#a78bfa",
    decimals: 0,
    noise: 3,
    refLabel: "0–500",
  },
  temperature: {
    id: "temperature",
    label: "TEMPERATURE",
    unit: "°C",
    range: { min: 20, max: 32 },
    target: 25,
    weight: 0.1,
    color: "#fbbf24",
    decimals: 1,
    noise: 0.06,
    refLabel: "20–32",
  },
  ec: {
    id: "ec",
    label: "CONDUCTIVITY",
    unit: "µS/cm",
    range: { min: 200, max: 900 },
    target: 420,
    weight: 0.12,
    color: "#38bdf8",
    decimals: 0,
    noise: 6,
    refLabel: "200–900",
  },
  do: {
    id: "do",
    label: "DISSOLVED OXYGEN",
    unit: "mg/L",
    range: { min: 4.5, max: 10 },
    target: 7.5,
    weight: 0.22,
    color: "#34d399",
    decimals: 1,
    noise: 0.05,
    refLabel: "4.5–10",
  },
  salinity: {
    id: "salinity",
    label: "SALINITY",
    unit: "PSU",
    range: { min: 0, max: 2 },
    target: 0.6,
    weight: 0.08,
    color: "#f472b6",
    decimals: 2,
    noise: 0.006,
    refLabel: "0–2",
  },
};

export const PARAM_ORDER: ParamId[] = [
  "ph",
  "turbidity",
  "tds",
  "temperature",
  "ec",
  "do",
  "salinity",
];

export interface Sample {
  t: number;
  values: Record<ParamId, number>;
}

export interface TelemetrySnapshot {
  sample: Sample;
  /** rate of change per minute per param (latest) */
  rate: Record<ParamId, number>;
  /** small ring buffer of recent values for sparklines (oldest first) */
  history: Record<ParamId, number[]>;
}

export interface ParamAnomaly {
  param: ParamId;
  value: number;
  deviationPct: number;
  direction: "up" | "down";
  level: Level;
}

export interface AIAssessment {
  state: "NORMAL" | "PARAMETER_CHANGE" | "ANOMALY" | "RISK" | "ALERT";
  anomalyProbability: number;
  confidence: number;
  anomalyCount: number;
  anomalies: ParamAnomaly[];
  assessment: string;
  isPollutionEvent: boolean;
}

export interface RoverState {
  depth: number;
  speed: number;
  heading: number;
  pitch: number;
  roll: number;
  battery: number;
  power: number;
  thrusters: [boolean, boolean, boolean, boolean];
  position: { x: number; y: number };
  headingRate: number;
}

export interface EdgeState {
  cpu: number;
  ram: number;
  temp: number;
  inferenceMs: number;
  modelStatus: "RUNNING" | "WARMUP" | "FAULT";
  samplesPerMin: number;
  localProcessing: boolean;
  framesPerSec: number;
}

export interface EventEntry {
  id: string;
  ts: number;
  level: Level;
  title: string;
  detail?: string;
  action?: string;
  param?: ParamId;
}

export interface AlertEntry {
  id: string;
  ts: number;
  level: Level;
  title: string;
  param?: ParamId;
  value?: number;
  expectedRange?: string;
  assessment?: string;
  action?: string;
  read: boolean;
}

export interface SensorHealthEntry {
  param: ParamId;
  online: boolean;
  signalQuality: number;
  lastCalibration: string;
  responseMs: number;
  availability: number;
  fault: boolean;
}

export interface MissionState {
  startedAt: number;
  distanceKm: number;
  samples: number;
  anomalies: number;
  progress: number;
  sector: string;
  samplingFreqHz: number;
  cameraRecording: boolean;
  energySaving: boolean;
}

export interface PowerLoad {
  thrusters: number;
  raspberryPi: number;
  sensors: number;
  camera: number;
  lighting: number;
  communication: number;
}

export interface CameraState {
  recording: boolean;
  capturing: boolean;
  zoom: number;
  light: number;
  active: "FRONT" | "STARBOARD" | "PORT";
  /** edge AI vision overlay on the camera feed */
  vision: boolean;
  /** live detection boxes produced by the simulated vision model */
  detections: Detection[];
}

export interface ManualControlState {
  /** operator override of the autonomous waypoint autopilot */
  active: boolean;
  /** joystick Y axis: -1 = full astern, +1 = full ahead */
  throttle: number;
  /** joystick X axis: -1 = full port, +1 = full starboard */
  steer: number;
  /** depth hold target in metres, null = automatic depth */
  depthTarget: number | null;
}

export type RoverId = "DW-01" | "DW-02" | "DW-03";
export type Formation = "LINE" | "TRIANGLE" | "DIAMOND";

export interface FleetRoverEntry {
  id: RoverId;
  role: "LEAD" | "WINGMAN";
  status: "ACTIVE" | "SURVEYING" | "STANDBY" | "FAULT";
  rover: RoverState;
}

export interface ForecastPoint {
  t: number;
  mid: number;
  low: number;
  high: number;
}

export interface ForecastState {
  /** prediction horizon in minutes ahead of the latest sample */
  horizonMin: number;
  /** 0-100 model confidence on the latest projection */
  confidence: number;
  /** projected trajectory from now to now+horizon, per parameter */
  points: Record<ParamId, ForecastPoint[]>;
  /** pre-emptive watch raised when a parameter is projected to breach its range */
  watch: boolean;
  watchParam: ParamId | null;
  /** minutes until the projected breach */
  watchTMin: number | null;
  watchMessage: string;
}

export interface ReplanState {
  active: boolean;
  reason: string;
  replannedAt: number;
  /** newly computed survey path the autopilot follows */
  plannedPath: { x: number; y: number }[];
  hotSpotTarget: { x: number; y: number } | null;
}

export interface Detection {
  label: string;
  x: number; // 0-1 relative to frame
  y: number;
  w: number;
  h: number;
  conf: number; // 0-100
}

export interface DashboardState {
  /** monotonic emit counter — changes identity on every engine tick */
  version: number;
  snapshot: TelemetrySnapshot;
  rover: RoverState;
  edge: EdgeState;
  sensors: Record<ParamId, SensorHealthEntry>;
  mission: MissionState;
  power: PowerLoad;
  camera: CameraState;
  control: ManualControlState;
  fleet: Record<RoverId, FleetRoverEntry>;
  selectedRover: RoverId;
  formation: Formation;
  forecast: ForecastState;
  replan: ReplanState;
  ai: AIAssessment;
  events: EventEntry[];
  alerts: AlertEntry[];
  recentActivity: string;
}

export type SimPhase =
  | "NORMAL"
  | "POLLUTION_RAMP"
  | "POLLUTION_PEAK"
  | "RECOVERY";
