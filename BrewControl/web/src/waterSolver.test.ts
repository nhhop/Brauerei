import { describe, expect, it } from 'vitest';
import { DEFAULT_BREWERY, TEMPLATES, type Brewery } from './brewhouse';
import type { CatalogIngredient } from './ingredientCatalog';
import { calcTreatment, type Column } from './recipeTreatment';
import { calcWater } from './recipeWater';
import { newRecipe, type Ingredient, type Recipe } from './recipes';
import { HCO3_PER_KS43, type TargetIons } from './waterChem';
import { AUTO_SALTS, TARGET_PROFILES, autoTreat, nnls, resolveTarget } from './waterSolver';

const catalog = [
  { id: 'malt:pils', kind: 'fermentable', owner: 'catalog', type: 'malt', role: 'base', name: 'Pilsner',
    colorEbc: [3.5, 3.5], extractDryPct: [80, 80], distilledWaterPh: [5.75, 5.75] },
  { id: 'aux:gypsum', kind: 'auxiliary', name: 'Gips', category: 'water-salt', defaultUnit: 'g', waterAgent: 'gypsum' },
  { id: 'aux:cacl2', kind: 'auxiliary', name: 'Calciumchlorid', category: 'water-salt', defaultUnit: 'g', waterAgent: 'cacl2' },
  { id: 'aux:epsom', kind: 'auxiliary', name: 'Bittersalz', category: 'water-salt', defaultUnit: 'g', waterAgent: 'epsom' },
  { id: 'aux:nacl', kind: 'auxiliary', name: 'Kochsalz', category: 'water-salt', defaultUnit: 'g', waterAgent: 'nacl' },
  { id: 'aux:lactic', kind: 'auxiliary', name: 'Milchsäure', category: 'acid', defaultUnit: 'ml', waterAgent: 'lactic', acidStrengthPct: 80 },
] as CatalogIngredient[];

const tap: Brewery = {
  ...DEFAULT_BREWERY, defaultWaterId: 'tap',
  waters: [{ id: 'tap', name: 'Leitung', ca: 96.7, mg: 6.29, na: 32.4, k: 2.18, cl: 77, so4: 36, hco3: 3.73 * HCO3_PER_KS43, ph: 7.4 }],
};
const ve: Brewery = { ...DEFAULT_BREWERY, defaultWaterId: 've' };
const herms = TEMPLATES.find((t) => t.key === 'herms3')!.build();
const salts = ['gypsum', 'cacl2', 'epsom', 'nacl'] as const;

function setup(extra: Ingredient[] = [], p: Partial<Recipe> = {}, b: Brewery = tap) {
  const malt: Ingredient = { id: 'm', kind: 'fermentable', name: 'Pilsner', amount: 5, timing: 'mash', ingredientId: 'malt:pils' };
  const recipe: Recipe = { ...newRecipe(), volumeL: 20, brewhouseId: herms.id, ingredients: [malt, ...extra], ...p };
  const w = calcWater(recipe, herms).water!;
  const col = (r: Recipe, key: Column['key']) => calcTreatment(r, w, b, catalog).columns.find((c) => c.key === key)!;
  return { recipe, w, col, run: (t: TargetIons, o: { acid?: 'lactic'; blendPct?: number } = {}) =>
    autoTreat(recipe, w, b, catalog, { target: t, salts: [...salts], ...o }) };
}
const ionsOf = (id: string) => resolveTarget({ id: `target:${id}` }, null)!.ions;

describe('nnls', () => {
  it('finds an exact non-negative solution', () => {
    const x = nnls([[1, 0], [0, 2], [1, 1]], [3, 4, 5]);
    expect(x[0]).toBeCloseTo(3, 9);
    expect(x[1]).toBeCloseTo(2, 9);
  });

  it('keeps every variable non-negative where plain least squares would not', () => {
    // unconstrained: x = (2, −1)
    const x = nnls([[1, 1], [1, -1], [0, 1]], [1, 3, -1]);
    expect(x.every((v) => v >= 0)).toBe(true);
    expect(x[1]).toBe(0);
    expect(x[0]).toBeCloseTo(2, 9);
  });
});

describe('target profiles', () => {
  it('lists the brewery\'s own targets first and resolves own ions', () => {
    const own = { id: 'mine', name: 'Mein Ziel', ca: 1, mg: 2, na: 3, cl: 4, so4: 5, hco3: 6, target: true as const };
    expect(resolveTarget({ id: 'mine' }, { ...tap, waters: [...tap.waters!, own] })!.name).toBe('Mein Ziel');
    expect(resolveTarget({ ions: ionsOf('pilsen') }, null)!.name).toBe('Eigene Werte');
    expect(resolveTarget({}, null)).toBeUndefined();
    expect(new Set(TARGET_PROFILES.map((p) => p.id)).size).toBe(TARGET_PROFILES.length);
  });
});

describe('autoTreat', () => {
  it('meets a target that the allowed salts reach exactly', () => {
    // VE water with 0.2 g/l gypsum and 0.1 g/l calcium chloride
    const gypsum = 0.2 / 172.17;
    const cacl2 = 0.1 / 147.01;
    const target: TargetIons = { ca: (gypsum + cacl2) * 40078, mg: 0, na: 0, cl: 2 * cacl2 * 35453, so4: gypsum * 96060, hco3: 0 };
    const { run, col } = setup([], {}, ve);
    const r = run(target);
    const strike = col(r.recipe, 'strike').after.ions;
    for (const ion of ['ca', 'mg', 'na', 'cl', 'so4'] as const) expect(strike[ion]).toBeCloseTo(target[ion], 0);
    expect(r.rows.map((i) => i.ingredientId).sort()).toEqual(['aux:cacl2', 'aux:gypsum']);
    expect(r.rows.every((i) => i.timing === 'water' && i.auto && i.amount > 0)).toBe(true);
  });

  it('blends the user\'s hard tap water mostly with VE water for Pilsen', () => {
    const r = setup().run(ionsOf('pilsen'));
    expect(r.blendPct).toBeGreaterThanOrEqual(85);
    expect(r.recipe.water!.sources!.strike!.blendPct).toBe(r.blendPct);
    expect(r.recipe.water!.sources!.sparge!.blendPct).toBe(r.blendPct);
  });

  it('never doses a negative amount and keeps a fixed share', () => {
    for (const p of TARGET_PROFILES) {
      const r = setup().run(p, { blendPct: 50 });
      expect(r.blendPct).toBe(50);
      expect(r.rows.every((i) => i.amount > 0)).toBe(true);
    }
  });

  it('replaces its own additions and keeps the ones made by hand', () => {
    const own: Ingredient = { id: 'h', kind: 'auxiliary', name: 'Gips', ingredientId: 'aux:gypsum', amount: 1, timing: 'mash' };
    const old: Ingredient = { id: 'a', kind: 'auxiliary', name: 'Kochsalz', ingredientId: 'aux:nacl', amount: 9, timing: 'water', auto: true };
    const r = setup([own, old]).run(ionsOf('pale-hoppy'));
    const ids = r.recipe.ingredients.map((i) => i.id);
    expect(ids).toContain('h');
    expect(ids).not.toContain('a');
  });

  it('brings the mash to its target pH with acid after the pH measurement', () => {
    const { run, col } = setup([], { water: { targetPh: { mash: 5.3 } } });
    const r = run(ionsOf('pale-hoppy'), { acid: 'lactic' });
    const acid = r.rows.find((i) => i.ingredientId === 'aux:lactic')!;
    expect(acid.timing).toBe('mashPh');
    expect(col(r.recipe, 'mash').ph!.after).toBeCloseTo(5.3, 1);
  });

  it('under the model kolbach brings the mash RA to the middle of its range', () => {
    const b = { ...tap, phModel: 'kolbach' as const };
    const { recipe, w } = setup([], {}, b);
    const r = autoTreat(recipe, w, b, catalog, { target: ionsOf('balanced'), salts: AUTO_SALTS, acid: 'lactic' });
    const mash = calcTreatment(r.recipe, w, b, catalog).columns.find((c) => c.key === 'mash')!;
    const [lo, hi] = mash.raTarget!;
    expect(mash.after.ra).toBeCloseTo((lo + hi) / 2, 1);
  });
});
