import type {
  DashboardState,
  EventEntry,
  AlertEntry,
} from "@/lib/types";

export type TelemetryListener = (state: DashboardState) => void;

export interface TelemetryProvider {
  readonly sourceLabel: "LIVE" | "SIMULATED";
  start(): void;
  stop(): void;
  subscribe(listener: TelemetryListener): () => void;
  getState(): DashboardState;
}

/**
 * TelemetryBus - the single sink that every panel subscribes to.
 *
 * The bus is the seam between the data layer and the UI. A future live
 * deployment only has to provide a different TelemetryProvider
 * (WebSocket / MQTT bridge) that pushes the same DashboardState shape.
 */
export class TelemetryBus {
  private listeners = new Set<TelemetryListener>();

  subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(state: DashboardState): void {
    for (const l of this.listeners) l(state);
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}

let _eventSeq = 0;
export function nextId(prefix: string): string {
  _eventSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${_eventSeq.toString(36)}`;
}

export function makeEvent(partial: Omit<EventEntry, "id" | "ts"> & { ts?: number }): EventEntry {
  return {
    id: nextId("ev"),
    ts: partial.ts ?? Date.now(),
    ...partial,
  };
}

export function makeAlert(partial: Omit<AlertEntry, "id" | "ts" | "read"> & { ts?: number }): AlertEntry {
  return {
    id: nextId("al"),
    ts: partial.ts ?? Date.now(),
    read: false,
    ...partial,
  };
}