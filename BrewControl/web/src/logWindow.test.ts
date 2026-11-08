import { describe, expect, it } from 'vitest';
import { brewLogConfig, mergeLogData, sessionsIn } from './logWindow';

const s = (start: number, active = false) => ({ start, size: 1, active });

describe('sessionsIn', () => {
  const sessions = [s(500), s(100), s(1000, true)];
  it('takes every session that overlaps the window, oldest first', () => {
    expect(sessionsIn(sessions, 400, 1200).map((x) => x.start)).toEqual([100, 500, 1000]);
    expect(sessionsIn(sessions, 600, 900).map((x) => x.start)).toEqual([500]);
    expect(sessionsIn(sessions, 500, 999).map((x) => x.start)).toEqual([500]);
  });
  it('a session lasts until the next one; the last one is open', () => {
    expect(sessionsIn(sessions, 5000, 6000).map((x) => x.start)).toEqual([1000]);
    expect(sessionsIn(sessions, 0, 50)).toEqual([]);
    expect(sessionsIn([], 0, 50)).toEqual([]);
  });
});

describe('mergeLogData', () => {
  it('joins the columns of all parts, a missing one stays empty', () => {
    const a = { refs: ['sensor/t'], data: [[1, 2], [60, 61]] };
    const b = { refs: ['sensor/t', 'actuator/h'], data: [[10, 11], [62, null], [1, 0]] };
    expect(mergeLogData([a, b])).toEqual({
      refs: ['sensor/t', 'actuator/h'],
      data: [[1, 2, 10, 11], [60, 61, 62, null], [null, null, 1, 0]],
    });
  });
  it('one part stays as it is', () => {
    const a = { refs: ['x'], data: [[1], [2]] };
    expect(mergeLogData([a])).toBe(a);
  });
});

describe('brewLogConfig', () => {
  it('records the sensors with a dead band and the rest without, bound to the controller', () => {
    const c = brewLogConfig({ name: 'Sudhaus A', intervalSec: 10, sensors: ['mash', undefined], others: ['actuator/ssr'], controller: 'pid' });
    expect(c.series).toEqual([{ ref: 'sensor/mash', tol: 0.1 }, { ref: 'actuator/ssr', tol: 0 }]);
    expect(c).toMatchObject({ name: 'Sudhaus A', intervalSec: 10, algo: 'swingingdoor', enabled: true, bindEnableTo: 'pid' });
  });
  it('without a controller it records always', () => {
    expect(brewLogConfig({ name: 'x', intervalSec: 60, sensors: ['t'], others: [] }).bindEnableTo).toBeUndefined();
  });
});
