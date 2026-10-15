import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../../brewhouse';
import { calcMash } from '../../mashPlan';
import { calcWater } from '../../recipeWater';
import { newRecipe, type Recipe } from '../../recipes';
import type { Actuator, LogConfig, Snapshot } from '../../types';
import { fillLinear, heatActuatorOf, istCourse, pickLog, sessionFor, sollCourse } from './MashCourse';

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

describe('pickLog and sessionFor', () => {
  const log = (id: string, refs: string[]): LogConfig => ({
    id, name: id, intervalSec: 5, series: refs.map((ref) => ({ ref, tol: 0 })), algo: 'none', maxGapSec: 60, enabled: true,
  });

  it('suggests the first log that records the mash sensor', () => {
    const logs = [log('a', ['sensor/hlt']), log('b', ['actuator/heat', 'sensor/mash']), log('c', ['sensor/mash'])];
    expect(pickLog(logs, 'mash')?.id).toBe('b');
    expect(pickLog(logs, 'other')).toBeUndefined();
    expect(pickLog(logs, undefined)).toBeUndefined();
  });

  it('takes the latest session begun before the end of the course', () => {
    const sessions = [{ start: 100, size: 1, active: false }, { start: 500, size: 1, active: false }, { start: 900, size: 1, active: true }];
    expect(sessionFor(sessions, 700)?.start).toBe(500);
    expect(sessionFor(sessions, 2000)?.active).toBe(true);
    expect(sessionFor(sessions, 50)).toBeUndefined();
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
