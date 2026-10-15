import { describe, expect, it } from 'vitest';
import { efficiencySeries } from './EfficiencyChart';

describe('efficiencySeries', () => {
  it('takes the brews with a measured efficiency, oldest first', () => {
    const s = efficiencySeries([
      { number: 14, version: 3, mashEffPct: 71.5 },
      { number: 12, version: 2 },
      { number: 11, version: 2, mashEffPct: 70.4, yieldPct: 56.3 },
      { number: 7, version: 1, yieldPct: 54.5 },
    ]);
    expect(s.labels).toEqual(['#7 · v1', '#11 · v2', '#14 · v3']);
    expect(s.xs).toEqual([0, 1, 2]);
    expect(s.mash).toEqual([null, 70.4, 71.5]);
    expect(s.yields).toEqual([54.5, 56.3, null]);
  });
});
