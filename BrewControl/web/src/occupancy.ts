// Occupancy plan of the fermenters ("Belegungsplan", Sud 5c-2) on top of the
// brew list: one row per fermenter over a few weeks, from the brews' index
// lines alone (fermenterId, occupiedFrom/Until, status). Pure.
import { addDays, daysBetween, occupancyOverlaps, type BrewStatus, type BrewSummary } from './brews';
import type { Fermenter } from './cellar';

export const PLAN_DAYS = 56;

const weekday = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;  // Monday 0

// Monday of the week before `today`, moved by whole weeks.
export const planStart = (today: string, offsetWeeks = 0) => addDays(today, -weekday(today) - 7 + 7 * offsetWeeks);

// ISO 8601 week number: the week's Thursday decides the year.
export function isoWeek(iso: string): number {
  const thursday = new Date(`${addDays(iso, 3 - weekday(iso))}T00:00:00Z`);
  return 1 + Math.floor((thursday.getTime() - Date.UTC(thursday.getUTCFullYear(), 0, 1)) / (7 * 86400000));
}

export interface PlanBar {
  brew: BrewSummary;
  kind: BrewStatus;     // active = occupied, planned = reserved, done = past
  from: number;         // day index in the window, inclusive, cut to it
  to: number;
  cutLeft: boolean;     // the booking goes on beyond the window
  cutRight: boolean;
  overdue: boolean;     // running past its booking: drawn up to today
  overlap: boolean;     // another brew books the same fermenter at the same time
  lane: number;         // overlapping bars of a row lie one below the other
}

export interface PlanRow {
  fermenter?: Fermenter;  // unset = without a fermenter, or one deleted since
  bars: PlanBar[];
  lanes: number;
}

export interface CellarPlan {
  start: string;
  todayIdx: number;       // outside 0 … PLAN_DAYS − 1 when today is not shown
  rows: PlanRow[];
  overlaps: [BrewSummary, BrewSummary][];  // shown in the window
}

export function cellarPlan(brews: BrewSummary[], fermenters: Fermenter[], start: string, today: string): CellarPlan {
  // A running brew holds its fermenter until today at least.
  const booked = brews.filter((b) => b.occupiedFrom && b.occupiedUntil).map((b) =>
    b.status === 'active' && b.occupiedUntil! < today ? { ...b, occupiedUntil: today } : b);
  const known = new Set(fermenters.map((f) => f.id));
  const rowOf = (b: BrewSummary) => (b.fermenterId && known.has(b.fermenterId) ? b.fermenterId : '');

  const bars = new Map<string, PlanBar[]>();
  const shown = new Set<string>();
  for (const b of booked) {
    const from = daysBetween(start, b.occupiedFrom!);
    const to = daysBetween(start, b.occupiedUntil!);
    if (to < 0 || from > PLAN_DAYS - 1) continue;
    const original = brews.find((x) => x.id === b.id)!;
    const bar: PlanBar = {
      brew: original, kind: b.status, from: Math.max(from, 0), to: Math.min(to, PLAN_DAYS - 1),
      cutLeft: from < 0, cutRight: to > PLAN_DAYS - 1, overdue: original.occupiedUntil !== b.occupiedUntil,
      overlap: occupancyOverlaps(b, booked).length > 0, lane: 0,
    };
    const key = rowOf(b);
    bars.set(key, [...(bars.get(key) ?? []), bar]);
    shown.add(b.id);
  }

  const rowFor = (key: string, fermenter?: Fermenter): PlanRow => {
    const list = (bars.get(key) ?? []).sort((a, b) => a.from - b.from || a.to - b.to);
    const ends: number[] = [];  // last day taken per lane
    for (const bar of list) {
      const lane = ends.findIndex((end) => end < bar.from);
      bar.lane = lane < 0 ? ends.length : lane;
      ends[bar.lane] = bar.to;
    }
    return { fermenter, bars: list, lanes: Math.max(ends.length, 1) };
  };
  const rows = fermenters.map((f) => rowFor(f.id, f));
  if (bars.has('')) rows.push(rowFor(''));

  const overlaps: [BrewSummary, BrewSummary][] = [];
  for (const b of booked) {
    if (!shown.has(b.id)) continue;
    for (const o of occupancyOverlaps(b, booked)) {
      if (b.id < o.id && shown.has(o.id)) overlaps.push([b, o].map((x) => brews.find((y) => y.id === x.id)!) as [BrewSummary, BrewSummary]);
    }
  }
  return { start, todayIdx: daysBetween(start, today), rows, overlaps };
}
