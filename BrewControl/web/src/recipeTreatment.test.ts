import { describe, expect, it } from 'vitest';
import { DEFAULT_BREWERY, TEMPLATES, type Brewery } from './brewhouse';
import type { CatalogIngredient } from './ingredientCatalog';
import { calcWater } from './recipeWater';
import { calcTreatment, suggestAcid } from './recipeTreatment';
import { newRecipe, type Ingredient, type Recipe } from './recipes';
import { HCO3_PER_KS43, applyAgents, agentMmol, WATER_AGENTS, waterPh } from './waterChem';

const catalog = [
  { id: 'aux:gypsum', kind: 'auxiliary', name: 'Gips', category: 'water-salt', defaultUnit: 'g', waterAgent: 'gypsum' },
  { id: 'aux:lactic', kind: 'auxiliary', name: 'Milchsäure', category: 'acid', defaultUnit: 'ml', waterAgent: 'lactic', acidStrengthPct: 80 },
  { id: 'aux:enzyme', kind: 'auxiliary', name: 'Enzym', category: 'enzyme', defaultUnit: 'g' },
] as CatalogIngredient[];

const brewery: Brewery = {
  ...DEFAULT_BREWERY, defaultWaterId: 'tap',
  waters: [{ id: 'tap', name: 'Leitung', ca: 96.7, mg: 6.29, na: 32.4, k: 2.18, cl: 77, so4: 36, hco3: 3.73 * HCO3_PER_KS43, ph: 7.4 }],
};
const herms = TEMPLATES.find((t) => t.key === 'herms3')!.build();

let n = 0;
const aux = (p: Partial<Ingredient>): Ingredient =>
  ({ id: String(n++), kind: 'auxiliary', name: 'x', amount: 0, timing: 'water', ...p });

function treat(extra: Ingredient[], p: Partial<Recipe> = {}) {
  const malt: Ingredient = { id: 'm', kind: 'fermentable', name: 'Pilsner', amount: 5, timing: 'mash' };
  const recipe: Recipe = { ...newRecipe(), volumeL: 20, brewhouseId: herms.id, ingredients: [malt, ...extra], ...p };
  const w = calcWater(recipe, herms).water!;
  return { w, ...calcTreatment(recipe, w, brewery, catalog) };
}

describe('calcTreatment', () => {
  it('shares "Brauwasser" out by fill volume, so both waters end up alike', () => {
    const { columns, w } = treat([aux({ amount: 6, ingredientId: 'aux:gypsum' })]);
    const [strike, mash, sparge] = columns;
    expect(columns.map((c) => c.key)).toEqual(['strike', 'mash', 'sparge', 'total']);
    expect(strike.doses[0].amount + sparge.doses[0].amount).toBeCloseTo(6, 9);
    expect(strike.doses[0].amount / sparge.doses[0].amount).toBeCloseTo(w.strikeFillL / w.spargeFillL, 9);
    expect(strike.after.ions.so4).toBeCloseTo(sparge.after.ions.so4, 9);
    // the mash starts from the treated strike water
    expect(mash.before.ions.so4).toBeCloseTo(strike.after.ions.so4, 9);
  });

  it('puts mash additions on the strike water volume, and skips foreign rows', () => {
    const { columns, notes } = treat([
      aux({ amount: 2, timing: 'mash', ingredientId: 'aux:gypsum' }),
      aux({ amount: 1, timing: 'mash', ingredientId: 'aux:enzyme' }),
      aux({ amount: 1, timing: 'mainWater', name: 'Freitext' }),
    ]);
    const mash = columns.find((c) => c.key === 'mash')!;
    expect(mash.volumeL).toBe(17.5);
    expect(mash.doses).toHaveLength(1);
    expect(notes).toEqual(['1 von 2 Gaben ohne Wassermittel aus dem Katalog, nicht eingerechnet.']);
  });

  it('blends the source water and drops the sparge column without sparge', () => {
    const { columns } = treat([], { water: { sparge: false, sources: { strike: { blendPct: 70 } } } });
    expect(columns.map((c) => c.key)).toEqual(['strike', 'mash', 'total']);
    expect(columns[0].before.ions.ca).toBeCloseTo(96.7 * 0.3, 9);
  });

  it('adds the dilution column only with a planned dilution', () => {
    const { columns } = treat([], { volumeL: 30, water: { dilution: { at: 'kettle', lead: 'volume', volumeL: 10 } } });
    const dilution = columns.find((c) => c.key === 'dilution')!;
    expect(dilution.volumeL).toBe(10);
  });

  it('suggests lactic acid for the sparge water, or sets the acid already there', () => {
    const { columns } = treat([], { water: { sources: { sparge: { blendPct: 70 } } } });
    const sparge = columns.find((c) => c.key === 'sparge')!;
    const s = suggestAcid(sparge, 5.8, catalog)!;
    expect(s.ingredient).toBeUndefined();
    expect(s.entry!.id).toBe('aux:lactic');
    const ph = waterPh(applyAgents(sparge.state, sparge.volumeL, [{ agent: WATER_AGENTS.lactic, mmol: agentMmol(WATER_AGENTS.lactic, s.amount, 80) }]));
    expect(ph).toBeCloseTo(5.8, 3);

    const acid = aux({ amount: 9, timing: 'sparge', ingredientId: 'aux:lactic' });
    const again = treat([acid], { water: { sources: { sparge: { blendPct: 70 } } } }).columns.find((c) => c.key === 'sparge')!;
    const set = suggestAcid(again, 5.8, catalog)!;
    expect(set.ingredient).toBe(acid);
    expect(set.amount).toBeCloseTo(s.amount, 6);
  });

  it('carries the waters into the wort and concentrates them in the boil', () => {
    const { columns, w } = treat([aux({ amount: 6, ingredientId: 'aux:gypsum' })]);
    const strike = columns[0];
    const total = columns.find((c) => c.key === 'total')!;
    // same concentration in both waters, so the wort only concentrates
    expect(total.after.ions.so4).toBeCloseTo(strike.after.ions.so4 * w.preBoilL / w.knockOutL, 9);
    expect(total.volumeL).toBe(20);
    expect(total.wort).toBe(true);
  });

  it('shows the wort columns only with additions there', () => {
    const { columns, w } = treat([
      aux({ amount: 2, timing: 'preBoil', ingredientId: 'aux:gypsum' }),
      aux({ amount: 3, timing: 'knockOut', ingredientId: 'aux:lactic' }),
    ]);
    expect(columns.map((c) => c.key)).toEqual(['strike', 'mash', 'sparge', 'preBoil', 'knockOut', 'total']);
    const preBoil = columns.find((c) => c.key === 'preBoil')!;
    expect(preBoil.volumeL).toBe(w.preBoilL);
    expect(preBoil.after.ions.so4 - preBoil.before.ions.so4).toBeCloseTo((2000 / 172.17) * 96.06 / w.preBoilL, 6);
    const knockOut = columns.find((c) => c.key === 'knockOut')!;
    expect(knockOut.after.ions.lactate).toBeGreaterThan(0);
  });

  it('thins the total with a dilution in the fermenter', () => {
    const p = { volumeL: 30, water: { dilution: { at: 'fermenter' as const, lead: 'volume' as const, volumeL: 5 }, sources: { dilution: { waterId: 've' } } } };
    const { columns, w } = treat([], p);
    const total = columns.find((c) => c.key === 'total')!;
    expect(total.volumeL).toBeCloseTo(w.dilution.finalL, 9);
    const undiluted = columns[0].after.ions.ca * w.preBoilL / w.knockOutL;
    expect(total.after.ions.ca).toBeCloseTo(undiluted * w.dilution.restL! / w.dilution.finalL, 6);
  });
});
