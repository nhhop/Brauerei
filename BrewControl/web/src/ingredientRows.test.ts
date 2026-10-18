import { describe, expect, it } from 'vitest';
import { balance, ingredientFigures } from './ingredientRows';
import { calcStats } from './recipeStats';
import { newRecipe, type Ingredient, type Recipe } from './recipes';
import type { CatalogIngredient } from './ingredientCatalog';

const catalog = [
  { id: 'malt:pils', kind: 'fermentable', type: 'malt', name: 'Pilsner', colorEbc: [3, 4], extractDryPct: [80.5, null], moisturePct: [null, 5] },
  { id: 'malt:cara', kind: 'fermentable', type: 'malt', name: 'Cara', colorEbc: [110, 130], extractDryPct: [74, 74] },
  { id: 'sugar:cane', kind: 'fermentable', type: 'sugar', name: 'Zucker', colorEbc: [0, 0], extractDryPct: [100, 100] },
  { id: 'hop:citra', kind: 'hop', name: 'Citra', alphaPct: [11, 14], oilMlPer100g: [2, 3] },
] as CatalogIngredient[];

let n = 0;
const row = (p: Partial<Ingredient>): Ingredient =>
  ({ id: String(n++), kind: 'fermentable', name: 'x', amount: 0, timing: 'mash', ...p });
const recipeWith = (ingredients: Ingredient[], p: Partial<Recipe> = {}): Recipe =>
  ({ ...newRecipe(), volumeL: 20, ingredients, ...p });
const total = (xs: (number | undefined)[]) => Math.round(xs.reduce<number>((s, x) => s + (x ?? 0), 0) * 10) / 10;

describe('balance', () => {
  it('puts the rounding difference on the largest value', () => {
    const b = balance(new Map([['a', 33.34], ['b', 33.33], ['c', 33.33]]), 1, 100);
    expect([...b.values()]).toEqual([33.4, 33.3, 33.3]);
  });
});

describe('ingredientFigures', () => {
  const pils = row({ amount: 4.2, ingredientId: 'malt:pils' });
  const cara = row({ amount: 0.3, ingredientId: 'malt:cara' });
  const sugar = row({ amount: 0.5, timing: 'boil', ingredientId: 'sugar:cane' });
  const free = row({ amount: 0.1, name: 'Mystery' });
  const priming = row({ amount: 0.1, timing: 'bottling', ingredientId: 'sugar:cane' });
  const hops = [
    row({ kind: 'hop', amount: 15, timing: 'boil', timeMin: 60, ingredientId: 'hop:citra' }),
    row({ kind: 'hop', amount: 30, timing: 'whirlpool', ingredientId: 'hop:citra' }),
    row({ kind: 'hop', amount: 50, timing: 'maturation', ingredientId: 'hop:citra' }),
  ];
  const r = recipeWith([pils, cara, sugar, free, priming, ...hops]);
  const f = ingredientFigures(r, catalog);
  const s = calcStats(r, catalog);
  const wort = [pils, cara, sugar, free];

  it('shares the wort fermentables to 100 %', () => {
    expect(f.wortKg).toBeCloseTo(5.1, 9);
    expect(total(wort.map((i) => f.rows.get(i.id)?.sharePct))).toBe(100);
    expect(f.rows.get(priming.id)?.sharePct).toBeUndefined();
  });

  it('adds the rows up to the gravity and colour of the recipe', () => {
    expect(total(wort.map((i) => f.rows.get(i.id)?.plato))).toBe(Math.round(s.ogPlato! * 10) / 10);
    expect(total(wort.map((i) => f.rows.get(i.id)?.ebc))).toBe(Math.round(s.ebc! * 10) / 10);
    expect(f.rows.get(cara.id)!.ebc!).toBeGreaterThan(f.rows.get(pils.id)!.ebc!);
    // 0 EBC is still 0.56 °L after Daniels, as in moreyEbc
    expect(f.rows.get(sugar.id)!.ebc!).toBeLessThan(f.rows.get(pils.id)!.ebc!);
    expect(f.rows.get(free.id)?.plato).toBeUndefined();
  });

  it('gives the bitterness per addition and the oil', () => {
    const ibus = hops.map((i) => f.rows.get(i.id)?.ibu);
    expect(ibus[0]! + ibus[1]!).toBe(Math.round(s.ibu!));
    expect(ibus[2]).toBeUndefined();
    expect(f.rows.get(hops[2].id)!.oilMl).toBe(1.25);
    expect(f.hopG).toBe(95);
    expect(f.coldGPerL).toBeGreaterThan(50 / 20);
  });

  it('gives shares only without the catalog', () => {
    const bare = ingredientFigures(r, null);
    expect(bare.ogPlato).toBeUndefined();
    expect(bare.rows.get(pils.id)).toEqual({ sharePct: 82.3 }); // 82.35 rounds up, but carries the difference to 100 %
  });
});
