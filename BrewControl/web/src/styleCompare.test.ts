import { describe, expect, it } from 'vitest';
import { compareToStyle } from './styleCompare';
import type { RecipeStats } from './recipeStats';
import type { BjcpStyle } from './styleSource';

// Altbier, BJCP 2021 (7B)
const alt: BjcpStyle = {
  id: '7B', name: 'Altbier', category: 'Amber Bitter European Beer', categoryId: '7',
  og: [1.044, 1.052], fg: [1.008, 1.014], ibu: [25, 50], srm: [9, 17], abv: [4.3, 5.5],
};
const stats = (p: Partial<RecipeStats>): RecipeStats => ({ notes: [], ...p });
const row = (s: RecipeStats, key: string) => compareToStyle(s, alt).rows.find((r) => r.key === key)!;

describe('compareToStyle', () => {
  it('converts the style ranges to °P and EBC', () => {
    // °P = 668·SG − 205·SG² − 463 → 10.96 and 12.86; EBC = SRM × 1.97 → 17.73 and 33.49
    const og = row(stats({}), 'og');
    expect(og.min).toBeCloseTo(10.96, 2);
    expect(og.max).toBeCloseTo(12.86, 2);
    const ebc = row(stats({}), 'ebc');
    expect(ebc.min).toBeCloseTo(17.73, 2);
    expect(ebc.max).toBeCloseTo(33.49, 2);
  });

  it('marks values inside, below and above the range', () => {
    expect(row(stats({ ibu: 30 }), 'ibu').status).toBe('in');
    const low = row(stats({ ibu: 20 }), 'ibu');
    expect(low.status).toBe('below');
    expect(low.delta).toBeCloseTo(5, 9);
    const high = row(stats({ ibu: 58 }), 'ibu');
    expect(high.status).toBe('above');
    expect(high.delta).toBeCloseTo(8, 9);
  });

  it('counts the limits as inside', () => {
    expect(row(stats({ abv: 4.3 }), 'abv').status).toBe('in');
    expect(row(stats({ abv: 5.5 }), 'abv').status).toBe('in');
  });

  it('treats a missing value as unknown and leaves it out of the count', () => {
    const c = compareToStyle(stats({ ibu: 30, abv: 9 }), alt);
    expect(row(stats({}), 'ebc').status).toBe('unknown');
    expect(c.knownCount).toBe(2);
    expect(c.inCount).toBe(1);
  });

  it('counts all five figures when everything is inside', () => {
    const c = compareToStyle(stats({ ogPlato: 12, fgPlato: 2.5, abv: 5, ibu: 35, ebc: 25 }), alt);
    // 1.008–1.014 SG is 2.05–3.58 °P
    expect(c.rows.map((r) => r.status)).toEqual(['in', 'in', 'in', 'in', 'in']);
    expect(c.inCount).toBe(5);
    expect(c.knownCount).toBe(5);
  });
});
