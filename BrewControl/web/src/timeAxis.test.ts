import { describe, expect, it } from 'vitest';
import { ageLabel, ageSplits, makeScale, parseTimeAxis, tickLabel } from './timeAxis';

const T_MAX = 1_700_000_000;
const modes = ['log', 'sqrt'] as const;

describe('makeScale', () => {
  for (const mode of modes) {
    const { fwd, bwd } = makeScale(mode, () => T_MAX);

    it(`${mode}: bwd inverts fwd, also past tMax`, () => {
      for (const age of [-500, -1, 0, 1, 59, 3600, 86400, 7 * 86400]) {
        const t = T_MAX - age;
        expect(bwd(fwd(t))).toBeCloseTo(t, 4);
      }
    });

    it(`${mode}: strictly increasing, newest at the right`, () => {
      const ts = [T_MAX - 7 * 86400, T_MAX - 86400, T_MAX - 3600, T_MAX - 60, T_MAX, T_MAX + 30];
      const us = ts.map(fwd);
      for (let i = 1; i < us.length; i++) expect(us[i]).toBeGreaterThan(us[i - 1]);
      expect(fwd(T_MAX)).toBeCloseTo(0);
    });

    it(`${mode}: compresses old values`, () => {
      // The last hour must take more room than the hour before it.
      const recent = fwd(T_MAX) - fwd(T_MAX - 3600);
      const older = fwd(T_MAX - 3600) - fwd(T_MAX - 7200);
      expect(recent).toBeGreaterThan(older);
    });

    it(`${mode}: follows a moving tMax`, () => {
      let tMax = T_MAX;
      const s = makeScale(mode, () => tMax);
      expect(s.fwd(tMax)).toBeCloseTo(0);
      tMax += 100;
      expect(s.fwd(tMax)).toBeCloseTo(0);
    });
  }
});

describe('ageSplits', () => {
  const { fwd } = makeScale('log', () => T_MAX);

  it('lies in range, ascending, newest tick at tMax', () => {
    const min = T_MAX - 2 * 86400, max = T_MAX;
    const s = ageSplits(min, max, T_MAX, fwd);
    expect(s.length).toBeGreaterThan(1);
    expect(s[s.length - 1]).toBe(T_MAX);
    for (let i = 0; i < s.length; i++) {
      expect(s[i]).toBeGreaterThanOrEqual(min);
      expect(s[i]).toBeLessThanOrEqual(max);
      if (i) expect(s[i]).toBeGreaterThan(s[i - 1]);
    }
  });

  it('handles an empty range (one data point)', () => {
    expect(ageSplits(T_MAX, T_MAX, T_MAX, fwd)).toEqual([T_MAX]);
  });
});

describe('labels and parsing', () => {
  it('formats ages', () => {
    expect(ageLabel(0)).toBe('jetzt');
    expect(ageLabel(300)).toBe('-5 min');
    expect(ageLabel(7200)).toBe('-2 h');
    expect(ageLabel(3 * 86400)).toBe('-3 d');
  });

  it('falls back to linear', () => {
    expect(parseTimeAxis('log')).toBe('log');
    expect(parseTimeAxis(undefined)).toBe('linear');
    expect(parseTimeAxis('exp')).toBe('linear');
  });
});

describe('tickLabel', () => {
  const time = (ts: number) => `T${ts}`;
  const date = (ts: number) => `D${ts}`;
  // Midday, so +-1 h never crosses a day boundary in any time zone.
  const noon = new Date(2026, 9, 12, 12, 0, 0).getTime() / 1000;

  it('shows age and time on the same day', () => {
    expect(tickLabel(noon - 3600, noon, time, date)).toBe(`-1 h\nT${noon - 3600}`);
  });

  it('labels the newest tick', () => {
    expect(tickLabel(noon, noon, time, date)).toBe(`jetzt\nT${noon}`);
  });

  it('adds the date on another day', () => {
    const t = noon - 3 * 86400;
    expect(tickLabel(t, noon, time, date)).toBe(`-3 d\nT${t}\nD${t}`);
  });
});
