"use client";

import { useSyncExternalStore } from "react";
import { engine } from "@/lib/core/engine";

// NOTE: subscribe/getSnapshot must be module-stable references. Fresh arrow
// functions per render cause useSyncExternalStore to tear down and recreate
// subscriptions on EVERY render (4 Hz engine emits), so intervals never fire.

const subscribeEngine = (cb: () => void) => engine.subscribe(cb);
const getEngineSnapshot = () => engine.getState();

/** Subscribes the calling component to the live dashboard state. */
export function useTelemetry() {
  return useSyncExternalStore(subscribeEngine, getEngineSnapshot, getEngineSnapshot);
}

const noopUnsubscribe = () => {};
const mountedSnapshot = () => true;
const notMountedSnapshot = () => false;

/** True once the component has mounted on the client (avoids SSR mismatch). */
export function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, mountedSnapshot, notMountedSnapshot);
}

const noopSubscribe = () => noopUnsubscribe;

/** Client-side wall clock, ticking every second. */
let _clockSnapshot = Date.now();
const clockSubscribe = (cb: () => void) => {
  const i = setInterval(() => {
    _clockSnapshot = Date.now();
    cb();
  }, 1000);
  return () => clearInterval(i);
};
const getClockSnapshot = () => _clockSnapshot;

export function useClock(): number {
  return useSyncExternalStore(clockSubscribe, getClockSnapshot, getClockSnapshot);
}