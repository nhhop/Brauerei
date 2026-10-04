import { describe, expect, it } from 'vitest';
import { calcStats, rangeValue } from './recipeStats';
import { newRecipe, type Ingredient, type Recipe } from './recipes';
import type { CatalogIngredient } from './ingredientCatalog';

const catalog = [
  { id: 'malt:pils', kind: 'fermentable', type: 'malt', name: 'Pilsner', colorEbc: [2.5, 4.5], extractDryPct: [80.5, null], moisturePct: [null, 5] },
  { id: 'sugar:cane', kind: 'fermentable', type: 'sugar', name: 'Zucker', colorEbc: [0, 0], extractDryPct: [100, 100] },
  { id: 'hop:motueka', kind: 'hop', name: 'Motueka', alphaPct: [6.5, 7.5] },
  { id: 'yeast:us05', kind: 'culture', organism: 'saccharomyces', name: 'US-05', attenuationPct: [78, 82] },
] as CatalogIngredient[];

let n = 0;
const row = (p: Partial<Ingredient>): Ingredient =>
  ({ id: String(n++), kind: 'fermentable', name: 'x', amount: 0, timing: 'mash', ...p });
const recipeWith = (ingredients: Ingredient[], p: Partial<Recipe> = {}): Recipe =>
  ({ ...newRecipe(), volumeL: 20, ingredients, ...p });

describe('rangeValue', () => {
  it('uses the midpoint, or the one end that is set', () => {
    expect(rangeValue([2, 4])).toBe(3);
    expect(rangeValue([80.5, null])).toBe(80.5);
    expect(rangeValue([null, 5])).toBe(5);
  });
});

describe('calcStats', () => {
  const pils = row({ amount: 5, ingredientId: 'malt:pils' });

  it('computes the wort strength of a single malt', () => {
    // 5 kg · 0.805 · 0.95 · 0.75 = 2.87 kg extract in 20 l
    const s = calcStats(recipeWith([pils]), catalog);
    expect(s.ogPlato).toBeGreaterThan(13);
    expect(s.ogPlato).toBeLessThan(14);
    expect(s.ebc).toBeGreaterThan(7);
    expect(s.notes.filter((x) => x.includes('Vergärbaren'))).toEqual([]);
  });

  it('does not hold back sugar with the brewhouse efficiency', () => {
    const sugar = row({ amount: 1, timing: 'boil', ingredientId: 'sugar:cane' });
    const normal = calcStats(recipeWith([sugar]), catalog).ogPlato!;
    const lowEff = calcStats(recipeWith([sugar], { efficiencyPct: 50 }), catalog).ogPlato!;
    expect(lowEff).toBeCloseTo(normal, 9);
  });

  it('ignores priming sugar added at bottling', () => {
    const priming = row({ amount: 1, timing: 'bottling', ingredientId: 'sugar:cane' });
    expect(calcStats(recipeWith([priming]), catalog).ogPlato).toBeUndefined();
  });

  it('leaves out free-text rows and says so', () => {
    const s = calcStats(recipeWith([pils, row({ amount: 1, name: 'Mystery malt' })]), catalog);
    expect(s.ogPlato).toBeDefined();
    expect(s.notes).toContain('1 von 2 Vergärbaren ohne Katalogverknüpfung, nicht eingerechnet');
  });

  it('gives nothing without linked fermentables', () => {
    const s = calcStats(recipeWith([row({ amount: 5 })]), catalog);
    expect(s.ogPlato).toBeUndefined();
    expect(s.ebc).toBeUndefined();
  });

  it('computes alcohol only with a linked yeast', () => {
    const noYeast = calcStats(recipeWith([pils]), catalog);
    expect(noYeast.abv).toBeUndefined();
    expect(noYeast.notes).toContain('Alkohol braucht eine Hefe mit Katalogverknüpfung');
    const yeast = row({ kind: 'yeast', amount: 11, timing: 'pitch', ingredientId: 'yeast:us05' });
    const s = calcStats(recipeWith([pils, yeast]), catalog);
    expect(s.fgPlato).toBeCloseTo(s.ogPlato! * 0.2, 6);
    expect(s.abv).toBeGreaterThan(5);
    expect(s.abv).toBeLessThan(7);
  });

  describe('bitterness', () => {
    const hop = (p: Partial<Ingredient>) =>
      row({ kind: 'hop', amount: 20, timing: 'boil', ingredientId: 'hop:motueka', ...p });
    const ibu = (ing: Ingredient[]) => calcStats(recipeWith(ing), catalog).ibu!;

    it('uses the whole boil when no minutes are given', () => {
      expect(ibu([pils, hop({})])).toBeCloseTo(ibu([pils, hop({ timeMin: 60 })]), 9);
    });

    it('drops with fewer minutes in the boil', () => {
      expect(ibu([pils, hop({ timeMin: 15 })])).toBeLessThan(ibu([pils, hop({ timeMin: 60 })]));
    });

    it('counts a whirlpool addition', () => {
      expect(ibu([pils, hop({ timing: 'whirlpool' })])).toBeGreaterThan(0);
    });

    it('skips dry hops and notes it', () => {
      const s = calcStats(recipeWith([pils, hop({ timing: 'primary' })]), catalog);
      expect(s.ibu).toBeUndefined();
      expect(s.notes.some((x) => x.startsWith('1 Hopfengaben'))).toBe(true);
    });

    it('needs a wort strength', () => {
      const s = calcStats(recipeWith([hop({})]), catalog);
      expect(s.ibu).toBeUndefined();
      expect(s.notes).toContain('Bittere braucht die Stammwürze (Vergärbares verknüpfen)');
    });
  });
});
