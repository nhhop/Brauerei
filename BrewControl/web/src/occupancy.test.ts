import { describe, expect, it } from 'vitest';
import type { BrewStatus, BrewSummary } from './brews';
import type { Fermenter } from './cellar';
import { PLAN_DAYS, cellarPlan, isoWeek, planStart } from './occupancy';

const fermenter = (id: string): Fermenter =>
  ({ id, name: id, updatedAt: 0, kind: 'bucket', volumeL: 30, tempering: 'none', manual: true });
const brew = (id: string, fermenterId: string | undefined, from: string, until: string, status: BrewStatus = 'planned'): BrewSummary =>
  ({ id, number: 1, name: id, recipeId: 'r', rootId: 'r', version: 1, status, updatedAt: 0, fermenterId, occupiedFrom: from, occupiedUntil: until });

const today = '2026-10-14';  // a Wednesday
const start = planStart(today);
const f1 = fermenter('f1'), f2 = fermenter('f2');
const barsOf = (brews: BrewSummary[], fs = [f1, f2]) => cellarPlan(brews, fs, start, today).rows.flatMap((r) => r.bars);

describe('window', () => {
  it('starts on the Monday of the week before and pages by whole weeks', () => {
    expect(start).toBe('2026-10-05');
    expect(planStart('2026-10-12')).toBe('2026-10-05');   // Monday
    expect(planStart('2026-10-18')).toBe('2026-10-05');   // Sunday
    expect(planStart(today, 1)).toBe('2026-10-12');
    expect(planStart(today, -2)).toBe('2026-09-21');
  });

  it('numbers the weeks after ISO 8601', () => {
    expect(isoWeek('2026-10-12')).toBe(42);
    expect(isoWeek('2026-01-01')).toBe(1);    // a Thursday
    expect(isoWeek('2027-01-01')).toBe(53);   // Friday: still the last week of 2026
    expect(isoWeek('2024-12-30')).toBe(1);    // Monday of week 1 of 2025
  });

  it('places today in the window', () => {
    expect(cellarPlan([], [f1], start, today).todayIdx).toBe(9);
  });
});

describe('rows and bars', () => {
  it('has a row per fermenter, empty when free, and one without a fermenter only when used', () => {
    expect(cellarPlan([], [f1, f2], start, today).rows.map((r) => r.fermenter?.id)).toEqual(['f1', 'f2']);
    const rows = cellarPlan([brew('a', undefined, today, today), brew('b', 'gone', today, today)], [f1], start, today).rows;
    expect(rows.map((r) => r.fermenter?.id)).toEqual(['f1', undefined]);
    expect(rows[1].bars.map((b) => b.brew.id)).toEqual(['a', 'b']);
  });

  it('cuts a bar to the window and leaves out what lies outside or has no dates', () => {
    const bars = barsOf([
      brew('cut', 'f1', '2026-09-20', '2026-10-07'), brew('long', 'f2', '2026-11-20', '2027-01-10'),
      brew('before', 'f1', '2026-09-01', '2026-10-04'), brew('after', 'f1', '2026-11-30', '2026-12-10'),
      { ...brew('none', 'f1', today, today), occupiedFrom: undefined },
    ]);
    expect(bars.map((b) => b.brew.id)).toEqual(['cut', 'long']);
    expect(bars[0]).toMatchObject({ from: 0, to: 2, cutLeft: true, cutRight: false });
    expect(bars[1]).toMatchObject({ from: 46, to: PLAN_DAYS - 1, cutLeft: false, cutRight: true });
  });

  it('carries the status and draws a running brew past its booking up to today', () => {
    const bars = barsOf([
      brew('late', 'f1', '2026-10-05', '2026-10-10', 'active'), brew('done', 'f2', '2026-10-05', '2026-10-08', 'done'),
      brew('next', 'f2', '2026-10-20', '2026-10-30'),
    ]);
    expect(bars.map((b) => [b.brew.id, b.kind, b.to, b.overdue])).toEqual([
      ['late', 'active', 9, true], ['done', 'done', 3, false], ['next', 'planned', 25, false],
    ]);
    expect(bars[0].brew.occupiedUntil).toBe('2026-10-10');
  });
});

describe('overlaps', () => {
  it('marks overlapping bookings and lays them in lanes', () => {
    const plan = cellarPlan([
      brew('a', 'f1', '2026-10-06', '2026-10-15'), brew('b', 'f1', '2026-10-15', '2026-10-25'),
      brew('c', 'f1', '2026-10-26', '2026-11-05'), brew('d', 'f2', '2026-10-06', '2026-10-15'),
    ], [f1, f2], start, today);
    const [r1, r2] = plan.rows;
    expect(r1.bars.map((b) => [b.brew.id, b.overlap, b.lane])).toEqual([['a', true, 0], ['b', true, 1], ['c', false, 0]]);
    expect(r1.lanes).toBe(2);
    expect(r2.bars[0].overlap).toBe(false);
    expect(plan.overlaps.map(([x, y]) => [x.id, y.id])).toEqual([['a', 'b']]);
  });

  it('counts a running brew past its booking against the next one', () => {
    const plan = cellarPlan([brew('late', 'f1', '2026-10-01', '2026-10-10', 'active'), brew('next', 'f1', '2026-10-12', '2026-10-20')],
      [f1], start, today);
    expect(plan.rows[0].bars.every((b) => b.overlap)).toBe(true);
  });
});
