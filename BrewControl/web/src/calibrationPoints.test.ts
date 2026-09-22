import { describe, expect, it } from 'vitest';
import {
  MAX_POINTS, ensureRows, num, pointsProblem, pointsToWire, requiredCount,
} from './calibrationPoints';
import type { PointDraft } from './calibrationPoints';

const p = (raw: string, value: string): PointDraft => ({ raw, value });

describe('num', () => {
  it('accepts a comma as decimal separator', () => {
    expect(num('7,5')).toBe(7.5);
    expect(num('7.5')).toBe(7.5);
  });
  it('is NaN for an empty or partial input', () => {
    expect(num('')).toBeNaN();
    expect(num('-')).toBeNaN();
  });
});

describe('requiredCount', () => {
  it('follows the mode, and the degree for poly', () => {
    expect(requiredCount('offset', 1)).toBe(1);
    expect(requiredCount('gain', 1)).toBe(1);
    expect(requiredCount('twopoint', 1)).toBe(2);
    expect(requiredCount('poly', 1)).toBe(2);
    expect(requiredCount('poly', 3)).toBe(4);
  });
});

describe('ensureRows', () => {
  it('pads without dropping what is already typed', () => {
    const rows = [p('1', '2')];
    const padded = ensureRows(rows, 3);
    expect(padded).toHaveLength(3);
    expect(padded[0]).toEqual(p('1', '2'));
    expect(padded[2]).toEqual(p('', ''));
  });
  it('leaves a long enough list alone', () => {
    const rows = [p('1', '2'), p('3', '4')];
    expect(ensureRows(rows, 2)).toBe(rows);
  });
});

describe('pointsProblem', () => {
  it('passes a complete two-point calibration', () => {
    expect(pointsProblem([p('1443', '4'), p('2060', '7')], 'twopoint', 1)).toBeNull();
  });

  it('names the first incomplete point', () => {
    expect(pointsProblem([p('1443', '4'), p('', '7')], 'twopoint', 1))
      .toBe('Punkt 2: Rohwert messen und Referenzwert eintragen.');
  });

  it('rejects equal raw values for two-point', () => {
    expect(pointsProblem([p('100', '4'), p('100', '7')], 'twopoint', 1))
      .toBe('Die beiden Rohwerte müssen verschieden sein.');
  });

  it('rejects raw 0 for the gain mode', () => {
    expect(pointsProblem([p('0', '5')], 'gain', 1))
      .toBe('Der Rohwert darf für den Faktor nicht 0 sein.');
  });

  it('needs degree+1 points for poly', () => {
    const rows = [p('0', '0'), p('1', '1')];
    expect(pointsProblem(rows, 'poly', 1)).toBeNull();
    expect(pointsProblem(rows, 'poly', 2)).toBe('Grad 2 braucht mindestens 3 Punkte.');
  });

  it('rejects more than the firmware stores', () => {
    const rows = Array.from({ length: MAX_POINTS + 1 }, (_, i) => p(String(i), String(i)));
    expect(pointsProblem(rows, 'poly', 2)).toBe('Höchstens 8 Punkte.');
  });

  it('points at the duplicate pair for poly', () => {
    const rows = [p('0', '0'), p('5', '1'), p('5', '2'), p('9', '3')];
    expect(pointsProblem(rows, 'poly', 2)).toBe('Punkt 2 und 3 haben denselben Rohwert.');
  });

  it('accepts a valid polynomial set', () => {
    const rows = [p('0', '0'), p('1', '1'), p('2', '4'), p('3', '9')];
    expect(pointsProblem(rows, 'poly', 2)).toBeNull();
  });
});

describe('pointsToWire', () => {
  it('parses every row, comma included', () => {
    expect(pointsToWire([p('1,5', '2,5'), p('3', '4')]))
      .toEqual([{ raw: 1.5, value: 2.5 }, { raw: 3, value: 4 }]);
  });
});
