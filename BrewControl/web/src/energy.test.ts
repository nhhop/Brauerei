import { describe, it, expect } from 'vitest';
import { lipoPercent, freeBatteryId, batteryStatus } from './energy';
import type { Sensor } from './types';

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
  it('takes the base of channel ids', () => {
    expect(freeBatteryId(['imu.pitch'], 'pmu')).toBe('pmu');
    expect(freeBatteryId(['pmu.vbat', 'pmu.vbus'], 'pmu')).toBe('pmu2');
  });
});

function sensor(id: string, v: number | null, ok = true): Sensor {
  return { id, meta: { kind: 'Continuous', quantity: 'Voltage', unit: 'V' } as Sensor['meta'],
    state: { v, t: 0, ok } };
}

describe('batteryStatus', () => {
  it('is null for a missing sensor', () => {
    expect(batteryStatus([], 'battery')).toBeNull();
  });
  it('uses the LiPo curve for a plain voltage sensor', () => {
    expect(batteryStatus([sensor('battery', 4.0)], 'battery')).toEqual(
      { volts: 4.0, percent: 80, gauge: false, charging: false, usb: false });
  });
  it('takes soc, charging and vbus from the PMU siblings', () => {
    const s = [sensor('pmu.vbat', 3.9), sensor('pmu.vbus', 5.1), sensor('pmu.charging', 1),
      sensor('pmu.soc', 71.6)];
    expect(batteryStatus(s, 'pmu.vbat')).toEqual(
      { volts: 3.9, percent: 72, gauge: true, charging: true, usb: true });
  });
  it('falls back to the curve while the gauge has no value', () => {
    const s = [sensor('pmu.vbat', 3.9), sensor('pmu.soc', null, false), sensor('pmu.vbus', 0)];
    expect(batteryStatus(s, 'pmu.vbat')).toMatchObject({ percent: 65, gauge: false, usb: false });
  });
  it('has no percent without a reading', () => {
    expect(batteryStatus([sensor('pmu.vbat', null, false)], 'pmu.vbat')).toMatchObject(
      { volts: null, percent: null });
  });
});
