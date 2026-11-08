// A brew's course out of a device log: the rows from `fromSec` to `toSec`
// across every session that holds some of them (a log cleared or with its
// series changed starts a new session mid-course), each fetched with the time
// window so only those rows come down.
import { getLogData, getLogSessions, type LogData } from './api';
import type { LogConfig, LogSession } from './types';

const EMPTY: LogData = { refs: [], data: [[]] };

// The sessions that overlap [fromSec, toSec], oldest first. A session lasts
// until the next one starts; the last one is open.
export function sessionsIn(sessions: LogSession[], fromSec: number, toSec: number): LogSession[] {
  const sorted = [...sessions].sort((a, b) => a.start - b.start);
  return sorted.filter((s, i) => s.start <= toSec && (i + 1 >= sorted.length || sorted[i + 1].start > fromSec));
}

// The parts one after the other: the union of their columns, a column a part
// does not have stays empty there. The parts are in time order and do not overlap.
export function mergeLogData(parts: LogData[]): LogData {
  if (parts.length === 1) return parts[0];
  const refs: string[] = [];
  for (const p of parts) for (const r of p.refs) if (!refs.includes(r)) refs.push(r);
  const data: (number | null)[][] = [[], ...refs.map(() => [])];
  for (const p of parts) {
    const ts = p.data[0] ?? [];
    data[0].push(...ts);
    refs.forEach((r, c) => {
      const at = p.refs.indexOf(r);
      const col = at < 0 ? undefined : p.data[at + 1];
      for (let i = 0; i < ts.length; i++) data[c + 1].push(col?.[i] ?? null);
    });
  }
  return { refs, data };
}

// Loads the window. Without a session list (the request failed) it falls back
// to the current session.
export async function loadLogWindow(logId: string, fromSec: number, toSec: number): Promise<LogData> {
  const win = { from: Math.floor(fromSec), to: Math.ceil(toSec) };
  const sessions = await getLogSessions(logId).catch(() => null);
  if (sessions === null) return getLogData(logId, undefined, win);
  const hit = sessionsIn(sessions, fromSec, toSec);
  if (hit.length === 0) return EMPTY;
  return mergeLogData(await Promise.all(hit.map((s) => getLogData(logId, s.start, win))));
}

// The log a brew sets up when none records its probe: one per brewhouse or
// fermenter, so the next brew finds it again. With a controller it records
// while the controller is on.
export function brewLogConfig(o: {
  name: string;
  intervalSec: number;
  sensors: (string | undefined)[];   // sensor ids, the first one is the probe
  others: (string | undefined)[];    // refs without a dead band ("actuator/…", "controller/…")
  controller?: string;
}): Omit<LogConfig, 'id' | 'session'> {
  const series = [
    ...o.sensors.filter((s): s is string => !!s).map((s) => ({ ref: `sensor/${s}`, tol: 0.1 })),
    ...o.others.filter((r): r is string => !!r).map((ref) => ({ ref, tol: 0 })),
  ];
  return {
    name: o.name, intervalSec: o.intervalSec, series, algo: 'swingingdoor', maxGapSec: 600, enabled: true,
    ...(o.controller && { bindEnableTo: o.controller }),
  };
}
