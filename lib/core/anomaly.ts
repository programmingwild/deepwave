import type {
  AIAssessment,
  ParamAnomaly,
  ParamId,
  Range,
  Sample,
  Status,
} from "@/lib/types";
import { PARAMS, PARAM_ORDER } from "@/lib/types";
import { clamp, clamp01 } from "@/lib/core/utils";

const RATE_LIMITS: Partial<Record<ParamId, number>> = {
  ph: 0.12,
  turbidity: 2.5,
  tds: 25,
  temperature: 0.4,
  ec: 40,
  do: 0.35,
  salinity: 0.04,
};

/** sustained deviation from the calibrated baseline, in % of baseline */
const BASELINE_DEVIATION_PCT: Record<ParamId, number> = {
  ph: 3,
  turbidity: 60,
  tds: 20,
  temperature: 8,
  ec: 20,
  do: 25,
  salinity: 30,
};

/**
 * Edge anomaly detector.
 *
 * This is a lightweight, explainable model suitable for a Raspberry Pi:
 * threshold + rate-of-change + baseline-drift checks over a rolling
 * baseline. It detects "something is changing outside the expected
 * envelope" - it does NOT identify the pollutant or the source. That
 * would require a trained classifier plus calibration data we do not have.
 */
export function detectAnomalies(
  sample: Sample,
  rate: Record<ParamId, number>,
  baseline: Record<ParamId, number>,
  exclude: ParamId[] = [],
): ParamAnomaly[] {
  const out: ParamAnomaly[] = [];

  for (const id of PARAM_ORDER) {
    if (exclude.includes(id)) continue;
    const def = PARAMS[id];
    const v = sample.values[id];
    const r = rate[id];
    const limit = RATE_LIMITS[id] ?? 0;

    // absolute range excursion
    const rangeExcursion = v < def.range.min || v > def.range.max;
    // fast rate excursion relative to baseline noise
    const rateExcursion = Math.abs(r) > limit * 3.2;
    // sustained deviation from calibrated baseline
    const devPct = Math.abs(v - baseline[id]) / Math.max(1e-6, Math.abs(baseline[id]));
    const baselineDrift = devPct * 100 > (BASELINE_DEVIATION_PCT[id] ?? 50);

    if (rangeExcursion || rateExcursion || baselineDrift) {
      const expectedMid = (def.range.min + def.range.max) / 2;
      const deviationPct = Math.round(((v - expectedMid) / expectedMid) * 100);
      const severity = rangeExcursion
        ? deviationPct
        : Math.max(15, Math.round((Math.abs(r) / limit) * 18));
      out.push({
        param: id,
        value: v,
        deviationPct,
        direction: v > baseline[id] ? "up" : "down",
        level: severity > 35 || rangeExcursion ? "CRITICAL" : "WARNING",
      });
    }
  }
  return out;
}

/**
 * Turns raw anomalies + ambient state into the dashboard AI assessment.
 * Multi-parameter anomalies escalate to a "potential pollution event".
 */
export function assess(
  anomalies: ParamAnomaly[],
  opts: { sample: Sample; rate: Record<ParamId, number>; baseline: Record<ParamId, number> },
): AIAssessment {
  const { rate } = opts;
  const ambientCount = anomalies.filter((a) => a.level === "WARNING").length;
  const criticalCount = anomalies.filter((a) => a.level === "CRITICAL").length;

  let state: AIAssessment["state"] = "NORMAL";
  let probability = 0;
  let confidence = 0;
  let assessment = "All parameters within expected operating envelope.";
  let isPollutionEvent = false;

  // baseline ambient risk from slow drift
  const slowDrift = PARAM_ORDER.reduce((acc, id) => {
    const def = PARAMS[id];
    const lim = RATE_LIMITS[id] ?? 0.1;
    return acc + clamp01(Math.abs(rate[id]) / (lim * 4));
  }, 0) / PARAM_ORDER.length;

  if (criticalCount >= 2 || (criticalCount >= 1 && ambientCount >= 2)) {
    state = "ALERT";
    probability = 60 + Math.min(38, 15 * criticalCount + 8 * ambientCount + slowDrift * 20);
    confidence = 74 + Math.min(24, 8 * criticalCount + 4 * ambientCount + slowDrift * 15);
    assessment = "Multi-parameter anomaly detected. Possible pollution event in progress.";
    isPollutionEvent = true;
  } else if (ambientCount >= 2 || criticalCount === 1) {
    state = "ANOMALY";
    probability = 25 + 20 * ambientCount + 15 * criticalCount + slowDrift * 20;
    confidence = 60 + 10 * ambientCount + 12 * criticalCount;
    assessment = "One or more parameters deviating from baseline. Escalating monitoring.";
  } else if (ambientCount === 1 || slowDrift > 0.5) {
    state = "PARAMETER_CHANGE";
    probability = 8 + 12 * ambientCount + slowDrift * 18;
    confidence = 45 + slowDrift * 30;
    assessment = "Minor parameter change observed. Monitoring trend.";
  } else {
    state = "NORMAL";
    probability = 2 + slowDrift * 14;
    confidence = 88 - slowDrift * 20;
  }

  return {
    state,
    anomalyProbability: Math.round(clamp(probability, 0, 99)),
    confidence: Math.round(clamp(confidence, 0, 99)),
    anomalyCount: anomalies.length,
    anomalies,
    assessment,
    isPollutionEvent,
  };
}

/** Quick status label for a param value against its reference range. */
export function valueStatus(value: number, range: Range, baseline: number): Status {
  const pct = Math.abs(value - baseline) / (range.max - range.min);
  if (value < range.min || value > range.max) return "CRITICAL";
  if (pct > 0.55) return "WARNING";
  return "NORMAL";
}

export { PARAM_ORDER };