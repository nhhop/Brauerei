import { describe, it, expect } from 'vitest';
import { lipoPercent, freeBatteryId } from './energy';

describe('lipoPercent', () => {
  it('clamps below empty and above full', () => {
    expect(lipoPercent(2.9)).toBe(0);
    expect(lipoPercent(3.3)).toBe(0);
    expect(lipoPercent(4.2)).toBe(100);
    expect(lipoPercent(4.35)).toBe(100);
  });
  it('hits the curve points exactly', () => {
    expect(lipoPercent(3.7)).toBe(15);
    expect(lipoPercent(4.0)).toBe(80);
  });
  it('interpolates between points', () => {
    expect(lipoPercent(3.95)).toBe(73);  // halfway between 65 % and 80 %, rounded
  });
});

describe('freeBatteryId', () => {
  it('prefers "battery", then counts up', () => {
    expect(freeBatteryId([])).toBe('battery');
    expect(freeBatteryId(['battery'])).toBe('battery2');
    expect(freeBatteryId(['battery', 'battery2'])).toBe('battery3');
  });
});
