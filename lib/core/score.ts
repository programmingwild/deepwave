import type { Sample } from "@/lib/types";
import { PARAMS, PARAM_ORDER } from "@/lib/types";
import { clamp } from "@/lib/core/utils";

/**
 * PROTOTYPE Environmental Health Score.
 *
 * NOT a scientifically validated regulatory index. It is a transparent,
 * weighted composite of normalized deviations from each sensor's target
 * operating point, scaled to 0-100. Used for operator awareness only.
 */
export function computeHealthScore(sample: Sample): number {
  let acc = 0;
  let totalW = 0;

  for (const id of PARAM_ORDER) {
    const def = PARAMS[id];
    const v = sample.values[id];
    const half = Math.max(def.target - def.range.min, def.range.max - def.target);
    const dist = Math.abs(v - def.target) / half;
    let contrib = Math.pow(clamp(1 - dist * 1.15, 0, 1), 1.25);
    // extra penalty when the value leaves the reference range entirely
    if (v < def.range.min || v > def.range.max) contrib *= 0.5;
    acc += contrib * def.weight;
    totalW += def.weight;
  }

  const raw = (acc / totalW) * 100 * 0.9;
  return clamp(Math.round(Math.max(1, raw)), 0, 100);
}

export function healthLabel(score: number): "HEALTHY" | "WATCH" | "DEGRADED" | "CRITICAL" {
  if (score >= 75) return "HEALTHY";
  if (score >= 55) return "WATCH";
  if (score >= 35) return "DEGRADED";
  return "CRITICAL";
}