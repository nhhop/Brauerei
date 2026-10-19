import { describe, expect, it } from 'vitest';
import { ebcSwatch, filterRows, recipeRows, sortRows } from './recipeList';
import type { BrewSummary } from './brews';
import type { RecipeSummary } from './recipes';

const recipe = (id: string, p: Partial<RecipeSummary> = {}): RecipeSummary =>
  ({ id, name: id, style: '', volumeL: 20, status: 'final', updatedAt: 0, ...p });
const brew = (rootId: string, brewDate?: string) => ({ rootId, brewDate }) as BrewSummary;

describe('recipeRows', () => {
  it('counts brews of every version and takes the newest brew date', () => {
    const rows = recipeRows([[recipe('a'), recipe('a2', { rootId: 'a', version: 2 })]],
      [brew('a', '2026-03-01'), brew('a', '2026-05-01'), brew('b', '2027-01-01')]);
    expect(rows[0].latest.id).toBe('a2');
    expect(rows[0].brewCount).toBe(2);
    expect(rows[0].lastBrewed).toBe('2026-05-01');
  });
  it('shows no brews while the brew list is not loaded', () => {
    expect(recipeRows([[recipe('a')]], null)[0].brewCount).toBe(0);
  });
});

describe('filterRows', () => {
  const rows = recipeRows([[recipe('x', { name: 'Citra Pale Ale', style: '18B' })], [recipe('y', { name: 'Stout' })]], []);
  it('matches name or style, ignoring case', () => {
    expect(filterRows(rows, 'pale').map((r) => r.latest.id)).toEqual(['x']);
    expect(filterRows(rows, '18b').map((r) => r.latest.id)).toEqual(['x']);
    expect(filterRows(rows, '  ')).toHaveLength(2);
  });
});

describe('sortRows', () => {
  const rows = recipeRows([[recipe('b', { name: 'B', ibu: 20 })], [recipe('a', { name: 'a' })], [recipe('c', { name: 'C', ibu: 40 })]], []);
  it('sorts names ascending', () => {
    expect(sortRows(rows, 'name').map((r) => r.latest.id)).toEqual(['a', 'b', 'c']);
  });
  it('sorts figures descending with missing values last', () => {
    expect(sortRows(rows, 'ibu').map((r) => r.latest.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('ebcSwatch', () => {
  it('gets darker with the colour and flips the text colour', () => {
    expect(ebcSwatch(8).fg).toBe('#1a1a1a');
    expect(ebcSwatch(80).fg).toBe('#ffffff');
    expect(ebcSwatch(500).bg).toBe(ebcSwatch(80).bg);
  });
});
