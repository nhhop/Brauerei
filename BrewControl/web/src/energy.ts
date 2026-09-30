// Battery helpers for the energy settings page.

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

// First free id of the form battery, battery2, battery3, ...
export function freeBatteryId(taken: string[]): string {
  if (!taken.includes('battery')) return 'battery';
  for (let n = 2; ; n++) if (!taken.includes(`battery${n}`)) return `battery${n}`;
}
