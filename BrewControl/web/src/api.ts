import type { Snapshot, BusScanResult } from './types';

async function postJson(url: string, body: unknown): Promise<void> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}

export async function getSnapshot(): Promise<Snapshot> {
  const r = await fetch('/api/snapshot');
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as Snapshot;
}

// Subscribe to the named "snapshot" SSE event. The browser EventSource
// auto-reconnects on transport drop, so callers don't need to handle that.
// Returns an unsubscribe function.
export function subscribeEvents(onSnapshot: (s: Snapshot) => void): () => void {
  const es = new EventSource('/api/events');
  es.addEventListener('snapshot', (e) => {
    try {
      onSnapshot(JSON.parse((e as MessageEvent).data) as Snapshot);
    } catch {
      // malformed payload — skip
    }
  });
  return () => es.close();
}

export function writeActuator(id: string, v: number): Promise<void> {
  return postJson(`/api/actuators/${encodeURIComponent(id)}`, { v });
}

export function setControllerSetpoint(id: string, v: number): Promise<void> {
  return postJson(`/api/controllers/${encodeURIComponent(id)}/setpoint`, { v });
}

export function setControllerParams(
  id: string,
  params: Record<string, unknown>,
): Promise<void> {
  return postJson(`/api/controllers/${encodeURIComponent(id)}/params`, params);
}

export async function wifiReset(): Promise<void> {
  const r = await fetch('/api/admin/wifi-reset', { method: 'POST' });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}

// ── Dynamic item creation ────────────────────────────────────────────────

export function createSensor(cfg: object): Promise<void> {
  return postJson('/api/sensors', cfg);
}

export function createActuator(cfg: object): Promise<void> {
  return postJson('/api/actuators', cfg);
}

export function createController(cfg: object): Promise<void> {
  return postJson('/api/controllers', cfg);
}

// ── Dynamic item deletion ────────────────────────────────────────────────

async function deleteItem(url: string): Promise<void> {
  const r = await fetch(url, { method: 'DELETE' });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}

export function deleteSensor(id: string): Promise<void> {
  return deleteItem(`/api/sensors/${encodeURIComponent(id)}`);
}

export function deleteActuator(id: string): Promise<void> {
  return deleteItem(`/api/actuators/${encodeURIComponent(id)}`);
}

export function deleteController(id: string): Promise<void> {
  return deleteItem(`/api/controllers/${encodeURIComponent(id)}`);
}

// ── Bus discovery ────────────────────────────────────────────────────────────

export async function scanOneWireBus(pin: number): Promise<BusScanResult> {
  const r = await fetch(`/api/bus/scan?type=onewire&pin=${pin}`);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<BusScanResult>;
}
