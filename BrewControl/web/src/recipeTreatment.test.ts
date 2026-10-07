import { describe, expect, it } from 'vitest';
import { DEFAULT_BREWERY, TEMPLATES, type Brewery } from './brewhouse';
import type { CatalogIngredient } from './ingredientCatalog';
import { calcWater } from './recipeWater';
import { BOIL_PH_DROP, alkalinitySlope, raRangeForColor } from './mashPh';
import { beerEbc, wortExtract } from './recipeStats';
import { calcTreatment, suggestAgent, type Column } from './recipeTreatment';
import { newRecipe, type Ingredient, type Recipe } from './recipes';
import { HCO3_PER_KS43, applyAgents, agentMmol, WATER_AGENTS, waterPh } from './waterChem';

const catalog = [
  { id: 'malt:pils', kind: 'fermentable', owner: 'catalog', type: 'malt', role: 'base', name: 'Pilsner',
    colorEbc: [3.5, 3.5], extractDryPct: [80, 80], distilledWaterPh: [5.75, 5.75] },
  { id: 'aux:gypsum', kind: 'auxiliary', name: 'Gips', category: 'water-salt', defaultUnit: 'g', waterAgent: 'gypsum' },
  { id: 'aux:nahco3', kind: 'auxiliary', name: 'Natron', category: 'water-salt', defaultUnit: 'g', waterAgent: 'nahco3' },
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

function treat(extra: Ingredient[], p: Partial<Recipe> = {}, b: Brewery = brewery, maltId = 'malt:pils') {
  const malt: Ingredient = { id: 'm', kind: 'fermentable', name: 'Pilsner', amount: 5, timing: 'mash', ingredientId: maltId };
  const recipe: Recipe = { ...newRecipe(), volumeL: 20, brewhouseId: herms.id, ingredients: [malt, ...extra], ...p };
  const w = calcWater(recipe, herms).water!;
  return { w, recipe, ...calcTreatment(recipe, w, b, catalog) };
}
const col = (columns: Column[], key: Column['key']) => columns.find((c) => c.key === key)!;

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
    const s = suggestAgent(sparge, 5.8, catalog)!;
    expect(s.ingredient).toBeUndefined();
    expect(s.entry!.id).toBe('aux:lactic');
    const ph = waterPh(applyAgents(sparge.state, sparge.volumeL, [{ agent: WATER_AGENTS.lactic, mmol: agentMmol(WATER_AGENTS.lactic, s.amount, 80) }]));
    expect(ph).toBeCloseTo(5.8, 3);

    const acid = aux({ amount: 9, timing: 'sparge', ingredientId: 'aux:lactic' });
    const again = treat([acid], { water: { sources: { sparge: { blendPct: 70 } } } }).columns.find((c) => c.key === 'sparge')!;
    const set = suggestAgent(again, 5.8, catalog)!;
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

describe('calcTreatment pH (Troester)', () => {
  const lactic = (ml: number, timing: Ingredient['timing']) => aux({ amount: ml, timing, ingredientId: 'aux:lactic' });

  it('estimates the mash pH before and after the addition after the pH measurement', () => {
    const { columns, w, grist } = treat([lactic(3, 'mashPh'), aux({ amount: 3, timing: 'mash', ingredientId: 'aux:gypsum' })]);
    const strike = col(columns, 'strike');
    const mash = col(columns, 'mash');
    expect(grist!.ratio).toBe(3.5);
    expect(grist!.diPh).toBe(5.75);
    // without gypsum the mash starts from the strike water's RA
    const plain = col(treat([]).columns, 'mash');
    expect(plain.ph!.before).toBeCloseTo(5.75 + alkalinitySlope(3.5) * strike.after.ra, 9);
    expect(plain.ph!.after).toBe(plain.ph!.before);
    // gypsum at "Maische" counts before the measurement, the acid after it
    expect(mash.ph!.before).toBeLessThan(plain.ph!.before);
    expect(mash.ph!.after).toBeLessThan(mash.ph!.before);
    expect(w.strikeL).toBe(mash.volumeL);
  });

  it('suggests lactic acid after the pH measurement for the mash target, then sets that one', () => {
    const mash = col(treat([]).columns, 'mash');
    const s = suggestAgent(mash, 5.4, catalog)!;
    expect(s.entry!.id).toBe('aux:lactic');
    const acid = lactic(s.amount, 'mashPh');
    const again = col(treat([acid]).columns, 'mash');
    expect(again.ph!.after).toBeCloseTo(5.4, 3);
    // an acid at "Maische" stays as it is, the helper adds after the measurement
    const early = col(treat([lactic(1, 'mash')]).columns, 'mash');
    expect(suggestAgent(early, 5.4, catalog)!.ingredient).toBeUndefined();
    expect(suggestAgent(again, 5.3, catalog)!.ingredient).toBe(acid);
  });

  it('carries the mash pH into the wort, less the boil', () => {
    const { columns } = treat([aux({ amount: 0, timing: 'preBoil', ingredientId: 'aux:gypsum' }), lactic(0, 'knockOut')],
      { water: { sources: { sparge: { blendPct: 100 } } } });
    const [mash, preBoil, knockOut, total] = (['mash', 'preBoil', 'knockOut', 'total'] as const).map((k) => col(columns, k));
    // VE water as sparge brings nothing
    expect(preBoil.ph!.before).toBeCloseTo(mash.ph!.after, 9);
    expect(knockOut.ph!.before).toBeCloseTo(preBoil.ph!.after - BOIL_PH_DROP, 9);
    expect(total.ph!.after).toBeCloseTo(knockOut.ph!.after, 9);
    // tap water as sparge raises it
    const tapSparge = col(treat([aux({ amount: 0, timing: 'preBoil', ingredientId: 'aux:gypsum' })]).columns, 'preBoil');
    expect(tapSparge.ph!.before).toBeGreaterThan(preBoil.ph!.before);
  });

  it('raises the knock-out with baking soda, lowers it with acid, and the helper meets the target', () => {
    const phWith = (g: number) => col(treat([aux({ amount: g, timing: 'knockOut', ingredientId: 'aux:nahco3' })]).columns, 'knockOut').ph!.after;
    const up = [0, 2, 4, 8].map(phWith);
    for (let i = 1; i < up.length; i++) expect(up[i]).toBeGreaterThan(up[i - 1]);
    const down = [0, 1, 2, 4].map((ml) => col(treat([lactic(ml, 'knockOut')]).columns, 'knockOut').ph!.after);
    for (let i = 1; i < down.length; i++) expect(down[i]).toBeLessThan(down[i - 1]);

    // kveik: above the start the helper takes a base, even with an acid in the column
    const knockOut = col(treat([lactic(1, 'knockOut')]).columns, 'knockOut');
    const up03 = knockOut.ph!.before + 0.3;
    const s = suggestAgent(knockOut, up03, catalog)!;
    expect(s.entry!.id).toBe('aux:nahco3');
    const raised = col(treat([lactic(1, 'knockOut'), aux({ amount: s.amount, timing: 'knockOut', ingredientId: 'aux:nahco3' })]).columns, 'knockOut');
    expect(raised.ph!.after).toBeCloseTo(up03, 3);
    // below the start an acid
    const preBoil = col(treat([lactic(0, 'preBoil')]).columns, 'preBoil');
    const down04 = preBoil.ph!.before - 0.4;
    const a = suggestAgent(preBoil, down04, catalog)!;
    const lowered = col(treat([lactic(a.amount, 'preBoil')]).columns, 'preBoil');
    expect(lowered.ph!.after).toBeCloseTo(down04, 3);
  });

  it('gives only a note without linked malts', () => {
    const { columns, notes } = treat([], {}, brewery, 'free');
    expect(columns.every((c) => c.ph === undefined)).toBe(true);
    expect(notes).toContain('Für die pH-Schätzung fehlen verknüpfte Malze in der Maische.');
    expect(suggestAgent(col(columns, 'mash'), 5.4, catalog)).toBeUndefined();
  });

  it('shows Palmer\'s RA range and no pH with the model kolbach', () => {
    const { columns, recipe, w, notes } = treat([], {}, { ...brewery, phModel: 'kolbach' });
    const mash = col(columns, 'mash');
    expect(columns.every((c) => c.ph === undefined)).toBe(true);
    expect(mash.raTarget).toEqual(raRangeForColor(beerEbc(wortExtract(recipe, catalog).colors, 20, w.dilution)));
    expect(notes.some((x) => x.includes('pH-Schätzung'))).toBe(false);
    expect(suggestAgent(mash, 5.4, catalog)).toBeUndefined();
  });
});
