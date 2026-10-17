import { describe, expect, it } from 'vitest';
import { autoStep, stepValue } from './numStep';

describe('stepValue', () => {
  it('steps whole numbers from 10 up and tenths below', () => {
    expect(autoStep(25)).toBe(1);
    expect(autoStep(3.5)).toBe(0.1);
    expect(stepValue(25, 1)).toBe(26);
    expect(stepValue(3.5, -1)).toBe(3.4);
  });
  it('does not drift in floating point', () => {
    expect(stepValue(0.2, 1)).toBe(0.3);
    expect(stepValue(0.7, 1)).toBe(0.8);
  });
  it('keeps the decimals of the value', () => {
    expect(stepValue(10.25, 1)).toBe(11.25);
  });
  it('honours an explicit step and the lower limit', () => {
    expect(stepValue(100, 1, 10)).toBe(110);
    expect(stepValue(0, -1)).toBe(0);
    expect(stepValue(0, -1, 1, -273)).toBe(-1);
  });
  it('treats a non-number as 0', () => {
    expect(stepValue(NaN, 1)).toBe(0.1);
  });
});
