import type { Snapshot, BusScanResult, ConfigSnapshot, DashboardConfig, LogConfig, AppSettings, UpdateStatus } from './types';

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

export function resetSensor(id: string): Promise<void> {
  return postJson(`/api/sensors/${encodeURIComponent(id)}/reset`, {});
}

export function deleteActuator(id: string): Promise<void> {
  return deleteItem(`/api/actuators/${encodeURIComponent(id)}`);
}

export function deleteController(id: string): Promise<void> {
  return deleteItem(`/api/controllers/${encodeURIComponent(id)}`);
}

// ── Config (original cfgJson — used by edit UI) ──────────────────────────────

export async function getConfig(): Promise<ConfigSnapshot> {
  const r = await fetch('/api/config');
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as ConfigSnapshot;
}

export function enableController(id: string, enabled: boolean): Promise<void> {
  return setControllerParams(id, { enabled });
}

export function startAutotune(id: string, method: string): Promise<void> {
  return setControllerParams(id, { autotune: 'start', autotuneMethod: method });
}

export function stopAutotune(id: string): Promise<void> {
  return setControllerParams(id, { autotune: 'stop' });
}

// ── Dashboards ───────────────────────────────────────────────────────────────

export async function getDashboards(): Promise<DashboardConfig[]> {
  const r = await fetch('/api/dashboards');
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<DashboardConfig[]>;
}

export async function createDashboard(cfg: Omit<DashboardConfig, 'id'>): Promise<string> {
  const r = await fetch('/api/dashboards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const data = await r.json() as { id: string };
  return data.id;
}

export function updateDashboard(id: string, cfg: Omit<DashboardConfig, 'id'>): Promise<void> {
  return postJson(`/api/dashboards/${encodeURIComponent(id)}`, cfg);
}

export async function deleteDashboard(id: string): Promise<void> {
  const r = await fetch(`/api/dashboards/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}

// ── Data logs / charts ─────────────────────────────────────────────────────────

export async function getLogs(): Promise<LogConfig[]> {
  const r = await fetch('/api/logs');
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<LogConfig[]>;
}

export async function createLog(cfg: Omit<LogConfig, 'id' | 'session'>): Promise<string> {
  const r = await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json() as { id: string }).id;
}

export function updateLog(id: string, cfg: Omit<LogConfig, 'id' | 'session'>): Promise<void> {
  return postJson(`/api/logs/${encodeURIComponent(id)}`, cfg);
}

export async function deleteLog(id: string): Promise<void> {
  const r = await fetch(`/api/logs/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}

export function logDownloadUrl(id: string): string {
  return `/api/logs/${encodeURIComponent(id)}/download`;
}

// Parsed current-session data, shaped for uPlot: data[0] = timestamps (s),
// data[i+1] = series i (null for empty cells). refs are the column headers.
export interface LogData {
  refs: string[];
  data: (number | null)[][];
}

export async function getLogData(id: string): Promise<LogData> {
  const r = await fetch(`/api/logs/${encodeURIComponent(id)}/data`);
  if (r.status === 404) return { refs: [], data: [[]] };
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return parseCsv(await r.text());
}

function parseCsv(text: string): LogData {
  const lines = text.trim().split('\n');
  if (lines.length < 1 || !lines[0]) return { refs: [], data: [[]] };
  const header = lines[0].split(',');
  const refs = header.slice(1);            // drop "ts"
  const cols: (number | null)[][] = header.map(() => []);
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    if (cells.length !== header.length) continue;
    for (let c = 0; c < header.length; c++) {
      const raw = cells[c];
      cols[c].push(raw === '' ? null : Number(raw));
    }
  }
  return { refs, data: cols };
}

// Resolves a series ref against a live snapshot. Mirrors LogStore::resolve
// in the firmware. Returns null when the channel is absent or invalid.
export function resolveRef(snap: Snapshot, ref: string): number | null {
  const slash = ref.indexOf('/');
  if (slash < 0) return null;
  const role = ref.slice(0, slash);
  const id = ref.slice(slash + 1);
  if (role === 'sensor') {
    const s = snap.sensors.find((x) => x.id === id);
    return s && s.state.ok ? s.state.v : null;
  }
  if (role === 'actuator') {
    const a = snap.actuators.find((x) => x.id === id);
    return a ? a.state.v : null;
  }
  if (role === 'controller') {
    const c = snap.controllers.find((x) => x.id === id);
    return c ? c.setpoint : null;
  }
  return null;
}

// ── Bus discovery ────────────────────────────────────────────────────────────

export async function scanOneWireBus(pin: number): Promise<BusScanResult> {
  const r = await fetch(`/api/bus/scan?type=onewire&pin=${pin}`);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<BusScanResult>;
}

// ── App Settings ─────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  const r = await fetch('/api/settings');
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as AppSettings;
}

export function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  return postJson('/api/settings', patch);
}

// ── Firmware update ────────────────────────────────────────────────────────────

export async function getUpdateStatus(): Promise<UpdateStatus> {
  const r = await fetch('/api/update/status');
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as UpdateStatus;
}

export function checkUpdate(channel: 'stable' | 'preview'): Promise<void> {
  return postJson('/api/update/check', { channel });
}

export function installUpdate(channel: 'stable' | 'preview'): Promise<void> {
  return postJson('/api/update/install', { channel });
}

function uploadFile(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('f', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve() : reject(new Error(`${xhr.status} ${xhr.responseText}`)));
    xhr.onerror = () => reject(new Error('network error'));
    xhr.send(form);
  });
}

export function uploadFirmware(file: File, onProgress: (pct: number) => void): Promise<void> {
  return uploadFile('/api/update/firmware', file, onProgress);
}

export function uploadAssets(file: File, onProgress: (pct: number) => void): Promise<void> {
  return uploadFile('/api/update/assets', file, onProgress);
}

// ── Backup & Restore ───────────────────────────────────────────────────────────

export async function downloadBackup(): Promise<void> {
  const r = await fetch('/api/backup');
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `brewcontrol-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Posts the raw backup file text; on 200 the device reboots to apply.
export async function restoreBackup(text: string): Promise<void> {
  const r = await fetch('/api/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: text,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}
