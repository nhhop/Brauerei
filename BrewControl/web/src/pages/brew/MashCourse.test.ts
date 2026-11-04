import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../../brewhouse';
import { calcMash, type MashRow } from '../../mashPlan';
import { calcWater } from '../../recipeWater';
import { newRecipe, type Recipe } from '../../recipes';
import type { Actuator, LogConfig, Snapshot } from '../../types';
import { fillLinear, heatActuatorOf, istCourse, pickLog, restActuals, sollCourse } from './MashCourse';

const AT = Date.UTC(2026, 9, 13, 8, 12);  // mashed in, epoch ms
const AT_SEC = AT / 1000;

function plan() {
  const bh = TEMPLATES.find((t) => t.key === 'herms3')!.build();
  const r: Recipe = {
    ...newRecipe(), volumeL: 20, brewhouseId: bh.id,
    ingredients: [{ id: 'm', kind: 'fermentable', name: 'Pilsner', amount: 5, timing: 'mash' }],
  };
  return { bh, rows: calcMash(r, bh, null, calcWater(r, bh).water!).rows };
}

describe('sollCourse', () => {
  it('lays the first mashing in on the anchor, heating the strike water before it', () => {
    const { rows } = plan();
    const doughIn = rows.find((r) => r.step.kind === 'doughIn')!;
    const last = rows[rows.length - 1];
    const c = sollCourse(rows, AT);
    expect(doughIn.startMin).toBeGreaterThan(0);
    expect(c.fromSec).toBe(AT_SEC - Math.round(doughIn.startMin * 60));
    // The mash at its temperature right when the grain went in.
    const at = c.xs.findIndex((x, i) => x >= AT_SEC && c.ys[i] === doughIn.tempC);
    expect(c.xs[at] - AT_SEC).toBeLessThanOrEqual(2);
    // The end of the last rest, give or take the seconds the jumps took.
    const end = AT_SEC + Math.round((last.startMin + last.holdMin - doughIn.startMin) * 60);
    expect(c.toSec).toBeGreaterThanOrEqual(end);
    expect(c.toSec - end).toBeLessThanOrEqual(c.xs.length);
    expect(c.ys[c.ys.length - 1]).toBe(last.tempC);
  });

  it('gives every point its own second', () => {
    const c = sollCourse(plan().rows, AT);
    expect(c.xs.every((x, i) => i === 0 || x > c.xs[i - 1])).toBe(true);
    expect(c.xs.length).toBe(c.ys.length);
  });
});

describe('fillLinear', () => {
  it('gives the plan a value at the times only the log has', () => {
    expect(fillLinear([0, 10, 20, 30, 40, 50], [undefined, 60, undefined, undefined, 72, undefined]))
      .toEqual([undefined, 60, 64, 68, 72, undefined]);
    expect(fillLinear([0, 5, 10], [50, null, 50])).toEqual([50, 50, 50]);
  });
});

describe('pickLog', () => {
  const log = (id: string, refs: string[]): LogConfig => ({
    id, name: id, intervalSec: 5, series: refs.map((ref) => ({ ref, tol: 0 })), algo: 'none', maxGapSec: 60, enabled: true,
  });

  it('suggests the first log that records the mash sensor', () => {
    const logs = [log('a', ['sensor/hlt']), log('b', ['actuator/heat', 'sensor/mash']), log('c', ['sensor/mash'])];
    expect(pickLog(logs, 'mash')?.id).toBe('b');
    expect(pickLog(logs, 'other')).toBeUndefined();
    expect(pickLog(logs, undefined)).toBeUndefined();
  });
});

describe('restActuals', () => {
  // Mashing in at minute 10 (62 °C, 20 min), a rest at 72 °C from minute 40 for 30 min.
  const row = (kind: string, name: string, tempC: number, startMin: number, holdMin: number) =>
    ({ step: { kind, name }, tempC, startMin, holdMin, fromC: 0, transition: { kind: 'none', min: 0, text: '' } }) as unknown as MashRow;
  const rows = [row('strike', 'Hauptguss', 70, 0, 0), row('doughIn', 'Einmaischen', 62, 10, 20), row('rest', 'Verzuckerung', 72, 40, 30)];
  const t0 = AT_SEC;   // mashing in
  // The log as [minutes after mashing in, temperature] points.
  const course = (pieces: [number, number][]) => {
    const xs: number[] = [];
    const ys: (number | null)[] = [];
    pieces.forEach(([min, c]) => { xs.push(t0 + min * 60); ys.push(c); });
    return { xs, ys };
  };
  const line = (from: number, to: number, a: number, b: number): [number, number][] =>
    Array.from({ length: to - from + 1 }, (_, i) => [from + i, a + ((b - a) * i) / Math.max(to - from, 1)]);

  it('a rest on time: its mean and how long the mash stayed in the band', () => {
    const { xs, ys } = course([...line(-10, -1, 50, 70), ...line(0, 20, 62, 62), ...line(21, 30, 63.5, 71.5), ...line(31, 60, 72, 72), ...line(61, 70, 74, 78)]);
    const [a, b] = restActuals(rows, AT, xs, ys);
    expect(a.row.step.name).toBe('Einmaischen');
    expect(a.meanC).toBeCloseTo(62, 5);
    expect(a.durationMin).toBe(20);                  // heating the strike water through 62 °C does not count
    expect(b.meanC).toBeCloseTo(72, 1);
    expect(b.durationMin).toBe(30);                  // 71.5 at minute 30 is in the band already
  });

  it('a rest reached late is found and counted from when it was reached', () => {
    const { xs, ys } = course([...line(0, 20, 62, 62), ...line(21, 60, 64, 66), ...line(61, 80, 72, 72)]);
    const [, b] = restActuals(rows, AT, xs, ys);
    expect(b.durationMin).toBe(19);
  });

  it('a rest never reached stays empty', () => {
    const { xs, ys } = course(line(0, 60, 62, 62));
    const [a, b] = restActuals(rows, AT, xs, ys);
    expect(a.durationMin).toBe(60);
    expect(b).toMatchObject({ meanC: null, durationMin: null });
  });

  it('rests close together end where the next band begins', () => {
    const close = [row('doughIn', 'A', 62, 0, 10), row('rest', 'B', 63.5, 10, 10)];
    const { xs, ys } = course([...line(0, 10, 62, 62), ...line(11, 20, 63.5, 63.5)]);
    const [a, b] = restActuals(close, AT, xs, ys);
    expect(a.durationMin).toBe(10);   // 63.5 °C at minute 11 is out of A's band and in B's
    expect(b.durationMin).toBe(9);
  });

  it('a gap in the log counts by the clock, empty cells do not', () => {
    const { xs, ys } = course([...line(0, 5, 62, 62), [10, 62], [15, 62], [16, 62], [17, 62], [18, 62], [19, 62], [20, 62]]);
    ys[2] = null;
    const [a] = restActuals(rows, AT, xs, ys);
    expect(a.durationMin).toBe(20);
    expect(a.meanC).toBe(62);
  });
});

describe('istCourse', () => {
  const d = { refs: ['sensor/mash', 'actuator/heat'], data: [[10, 20, 30, 40], [50, null, 52, 53], [0, 128, null, 255]] };
  const pct = (v: number) => (v / 255) * 100;

  it('cuts the log to the window and gives the heating in percent', () => {
    const [xs, temp, heat] = istCourse(d, 'sensor/mash', 'actuator/heat', pct, 20, 40);
    expect(xs).toEqual([20, 30, 40]);
    expect(temp).toEqual([null, 52, 53]);
    expect(heat[0]).toBeCloseTo(50.2, 1);
    expect(heat.slice(1)).toEqual([null, 100]);
  });

  it('leaves a column the log does not have empty', () => {
    const [xs, temp, heat] = istCourse(d, 'sensor/other', undefined, pct, 0, 100);
    expect(xs).toHaveLength(4);
    expect(temp.every((v) => v === null) && heat.every((v) => v === null)).toBe(true);
  });
});

describe('heatActuatorOf', () => {
  const actuator = (id: string): Actuator => ({
    id, meta: { kind: 'Continuous', quantity: 'Power', unit: '%', min: 0, max: 100, res: 1 } as Actuator['meta'],
    state: { v: 0, t: 0, ok: true }, target: 0, enabled: true,
  });
  const snap: Snapshot = {
    sensors: [], actuators: [actuator('ssr'), actuator('direct')],
    controllers: [{ id: 'pid', setpoint: 63, enabled: true, params: { actuator: 'ssr' } }],
  };

  it('finds the actuator of the mash heater: through its controller, else its own', () => {
    const { bh } = plan();
    const heaterId = bh.steps.mash!.heaterId;
    const link = (p: object) => ({ ...bh, devices: bh.devices.map((x) => (x.id === heaterId ? { ...x, manual: false, ...p } : x)) });
    expect(heatActuatorOf(bh, snap)).toBeUndefined();  // by hand
    expect(heatActuatorOf(link({ controller: 'pid' }), snap)?.id).toBe('ssr');
    expect(heatActuatorOf(link({ actuator: 'direct' }), snap)?.id).toBe('direct');
    expect(heatActuatorOf(link({ controller: 'gone' }), snap)).toBeUndefined();
  });
});
