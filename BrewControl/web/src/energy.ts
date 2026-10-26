// Battery helpers for the energy settings page.
import type { Sensor } from './types';

// Rough state of charge of a single LiPo cell from its resting voltage,
// interpolated linearly between the points of a typical discharge curve.
// Under load or while charging the voltage (and so the result) is off.
const LIPO_CURVE: [number, number][] = [
  [3.3, 0], [3.6, 5], [3.7, 15], [3.75, 25], [3.8, 40],
  [3.85, 55], [3.9, 65], [4.0, 80], [4.1, 90], [4.2, 100],
];

export function lipoPercent(volts: number): number {
  const first = LIPO_CURVE[0];
  const last = LIPO_CURVE[LIPO_CURVE.length - 1];
  if (volts <= first[0]) return 0;
  if (volts >= last[0]) return 100;
  for (let i = 1; i < LIPO_CURVE.length; i++) {
    const [v1, p1] = LIPO_CURVE[i];
    if (volts <= v1) {
      const [v0, p0] = LIPO_CURVE[i - 1];
      return Math.round(p0 + ((volts - v0) / (v1 - v0)) * (p1 - p0));
    }
  }
  return 100;
}

// First free id of the form battery, battery2, battery3, ... (or another
// base). taken are snapshot ids; a channel id "pmu.vbat" takes "pmu".
export function freeBatteryId(taken: string[], base = 'battery'): string {
  const bases = taken.map((id) => id.split('.')[0]);
  if (!bases.includes(base)) return base;
  for (let n = 2; ; n++) if (!bases.includes(`${base}${n}`)) return `${base}${n}`;
}

export interface BatteryStatus {
  volts: number | null;
  percent: number | null;
  gauge: boolean;     // percent comes from the chip's fuel gauge, not the curve
  charging: boolean;
  usb: boolean;       // USB voltage present
}

// What the battery sensor and, for a PMU channel ("pmu.vbat"), its sibling
// channels (soc, charging, vbus) say. null if the sensor isn't there.
export function batteryStatus(sensors: Sensor[], id: string): BatteryStatus | null {
  const battery = sensors.find((s) => s.id === id);
  if (!battery) return null;
  const valueOf = (s: Sensor | undefined) => (s?.state.ok && s.state.v != null ? s.state.v : null);
  const dot = id.lastIndexOf('.');
  const sibling = (key: string) =>
    dot < 0 ? undefined : sensors.find((s) => s.id === `${id.slice(0, dot)}.${key}`);
  const volts = valueOf(battery);
  const soc = valueOf(sibling('soc'));
  const vbus = valueOf(sibling('vbus'));
  return {
    volts,
    percent: soc != null ? Math.round(soc) : volts != null ? lipoPercent(volts) : null,
    gauge: soc != null,
    charging: valueOf(sibling('charging')) === 1,
    usb: vbus != null && vbus > 4,
  };
}
