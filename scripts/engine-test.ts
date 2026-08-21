import { SimulationEngine } from "../lib/core/engine";
import { computeHealthScore } from "../lib/core/score";
import { PARAMS } from "../lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const eng = new SimulationEngine();
  eng.start();

  await sleep(3000);
  const s0 = eng.getState();
  const score0 = computeHealthScore(s0.snapshot.sample);
  assert(score0 >= 80, `healthy baseline score should be high, got ${score0}`);
  assert(s0.ai.state === "NORMAL", "baseline should be NORMAL");
  assert(s0.ai.anomalyProbability < 15, "baseline probability should be low");
  console.log(`[PASS] baseline  score=${score0} state=${s0.ai.state} prob=${s0.ai.anomalyProbability}%`);

  eng.triggerPollution();
  await sleep(20000);
  const s1 = eng.getState();
  const score1 = computeHealthScore(s1.snapshot.sample);
  assert(score1 < score0 - 30, `score should drop sharply during event, got ${score1} vs ${score0}`);
  assert(s1.ai.state === "ALERT" || s1.ai.anomalies.length >= 3, "multi-param anomaly expected");
  assert(s1.ai.anomalyProbability > 60, "probability should spike");
  assert(s1.camera.recording, "camera recording should auto-start");
  assert(s1.mission.samplingFreqHz > 1.4, "sampling frequency should increase");
  assert(s1.alerts.length > 0, "alerts should be generated");
  console.log(`[PASS] event      score=${score1} state=${s1.ai.state} prob=${s1.ai.anomalyProbability}% conf=${s1.ai.confidence}% anomalies=${s1.ai.anomalies.length} rec=${s1.camera.recording} freq=${s1.mission.samplingFreqHz}`);

  await sleep(145000);
  const s3 = eng.getState();
  const score3 = computeHealthScore(s3.snapshot.sample);
  assert(score3 > 75, "score should recover after the event");
  assert(s3.ai.state === "NORMAL", "system should return to NORMAL");
  assert(!s3.camera.recording, "camera recording should stop after recovery");
  assert(s3.events.length >= 5, "events should be logged throughout");
  console.log(`[PASS] recovery   score=${score3} state=${s3.ai.state} phase=${eng.getPhase()} events=${s3.events.length}`);

  // sensor fault path
  eng.simulateSensorFault("do");
  await sleep(1000);
  const f = eng.getState();
  assert(f.sensors.do.fault, "DO sensor should be faulted");
  assert(f.events.some((e) => e.title.includes("fault")), "fault event logged");
  console.log("[PASS] fault      DO sensor fault detected + event logged");
  await sleep(11000);
  const r = eng.getState();
  assert(!r.sensors.do.fault, "DO sensor should auto-recover");
  console.log("[PASS] recovery  DO sensor auto-recovered");

  eng.stop();
  console.log("ALL ENGINE TESTS PASSED");
  process.exit(0);
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});