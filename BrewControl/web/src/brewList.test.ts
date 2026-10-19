import { describe, expect, it } from 'vitest';
import { groupBrews } from './brewList';
import type { BrewSummary } from './brews';

const brew = (number: number, status: BrewSummary['status']) => ({ id: `b${number}`, number, status }) as BrewSummary;

describe('groupBrews', () => {
  it('splits by status, highest number first', () => {
    const g = groupBrews([brew(1, 'done'), brew(3, 'active'), brew(2, 'done'), brew(4, 'planned')]);
    expect(g.done.map((b) => b.number)).toEqual([2, 1]);
    expect(g.active.map((b) => b.number)).toEqual([3]);
    expect(g.planned.map((b) => b.number)).toEqual([4]);
  });
});
