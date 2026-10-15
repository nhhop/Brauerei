import { describe, expect, it } from 'vitest';
import type { LogData } from './api';
import { DAY_SEC, handCols, logCols, logRows, platoOf, sollCol } from './fermentCourse';

const T0 = 1_760_000_000;  // pitching, epoch seconds

// ts, probe, setpoint, density (SG)
const log: LogData = {
  refs: ['sensor/probe', 'controller/ctl', 'sensor/spindel'],
  data: [
    [T0 - 7200, T0, T0 + DAY_SEC / 2, T0 + DAY_SEC, T0 + 40 * DAY_SEC],
    [null, 19.5, 19.8, 20.1, 2],
    [20, 20, 20, 20, 2],
    [1.05, 1.05, 1.04, 1.03, 1.01],
  ],
};

describe('platoOf', () => {
  it('converts the units a density probe reports and nothing else', () => {
    expect(platoOf('°P')!(12)).toBe(12);
    expect(platoOf('°Bx')!(12)).toBe(12);
    expect(platoOf('SG')!(1)).toBeCloseTo(0, 1);
    expect(platoOf('°')).toBeNull();
    expect(platoOf(undefined)).toBeNull();
  });
});

describe('sollCol', () => {
  it('is the plan in days, and none without phases', () => {
    expect(sollCol([{ id: 'a', name: 'A', tempC: 12, duration: 10 }])).toMatchObject({ xs: [0, 10], ys: [12, 12], scale: 'temp', style: 'soll' });
    expect(sollCol([])).toBeNull();
  });
});

describe('logCols', () => {
  const refs = { temp: 'sensor/probe', setpoint: 'controller/ctl', density: 'sensor/spindel' };

  it('takes the rows of the window in days after pitching, and converts the density to °P', () => {
    const cols = logCols(log, refs, 'SG', T0, T0 - 3600, T0 + 2 * DAY_SEC);
    expect(cols.map((c) => c.key)).toEqual(['temp', 'setpoint', 'density']);
    expect(cols[0].xs).toEqual([0, 0.5, 1]);
    expect(cols[0].ys).toEqual([19.5, 19.8, 20.1]);
    expect(cols[2].scale).toBe('plato');
    expect(cols[2].ys[0]!).toBeGreaterThan(12);  // SG 1.05 is about 12,4 °P
  });

  it('keeps a missing value as a gap', () => {
    const cols = logCols(log, refs, 'SG', T0, T0 - 3 * 3600, T0 + 2 * DAY_SEC);
    expect(cols[0].xs[0]).toBeCloseTo(-7200 / DAY_SEC, 9);
    expect(cols[0].ys[0]).toBeNull();
  });

  it('leaves out channels the log does not have, and a density in a unit that is no gravity', () => {
    expect(logCols(log, { temp: 'sensor/other' }, 'SG', T0, 0, T0 + 99 * DAY_SEC)).toEqual([]);
    expect(logCols(log, refs, '°', T0, T0, T0 + DAY_SEC).map((c) => c.key)).toEqual(['temp', 'setpoint']);
    expect(logCols(log, refs, undefined, T0, T0, T0 + DAY_SEC).map((c) => c.key)).toEqual(['temp', 'setpoint']);
  });

  it('leaves out a channel that has no value in the window', () => {
    expect(logCols(log, refs, 'SG', T0, T0 - 3600, T0 - 1800)).toEqual([]);
  });
});

describe('handCols', () => {
  const at = (days: number) => T0 * 1000 + days * DAY_SEC * 1000;

  it('puts gravities on the °P scale and temperatures on the °C scale, in days', () => {
    const cols = handCols([
      { at: at(1), kind: 'gravity', v: 10 }, { at: at(2), kind: 'temp', v: 18 }, { at: at(3), kind: 'ph', v: 4.5 },
    ], T0 * 1000, undefined);
    expect(cols).toEqual([
      { key: 'hand-gravity', label: 'Dichte (Hand)', scale: 'plato', xs: [1], ys: [10], style: 'dots' },
      { key: 'hand-temp', label: 'Temperatur (Hand)', scale: 'temp', xs: [2], ys: [18], style: 'dots' },
    ]);
  });

  it('draws a refractometer reading only with the original extract', () => {
    const r = [{ at: at(1), kind: 'brix' as const, v: 8 }];
    expect(handCols(r, T0 * 1000, undefined)).toEqual([]);
    expect(handCols(r, T0 * 1000, 12)[0].ys[0]!).toBeGreaterThan(0);
  });
});

describe('logRows', () => {
  it('estimates what a log of this interval holds', () => {
    expect(logRows(60, 1)).toBe(1440);
    expect(logRows(5, 14)).toBe(241920);
    expect(logRows(0, 14)).toBe(0);
  });
});
