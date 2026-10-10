import { describe, expect, it } from 'vitest';
import { TEMPLATES, type Brewery, type Brewhouse } from './brewhouse';
import { lauterEfficiency, type EfficiencyBasis } from './efficiency';
import type { CatalogIngredient } from './ingredientCatalog';
import { calcStats, wortExtract } from './recipeStats';
import { calcWater } from './recipeWater';
import { newRecipe, type Ingredient, type Recipe } from './recipes';

// Troester's grist: 80 % extract, 4 % moisture, i.e. 0.768 kg extract per kg as is.
const catalog = [
  { id: 'malt:base', kind: 'fermentable', type: 'malt', name: 'Base', colorEbc: [3, 3], extractDryPct: [80, 80], moisturePct: [4, 4] },
  { id: 'sugar:cane', kind: 'fermentable', type: 'sugar', name: 'Zucker', colorEbc: [0, 0], extractDryPct: [100, 100] },
] as CatalogIngredient[];
const PER_KG = 0.768;

const template = (key: string) => TEMPLATES.find((t) => t.key === key)!.build();
const brewery = (efficiencyBasis: EfficiencyBasis): Brewery => ({ grainTempC: 18, tapWaterTempC: 12, efficiencyBasis });

const malt = (kg: number): Ingredient => ({ id: 'm', kind: 'fermentable', name: 'Base', ingredientId: 'malt:base', amount: kg, timing: 'mash' });
const sugar: Ingredient = { id: 's', kind: 'fermentable', name: 'Zucker', ingredientId: 'sugar:cane', amount: 0.5, timing: 'boil' };

const recipeFor = (bh: Brewhouse, kg: number, p: Partial<Recipe> = {}): Recipe =>
  ({ ...newRecipe(), volumeL: 20, brewhouseId: bh.id, ingredients: [malt(kg)], ...p });

describe('lauter efficiency: Troester, "A Closer Look at Efficiency" (NHC 2010)', () => {
  // One pot without sparge (no-sparge), no losses before the boil, 15 % of the
  // pre-boil volume boiled off, 1 l/kg absorption (braukaiser.com), full
  // conversion. No shrink: Troester corrects volumes to 20 °C.
  const pot = { ...template('pot'), coolingShrinkPct: 0 };
  const water = { grainAbsorptionLPerKg: 1, evaporationLPerH: (20 * 0.15) / 0.85 };
  const statsFor = (kg: number) => calcStats(
    recipeFor(pot, kg, { conversionPct: 100, water }), catalog, pot, brewery('conversion'));

  // Grain that gives `plato` OE, by bisection.
  function lauterAt(plato: number): number {
    let lo = 1;
    let hi = 20;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (statsFor(mid).ogPlato! < plato) lo = mid; else hi = mid;
    }
    const s = statsFor(lo);
    expect(s.ogPlato).toBeCloseTo(plato, 3);
    return s.efficiency!.lauter!.pct;
  }

  it('no-sparge: ~82 % at 10 °P, ~71 % at 16 °P OE', () => {
    expect(Math.abs(lauterAt(10) - 82)).toBeLessThan(3);
    expect(Math.abs(lauterAt(16) - 71)).toBeLessThan(3);
  });

  // 24.6 l pre-boil (6.5 gal), 5 kg grain at 1 l/kg, equal run-offs.
  const runs = (additions: number, firstShare = 1 / (additions + 1)) => {
    const first = 24.6 * firstShare;
    return lauterEfficiency(
      { sparge: additions > 0, strikeL: first + 5, spargeL: 24.6 - first, absorptionL: 5, wortLossL: 0 },
      PER_KG * 5, { batches: Math.max(additions, 1) }).pct;
  };

  it('gains about +8, +3, +1 points from 0 to 3 sparge additions', () => {
    const [n0, n1, n2, n3] = [0, 1, 2, 3].map((n) => runs(n));
    expect(n1 - n0).toBeGreaterThan(6);
    expect(n1 - n0).toBeLessThan(10);
    expect(n2 - n1).toBeGreaterThan(2);
    expect(n2 - n1).toBeLessThan(4.5);
    expect(n3 - n2).toBeGreaterThan(0.5);
    expect(n3 - n2).toBeLessThan(2.5);
  });

  it('loses about 1 point at a 30/70 split instead of 50/50', () => {
    const loss = runs(1) - runs(1, 0.3);
    expect(loss).toBeGreaterThan(0.5);
    expect(loss).toBeLessThan(1.5);
  });

  it('approximates fly sparging as two additions; only there a fixed value counts', () => {
    const w = { sparge: true, strikeL: 20, spargeL: 15, absorptionL: 5, wortLossL: 1 };
    const fly = lauterEfficiency(w, 4, { method: 'fly' });
    expect(fly.pct).toBeCloseTo(lauterEfficiency(w, 4, { batches: 2 }).pct, 9);
    expect(fly.fixed).toBe(false);
    expect(lauterEfficiency(w, 4, { method: 'fly', fixedPct: 90 })).toMatchObject({ pct: 90, fixed: true });
    expect(lauterEfficiency(w, 4, { method: 'batch', fixedPct: 90 }).pct).toBeCloseTo(lauterEfficiency(w, 4).pct, 9);
    expect(lauterEfficiency({ ...w, sparge: false }, 4, { method: 'fly', fixedPct: 90 }).method).toBe('full');
  });
});

describe('efficiency chain', () => {
  // HERMS: sparge, dead spaces and lines, 4 % shrink; 5 kg malt plus sugar in
  // the kettle, and a dilution led by gravity, so the wort volumes depend on
  // the extract.
  const herms = template('herms3');
  const base: Partial<Recipe> = { water: { dilution: { at: 'kettle', lead: 'gravity', plato: 20 } } };
  const run = (basis: EfficiencyBasis, p: Partial<Recipe> = {}, kg = 5) => calcStats(
    { ...recipeFor(herms, kg, { ...base, ...p }), ingredients: [malt(kg), sugar] }, catalog, herms, brewery(basis));

  it('multiplies through and gives the same gravity from every basis', () => {
    const s = run('mash', { efficiencyPct: 75 });
    const e = s.efficiency!;
    expect(e).toMatchObject({ inputPct: 75, inputFrom: 'Rezept', mashPct: 75 });
    expect(e.conversionPct! * e.lauter!.pct / 100).toBeCloseTo(75, 9);
    expect(e.yieldPct).toBeCloseTo(75 * PER_KG, 9);
    // 20 l · 0.96 − 2 l dead space − 1 l line reach the fermenter
    expect(e.fermenterPct).toBeCloseTo(75 * (19.2 - 3) / 19.2, 9);

    const og = s.ogPlato!;
    expect(run('conversion', { conversionPct: e.conversionPct }).ogPlato).toBeCloseTo(og, 6);
    expect(run('yield', { efficiencyPct: e.yieldPct }).ogPlato).toBeCloseTo(og, 6);
    expect(run('fermenter', { efficiencyPct: e.fermenterPct }).ogPlato).toBeCloseTo(og, 6);
  });

  it('settles the lauter efficiency on the wort volumes it leads to', () => {
    const recipe = { ...recipeFor(herms, 5, { ...base, conversionPct: 95 }), ingredients: [malt(5), sugar] };
    const { extractKg, efficiency: e } = wortExtract(recipe, catalog, herms, brewery('conversion'));
    const w = calcWater(recipe, herms, extractKg).water!;
    expect(lauterEfficiency(w, 0.95 * 5 * PER_KG).pct).toBeCloseTo(e.lauter!.pct, 6);
  });

  it('takes the Konversion from the brewhouse unless the recipe sets one', () => {
    expect(run('conversion').efficiency).toMatchObject({ inputPct: herms.mashEfficiencyPct, inputFrom: 'Sudhaus' });
    expect(run('conversion', { conversionPct: 97 }).efficiency).toMatchObject({ inputPct: 97, inputFrom: 'Rezept' });
    expect(run('yield').efficiency).toMatchObject({ inputPct: 60, inputFrom: 'Vorgabe' });
  });

  it('loses lauter efficiency with a bigger grist when the Konversion leads', () => {
    const plain = { water: undefined };
    const ratio = (basis: EfficiencyBasis) => run(basis, plain, 10).ogPlato! / run(basis, plain, 5).ogPlato!;
    expect(run('conversion', plain, 10).efficiency!.lauter!.pct).toBeLessThan(run('conversion', plain, 5).efficiency!.lauter!.pct);
    expect(ratio('conversion')).toBeLessThan(ratio('mash') - 0.05);
  });

  it('notes a Konversion above 100 %', () => {
    expect(run('mash', { efficiencyPct: 95 }).notes)
      .toContain('Die Konversion läge über 100 %: Maischeeffizienz 95 % ist für dieses Läutern zu hoch.');
  });

  it('notes the fly sparge assumption', () => {
    expect(run('mash', { water: { ...base.water, spargeMethod: 'fly' } }).notes)
      .toContain('Fly Sparge ist wie Batch Sparge mit 2 Gaben gerechnet (Annahme). Das Sudhaus kann einen Festwert setzen.');
  });

  it('shows only what follows without a brewhouse', () => {
    const recipe = { ...newRecipe(), volumeL: 20, ingredients: [malt(5)] };
    const mash = calcStats(recipe, catalog, undefined, brewery('mash')).efficiency!;
    expect(mash.conversionPct).toBeUndefined();
    expect(mash.lauter).toBeUndefined();
    expect(mash.fermenterPct).toBeUndefined();
    expect(mash.yieldPct).toBeCloseTo(75 * PER_KG, 9);

    const conversion = calcStats(recipe, catalog, undefined, brewery('conversion'));
    expect(conversion.ogPlato).toBeUndefined();
    expect(conversion.ebc).toBeGreaterThan(0);
    expect(conversion.notes).toContain('Mit der Grundlage Konversion braucht die Stammwürze ein Sudhaus (Läutereffizienz).');
  });
});

describe('lauter efficiency and mash evaporation', () => {
  it('water boiled off while mashing does not run off', () => {
    const w = { sparge: false, strikeL: 30, spargeL: 0, absorptionL: 5, wortLossL: 0 };
    const l = lauterEfficiency({ ...w, mashEvaporationL: 2 }, 4);
    expect(l.runOffsL[0]).toBeCloseTo(23, 9);
    expect(l.pct).toBeLessThan(lauterEfficiency(w, 4).pct);
  });
});
