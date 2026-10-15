// The data of the fermentation course (pages/brew/FermentCourse.tsx): the plan,
// what a device log recorded and the readings the brewer took by hand, as
// columns over days after pitching. Pure, so it can be tested.
import type { LogData } from './api';
import { fermentSollCourse } from './fermentation';
import { readingPlato, type Reading } from './brewReadings';
import { brixToPlato, sgToPlato } from './gravityUnits';
import type { Phase } from './recipes';

export const DAY_SEC = 86400;

// How a column is drawn: the plan dashed, the log as a line, the controller's
// setpoint thin, hand readings as dots.
export type ColStyle = 'soll' | 'line' | 'thin' | 'dots';

export interface Col {
  key: string;
  label: string;
  scale: 'temp' | 'plato';   // °C on the left axis, °P on the right one
  xs: number[];              // days after pitching
  ys: (number | null)[];
  style: ColStyle;
}

// The conversion to °P for a density sensor's unit; null for a unit that is no gravity.
export function platoOf(unit: string | undefined): ((v: number) => number) | null {
  switch (unit?.toLowerCase()) {
    case '°p': return (v) => v;
    case 'sg': return sgToPlato;
    case '°bx': case 'brix': return brixToPlato;
    default: return null;
  }
}

export function sollCol(phases: Phase[]): Col | null {
  const { xs, ys } = fermentSollCourse(phases);
  return xs.length === 0 ? null : { key: 'soll', label: 'Soll', scale: 'temp', xs, ys, style: 'soll' };
}

// The log's rows from `fromSec` to `toSec` for the channels the log has. A
// column without a single value is left out, so the chart has no empty entry.
export function logCols(
  d: LogData,
  refs: { temp?: string; setpoint?: string; density?: string },
  densityUnit: string | undefined,
  pitchedSec: number, fromSec: number, toSec: number,
): Col[] {
  const rows: number[] = [];
  (d.data[0] ?? []).forEach((ts, i) => { if (ts !== null && ts >= fromSec && ts <= toSec) rows.push(i); });
  const xs = rows.map((i) => ((d.data[0][i] as number) - pitchedSec) / DAY_SEC);
  const col = (ref: string | undefined, convert: (v: number) => number = (v) => v) => {
    const at = ref ? d.refs.indexOf(ref) : -1;
    if (at < 0) return null;
    const ys = rows.map((i) => { const v = d.data[at + 1]?.[i]; return v == null ? null : convert(v); });
    return ys.some((y) => y !== null) ? ys : null;
  };
  const toPlato = platoOf(densityUnit);
  const out: Col[] = [];
  const add = (key: string, label: string, scale: Col['scale'], ys: (number | null)[] | null, style: ColStyle) => {
    if (ys) out.push({ key, label, scale, xs, ys, style });
  };
  add('temp', 'Ist', 'temp', col(refs.temp), 'line');
  add('setpoint', 'Regler-Soll', 'temp', col(refs.setpoint), 'thin');
  if (toPlato) add('density', 'Dichte (Log)', 'plato', col(refs.density, toPlato), 'line');
  return out;
}

// The hand readings: gravities (a refractometer reading with the original
// extract `og`) in °P, temperatures in °C. pH is not drawn.
export function handCols(readings: Reading[], pitchedMs: number, og: number | undefined): Col[] {
  const day = (r: Reading) => (r.at - pitchedMs) / (DAY_SEC * 1000);
  const gravity = readings.flatMap((r) => { const p = readingPlato(r, og); return p === null ? [] : [{ x: day(r), y: p }]; });
  const temp = readings.filter((r) => r.kind === 'temp').map((r) => ({ x: day(r), y: r.v }));
  const out: Col[] = [];
  if (gravity.length > 0) out.push({ key: 'hand-gravity', label: 'Dichte (Hand)', scale: 'plato', xs: gravity.map((p) => p.x), ys: gravity.map((p) => p.y), style: 'dots' });
  if (temp.length > 0) out.push({ key: 'hand-temp', label: 'Temperatur (Hand)', scale: 'temp', xs: temp.map((p) => p.x), ys: temp.map((p) => p.y), style: 'dots' });
  return out;
}

// A log that records a channel every few seconds for weeks is loaded whole
// (GET /api/logs/<id>/data has no time window); past this many rows the chart
// tells so.
export const LONG_LOG_ROWS = 20000;

export const logRows = (intervalSec: number, spanDays: number): number =>
  intervalSec > 0 ? Math.round((spanDays * DAY_SEC) / intervalSec) : 0;
