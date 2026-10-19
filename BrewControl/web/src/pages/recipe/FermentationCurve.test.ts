import { describe, expect, it } from 'vitest';
import { fermentationCurveOf } from './FermentationCurve';

describe('fermentationCurveOf', () => {
  it('holds the first phase, ramps into the second and jumps into the third', () => {
    const c = fermentationCurveOf([
      { name: 'Haupt', tempC: 12, duration: 7 },
      { name: 'Diacetyl', tempC: 18, duration: 3, rampDays: 1 },
      { name: 'Kalt', tempC: 2, duration: 5 },
    ]);
    expect(c.xs).toEqual([0, 7, 7, 7, 8, 10, 10, 10, 10, 15]);
    expect(c.ys).toEqual([12, 12, 12, 12, 18, 18, 18, 18, 2, 2]);
    expect(c.labels.filter(Boolean)).toEqual(['Haupt', 'Diacetyl', 'Kalt']);
  });

  it('caps a ramp at the phase duration', () => {
    const c = fermentationCurveOf([
      { name: 'a', tempC: 10, duration: 2 },
      { name: 'b', tempC: 20, duration: 2, rampDays: 5 },
    ]);
    expect(c.xs).toEqual([0, 2, 2, 2, 4, 4]);
  });

  it('steps the pressure at the start of its phase, none counting as 0', () => {
    const c = fermentationCurveOf([
      { name: 'a', tempC: 18, duration: 2, pressureBar: 1 },
      { name: 'b', tempC: 12, duration: 2, rampDays: 1 },
    ]);
    expect(c.xs.map((x, i) => [x, c.bars[i]])).toEqual([[0, 1], [2, 1], [2, 1], [2, 0], [3, 0], [4, 0]]);
  });
});
