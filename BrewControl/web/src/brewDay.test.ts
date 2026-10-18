import { describe, expect, it } from 'vitest';
import {
  actualBeer, brewInputs, brewTargets, deviation, mashAcidSuggestion, measuredEfficiency, measuredFermenterPct, plannedBeer, unitOfMeasure,
  withResults, type BrewInputs,
} from './brewDay';
import { TEMPLATES, type Brewery, type Brewhouse } from './brewhouse';
import { ballingBeerAnalysis, speiseAlcoholPct } from './brewMath';
import type { Brew, MeasureId, Measurement } from './brews';
import type { Container, Fermenter } from './cellar';
import type { Bottling } from './fermentation';
import type { CatalogIngredient } from './ingredientCatalog';
import { calcMash } from './mashPlan';
import { calcStats, pitchedL, wortExtract } from './recipeStats';
import { calcTreatment, suggestAgent } from './recipeTreatment';
import { calcWater } from './recipeWater';
import { newRecipe, type Ingredient, type Recipe } from './recipes';

const catalog = [
  { id: 'malt:base', kind: 'fermentable', type: 'malt', name: 'Base', colorEbc: [3, 3], extractDryPct: [80, 80], moisturePct: [4, 4] },
  { id: 'sugar:cane', kind: 'fermentable', type: 'sugar', name: 'Zucker', colorEbc: [0, 0], extractDryPct: [100, 100] },
  { id: 'aux:gypsum', kind: 'auxiliary', name: 'Gips', category: 'water-salt', defaultUnit: 'g', waterAgent: 'gypsum' },
  { id: 'aux:lactic', kind: 'auxiliary', name: 'Milchsäure', category: 'acid', defaultUnit: 'ml', waterAgent: 'lactic', acidStrengthPct: 80 },
  { id: 'yeast:us05', kind: 'culture', organism: 'saccharomyces', name: 'US-05', attenuationPct: [78, 82] },
] as CatalogIngredient[];

const herms = { ...TEMPLATES.find((t) => t.key === 'herms3')!.build(), id: 'bh-herms' };
const brewery: Brewery = { grainTempC: 18, tapWaterTempC: 12, altitudeM: 300 };

const row = (p: Partial<Ingredient>): Ingredient =>
  ({ id: Math.random().toString(36).slice(2), kind: 'fermentable', name: 'x', amount: 0, timing: 'mash', ...p });
const malt = row({ id: 'm', name: 'Base', ingredientId: 'malt:base', amount: 5 });
const sugar = row({ id: 's', name: 'Zucker', ingredientId: 'sugar:cane', amount: 0.5, timing: 'boil' });
const gypsum = row({ id: 'g', kind: 'auxiliary', name: 'Gips', ingredientId: 'aux:gypsum', amount: 4, timing: 'water' });
const acid = row({ id: 'a', kind: 'auxiliary', name: 'Milchsäure', ingredientId: 'aux:lactic', amount: 2, timing: 'sparge' });

// The recipe names another brewhouse: the brew computes with its own.
const recipe = (ingredients: Ingredient[] = [malt, sugar, gypsum, acid], p: Partial<Recipe> = {}): Recipe =>
  ({ ...newRecipe(), volumeL: 22, brewhouseId: 'other', ingredients, ...p });
const inputs = (bh: Brewhouse = herms): BrewInputs => ({ bh, brewery, entries: catalog });
const own = (r: Recipe): Recipe => ({ ...r, brewhouseId: herms.id });

describe('brewTargets', () => {
  it('plans a cold recipe at its counted-back knock-out', () => {
    const hot = recipe();
    const cold: Recipe = { ...hot, volumeL: pitchedL(hot, herms, catalog, brewery), volumeBasis: 'cold' };
    const a = brewTargets(hot, inputs()).values, b = brewTargets(cold, inputs()).values;
    expect(b.postBoilVolume).toBeCloseTo(a.postBoilVolume!, 6);
    expect(b.strikeVolume).toBeCloseTo(a.strikeVolume!, 6);
    expect(b.postBoilGravity).toBeCloseTo(a.postBoilGravity!, 6);
  });

  it('takes volumes, temperatures and pH from the recipe tabs', () => {
    const r = recipe();
    const t = brewTargets(r, inputs());
    const stats = calcStats(own(r), catalog, herms, brewery);
    const water = calcWater(own(r), herms, wortExtract(own(r), catalog, herms, brewery).extractKg, brewery).water!;
    const w = t.water!;
    expect(w.preBoilL).toBeCloseTo(water.preBoilL, 6);
    expect(t.values.strikeVolume).toBe(w.strikeFillL);
    expect(t.values.spargeVolume).toBe(w.spargeFillL);
    expect(t.values.preBoilVolume).toBe(w.preBoilL);
    expect(t.values.postBoilVolume).toBe(w.dilution.kettleL);
    expect(t.values.postBoilGravity).toBeCloseTo(stats.ogPlato!, 6);
    const mash = calcMash(own(r), herms, brewery, w);
    expect(t.values.strikeTemp).toBe(mash.rows[0].waterTempC);
    expect(t.values.spargeTemp).toBe(78);
    const cols = calcTreatment(own(r), w, brewery, catalog).columns;
    expect(t.values.strikePh).toBe(cols.find((c) => c.key === 'strike')!.after.ph);
    expect(t.values.spargePh).toBe(cols.find((c) => c.key === 'sparge')!.after.ph);
    expect(t.values.strikePh).toBeGreaterThan(t.values.spargePh!);  // the acid
    expect(t.boilC).toBeLessThan(100);
  });

  it('leaves the kettle sugar out before the boil', () => {
    const withSugar = brewTargets(recipe(), inputs()).values;
    const without = brewTargets(recipe([malt, gypsum]), inputs()).values;
    expect(withSugar.preBoilGravity!).toBeLessThan(withSugar.postBoilGravity!);
    expect(withSugar.postBoilGravity!).toBeGreaterThan(without.postBoilGravity!);
    // The sugar adds nothing before the boil; the volumes are the same.
    expect(withSugar.preBoilGravity!).toBeCloseTo(without.preBoilGravity!, 6);
  });

  it('measures the knock-out before a dilution in the kettle', () => {
    const t = brewTargets(recipe(undefined, { water: { dilution: { at: 'kettle', lead: 'volume', volumeL: 4 } } }), inputs());
    expect(t.dilutionInKettle).toBe(true);
    expect(t.values.postBoilVolume).toBeCloseTo(18, 6);
  });

  it('has a wort pH only where the recipe adds something to the wort', () => {
    expect(brewTargets(recipe(), inputs()).values.preBoilPh).toBeUndefined();
    const wortAcid = row({ id: 'w', kind: 'auxiliary', name: 'Milchsäure', ingredientId: 'aux:lactic', amount: 2, timing: 'preBoil' });
    const v = brewTargets(recipe([malt, gypsum, wortAcid]), inputs()).values;
    expect(v.preBoilPh).toBeGreaterThan(4);
    expect(v.preBoilPh).toBeLessThan(6);
    expect(v.postBoilPh).toBeUndefined();
  });

  it('expects the air pressure at the altitude of the brewery', () => {
    const p = brewTargets(recipe(), inputs()).values.airPressure!;
    expect(p).toBeGreaterThan(970);
    expect(p).toBeLessThan(985);
  });

  it('has no targets but the boiling point without a brewhouse', () => {
    const t = brewTargets(recipe(), { bh: undefined, brewery, entries: catalog });
    expect(t.values).toEqual({});
    expect(t.notes.length).toBeGreaterThan(0);
  });

  it('computes with the copies once started, with today\'s objects before', () => {
    const frozen = { brewhouse: herms, brewery, entries: catalog };
    const brew = { brewhouseId: 'x', frozen } as unknown as Brew;
    expect(brewInputs(brew, { brewhouses: [], brewery: null, entries: null })).toEqual({ bh: herms, brewery, entries: catalog });
    const planned = { brewhouseId: herms.id } as Brew;
    expect(brewInputs(planned, { brewhouses: [herms], brewery, entries: catalog }).bh).toBe(herms);
  });
});

describe('measuredEfficiency', () => {
  const r = recipe();
  const t = brewTargets(r, inputs());
  const e = t.efficiency!;
  const v = t.values;
  const pick = (...keys: MeasureId[]) => Object.fromEntries(keys.map((k) => [k, v[k]]));

  it('gives the recipe\'s efficiencies back when the brew hits the targets', () => {
    const m = measuredEfficiency(pick('preBoilVolume', 'preBoilGravity', 'firstWortGravity'), t.ctx!);
    expect(m.from).toBe('preBoil');
    expect(m.mashPct).toBeCloseTo(e.mashPct!, 6);
    expect(m.yieldPct).toBeCloseTo(e.yieldPct!, 6);
    expect(m.conversionPct).toBeCloseTo(e.conversionPct!, 6);
    expect(m.lauterPct).toBeCloseTo(e.lauter!.pct, 6);
  });

  it('counts from the knock-out without the values before the boil', () => {
    const m = measuredEfficiency(pick('postBoilVolume', 'postBoilGravity'), t.ctx!);
    expect(m.from).toBe('postBoil');
    expect(m.mashPct).toBeCloseTo(e.mashPct!, 6);
    expect(m.conversionPct).toBeUndefined();
  });

  it('follows more wort at the same gravity', () => {
    const m = measuredEfficiency({ ...pick('preBoilGravity'), preBoilVolume: v.preBoilVolume! * 1.05 }, t.ctx!);
    expect(m.mashPct).toBeCloseTo(e.mashPct! * 1.05, 6);
  });
});

describe('deviation', () => {
  it('marks a value beyond the tolerance', () => {
    expect(deviation('preBoilGravity', 12, 12.2)).toEqual({ text: '+0,2 °P', level: 'ok' });
    expect(deviation('preBoilGravity', 12, 11.7)).toEqual({ text: '−0,3 °P', level: 'warn' });
    expect(deviation('mashPh', 5.4, 5.5)?.level).toBe('ok');
    expect(deviation('mashPh', 5.4, 5.56)).toEqual({ text: '+0,16', level: 'warn' });
    expect(deviation('strikeTemp', 70, 71)).toEqual({ text: '+1,0 K', level: 'ok' });
    expect(deviation('spargeTemp', 78, 76.5)?.level).toBe('warn');
    expect(deviation('efficiency', 70, 72)).toEqual({ text: '+2,0 Pkt.', level: 'ok' });
    expect(deviation('efficiency', 70, 67.5)?.level).toBe('warn');
  });

  it('counts volumes in percent', () => {
    expect(deviation('preBoilVolume', 30, 30.75)).toEqual({ text: '+0,8 l (+2,5 %)', level: 'ok' });
    expect(deviation('preBoilVolume', 30, 29)?.level).toBe('warn');
  });

  it('is unset without both values or without a tolerance', () => {
    expect(deviation('preBoilVolume', undefined, 30)).toBeUndefined();
    expect(deviation('airPressure', 1000, 990)).toBeUndefined();
  });
});

describe('mash acid from the measured pH', () => {
  const soda = { id: 'aux:soda', kind: 'auxiliary', name: 'Natron', category: 'water-salt', defaultUnit: 'g', waterAgent: 'nahco3' } as CatalogIngredient;
  const entries = [...catalog, soda];
  const mashAcid = row({ id: 'ma', kind: 'auxiliary', name: 'Milchsäure', ingredientId: 'aux:lactic', amount: 1, timing: 'mashPh' });
  const r = recipe([malt, gypsum, mashAcid]);
  const t = brewTargets(r, inputs());
  const mash = t.columns.find((c) => c.key === 'mash')!;

  it('compares the measurement before the acid, the one after with the target', () => {
    expect(t.values.mashPh).toBe(mash.ph!.before);
    expect(t.values.mashPh!).toBeGreaterThan(mash.ph!.after);
    expect(t.values.mashPhAcid).toBe(5.4);
  });

  it('is the recipe helper when the measurement hits the model', () => {
    const s = mashAcidSuggestion(t, mash.ph!.before, entries)!;
    expect(s.rowId).toBe('ma');
    expect(s.unit).toBe('ml');
    expect(s.base).toBe(false);
    expect(s.amount).toBeCloseTo(suggestAgent(mash, 5.4, entries)!.amount, 6);
  });

  it('gives more acid for a higher pH, a base below the target', () => {
    const at = mashAcidSuggestion(t, 5.6, entries)!;
    const higher = mashAcidSuggestion(t, 5.8, entries)!;
    expect(higher.amount).toBeGreaterThan(at.amount);
    const low = mashAcidSuggestion(t, 5.2, entries)!;
    expect(low.base).toBe(true);
    expect(low.name).toBe('Natron');
    expect(low.rowId).toBeUndefined();
    expect(low.amount).toBeGreaterThan(0);
  });

  it('works under the model kolbach, which has no mash pH of its own', () => {
    const k = brewTargets(r, { ...inputs(), brewery: { ...brewery, phModel: 'kolbach' } });
    expect(k.values.mashPh).toBeUndefined();
    expect(mashAcidSuggestion(k, 5.7, entries)!.amount).toBeGreaterThan(0);
  });
});

describe('withResults', () => {
  const t = brewTargets(recipe(), inputs());
  const brew = (values: Partial<Record<MeasureId, number>>, p: Partial<Brew> = {}): Brew => ({
    id: 'b', number: 1, name: 'x', recipeId: 'r', rootId: 'r', version: 1, status: 'active', updatedAt: 0, ...p,
    measurements: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { v: v!, at: 1 }])) as Record<MeasureId, Measurement>,
  });

  it('carries the gravity and efficiencies of the recipe when the brew hits the targets', () => {
    const { preBoilVolume, preBoilGravity, postBoilGravity } = t.values;
    const b = withResults(brew({ preBoilVolume, preBoilGravity, postBoilGravity }), t);
    expect(b.ogPlato).toBeCloseTo(t.values.postBoilGravity!, 2);
    expect(b.ogActual).toBe(b.ogPlato);
    expect(b.mashEffPct).toBeCloseTo(t.efficiency!.mashPct!, 2);
    expect(b.yieldPct).toBeCloseTo(t.efficiency!.yieldPct!, 2);
  });

  it('has the target alone before anything is measured, and drops a result that no longer follows', () => {
    const b = withResults(brew({}, { ogActual: 12, mashEffPct: 70, yieldPct: 55, bottledL: 18 }), t);
    expect(b.ogPlato).toBeCloseTo(t.values.postBoilGravity!, 2);
    expect('ogActual' in b || 'mashEffPct' in b || 'yieldPct' in b).toBe(false);
    expect('bottledL' in b).toBe(false);
  });

  it('leaves the results out without a brewhouse', () => {
    const b = withResults(brew({ postBoilGravity: 12.34 }), brewTargets(recipe(), { bh: undefined, brewery, entries: catalog }));
    expect(b.ogActual).toBe(12.34);
    expect('ogPlato' in b || 'mashEffPct' in b).toBe(false);
  });
});

describe('pitching (5c-2)', () => {
  const yeast = row({ id: 'y', kind: 'yeast', name: 'US-05', ingredientId: 'yeast:us05', amount: 11, timing: 'pitch' });
  const phases = [{ id: 'p1', name: 'Hauptgärung', tempC: 19, duration: 7 }, { id: 'p2', name: 'Kalt', tempC: 2, duration: 14 }];
  const speise = recipe([malt, sugar, yeast], {
    fermentation: phases, carbonation: { method: 'speise', targetVol: 2.5 }, trubLossL: 0.5,
    water: { ...newRecipe().water, dilution: { at: 'fermenter', lead: 'volume', volumeL: 2 } },
  });
  const t = brewTargets(speise, inputs());
  const fermenter: Fermenter = { id: 'f', name: 'F', updatedAt: 0, kind: 'bucket', volumeL: 30, tempering: 'none', manual: true };

  it('targets the wort in the fermenter, its gravity after the dilution, the first phase and the Speise', () => {
    const d = t.water!.dilution;
    expect(t.values.batchVolume).toBeCloseTo(d.restL + 2, 9);
    expect(t.values.pitchGravity).toBe(d.finalPlato);
    expect(t.values.pitchGravity!).toBeLessThan(t.values.postBoilGravity!);
    expect(t.values.pitchTemp).toBe(19);
    expect(t.values.speiseVolume).toBe(d.speiseL);
    expect(d.speiseL).toBeGreaterThan(0);
    expect(unitOfMeasure('pitchGravity')).toBe('°P');
    expect(brewTargets(recipe(), inputs()).values.speiseVolume).toBeUndefined();
  });

  it("counts the Speise with the fermenter's trub instead of the recipe's", () => {
    const more = brewTargets(speise, { ...inputs(), fermenter: { ...fermenter, trubLossL: 3 } }).values.speiseVolume!;
    expect(more).toBeLessThan(t.values.speiseVolume!);
    expect(brewTargets(speise, { ...inputs(), fermenter }).values.speiseVolume).toBe(t.values.speiseVolume);
  });

  it('takes the fermenter from the copy once started, else from the list', () => {
    const b = { id: 'b', fermenterId: 'f' } as Brew;
    expect(brewInputs(b, { brewhouses: [], brewery, entries: catalog, fermenters: [fermenter] }).fermenter).toBe(fermenter);
    const frozen = { ...b, frozen: { brewery, entries: catalog, fermenter: { ...fermenter, name: 'old' } } };
    expect(brewInputs(frozen, { brewhouses: [], brewery, entries: catalog, fermenters: [fermenter] }).fermenter?.name).toBe('old');
  });

  it('gives the overall efficiency of the recipe back when the brew hits the targets', () => {
    const { batchVolume, pitchGravity, postBoilGravity } = t.values;
    // The dilution mixes by mass (recipeWater), the measurement counts by volume: a few thousandths of a point.
    expect(measuredFermenterPct({ batchVolume, pitchGravity, postBoilGravity }, t)).toBeCloseTo(t.efficiency!.fermenterPct!, 2);
    const undiluted = brewTargets({ ...speise, water: newRecipe().water }, inputs());
    const v = undiluted.values;
    expect(measuredFermenterPct({ batchVolume: v.batchVolume, pitchGravity: v.pitchGravity, postBoilGravity: v.postBoilGravity }, undiluted))
      .toBeCloseTo(undiluted.efficiency!.fermenterPct!, 6);
    const plain = brewTargets(recipe(), inputs());
    expect(measuredFermenterPct({ batchVolume: plain.values.batchVolume, pitchGravity: plain.values.pitchGravity }, plain))
      .toBeCloseTo(plain.efficiency!.fermenterPct!, 6);
    expect(measuredFermenterPct({ batchVolume }, t)).toBeUndefined();
  });

  it('pairs target and measured gravity in the list: the pitched wort once measured', () => {
    const m = (values: Partial<Record<MeasureId, number>>) => ({
      id: 'b', number: 1, name: 'x', recipeId: 'r', rootId: 'r', version: 1, status: 'active', updatedAt: 0,
      measurements: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { v: v!, at: 1 }])),
    }) as Brew;
    const before = withResults(m({ postBoilGravity: 15 }), t);
    expect([before.ogPlato, before.ogActual]).toEqual([Math.round(t.values.postBoilGravity! * 100) / 100, 15]);
    const after = withResults(m({ postBoilGravity: 15, pitchGravity: 13.5 }), t);
    expect([after.ogPlato, after.ogActual]).toEqual([Math.round(t.values.pitchGravity! * 100) / 100, 13.5]);
  });
});

describe('after the fermentation (5c-5)', () => {
  const yeast = row({ id: 'y', kind: 'yeast', name: 'US-05', ingredientId: 'yeast:us05', amount: 11, timing: 'pitch' });
  const phases = [{ id: 'p1', name: 'Hauptgärung', tempC: 19, duration: 7 }, { id: 'p2', name: 'Kalt', tempC: 2, duration: 14 }];
  const r = recipe([malt, sugar, yeast], { fermentation: phases, trubLossL: 0.5 });
  const t = brewTargets(r, inputs());
  const keg: Container = { id: 'keg', updatedAt: 0, kind: 'keg', sizeL: 19, count: 1 };
  const m = (values: Partial<Record<MeasureId, number>>) => ({
    id: 'b', number: 1, name: 'x', recipeId: 'r', rootId: 'r', version: 1, status: 'active', updatedAt: 0,
    measurements: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { v: v!, at: 1 }])),
  }) as Brew;

  it('targets the final gravity of the yeast, the highest phase temperature and the volume filled', () => {
    const stats = calcStats(own(r), catalog, herms, brewery);
    expect(t.values.finalGravity).toBeCloseTo(stats.fgPlato!, 9);
    expect(t.values.maxTempAfter).toBe(19);
    expect(t.bottling!.bottledL).toBe(t.values.bottledVolume);
    const withKeg = brewTargets({ ...r, bottling: { containers: [{ containerId: 'keg' }] } }, { ...inputs(), containers: [keg] });
    expect(withKeg.bottling!.lines[0].count).toBe(Math.floor(withKeg.bottling!.beerL / 19));
    expect(withKeg.values.bottledVolume).toBe(19 * withKeg.bottling!.lines[0].count);
    expect(unitOfMeasure('finalGravity')).toBe('°P');
    expect(unitOfMeasure('maxTempAfter')).toBe('°C');
    expect(unitOfMeasure('bottledVolume')).toBe('l');
  });

  it('has no final gravity without a yeast of the catalog', () => {
    expect(brewTargets(recipe(), inputs()).values.finalGravity).toBeUndefined();
    expect(plannedBeer(brewTargets(recipe(), inputs()))).toBeUndefined();
  });

  it('plans the alcohol of the recipe from the pitched wort to the final gravity', () => {
    const stats = calcStats(own(r), catalog, herms, brewery);
    expect(plannedBeer(t)!.abvPct).toBeCloseTo(stats.abv!, 9);
  });

  it('puts alcohol, attenuation, final gravity and volume into the list', () => {
    const b = withResults(m({ pitchGravity: 12.5, finalGravity: 2.5, bottledVolume: 18.4 }), t);
    const a = ballingBeerAnalysis(12.5, 2.5);
    expect([b.fgPlato, b.bottledL]).toEqual([2.5, 18.4]);
    expect(b.abvPct).toBeCloseTo(a.abvPercent, 2);
    expect(b.attenuationPct).toBeCloseTo(a.apparentAttenuationPercent, 2);
  });

  it('takes the knock-out gravity for alcohol only without a dilution in the kettle', () => {
    const plain = { dilutionInKettle: false, values: {} };
    const diluted = { dilutionInKettle: true, values: {} };
    expect(actualBeer({ postBoilGravity: 12.5, finalGravity: 2.5 }, plain)?.abvPct).toBeGreaterThan(5);
    expect(actualBeer({ postBoilGravity: 12.5, finalGravity: 2.5 }, diluted)).toBeUndefined();
    expect(actualBeer({ pitchGravity: 12.5, postBoilGravity: 15, finalGravity: 2.5 }, diluted)?.abvPct)
      .toBeCloseTo(ballingBeerAnalysis(12.5, 2.5).abvPercent, 9);
    expect(actualBeer({ pitchGravity: 12.5 }, plain)).toBeUndefined();
  });

  it('takes the planned gravity for a dilution in the kettle until the pitched wort is measured', () => {
    const diluted = { dilutionInKettle: true, values: { pitchGravity: 12.5 } };
    const est = actualBeer({ postBoilGravity: 15, finalGravity: 2.5 }, diluted)!;
    expect(est.abvPct).toBeCloseTo(ballingBeerAnalysis(12.5, 2.5).abvPercent, 9);
    expect(est.estimated).toBe(true);
    const measured = actualBeer({ pitchGravity: 13, finalGravity: 2.5 }, diluted)!;
    expect(measured.abvPct).toBeCloseTo(ballingBeerAnalysis(13, 2.5).abvPercent, 9);
    expect(measured.estimated).toBe(false);
    expect(actualBeer({ finalGravity: 2.5 }, { dilutionInKettle: false, values: { pitchGravity: 12.5 } })).toBeUndefined();
  });

  describe('with a Speise', () => {
    // 19 l of young beer and 1 l of Speise from 20 l pitched, carbonated to 2.5 volumes at 19 °C.
    const bottling = { youngL: 19, speiseL: 1, pitchL: 20, beerL: 20 } as Bottling;
    const t = { dilutionInKettle: false, values: { pitchGravity: 12.5, finalGravity: 2.5, maxTempAfter: 19 }, bottling, speiseTargetVol: 2.5 };
    const young = ballingBeerAnalysis(12.5, 2.5);
    const added = speiseAlcoholPct(2.5, 19);

    it('dilutes the young beer and adds the alcohol of the Speise', () => {
      const b = actualBeer({ pitchGravity: 12.5, finalGravity: 2.5 }, t)!;
      expect(b.abvPct).toBeCloseTo((young.abvPercent * 19 + added * 20) / 20, 9);
      expect(b.withSpeise).toBe(true);
      expect(b.attenuationPct).toBeCloseTo(young.apparentAttenuationPercent, 9);
    });

    it('takes the Speise, volume and temperature as measured', () => {
      const m: Partial<Record<MeasureId, number>> = { pitchGravity: 12.5, finalGravity: 2.5, speiseVolume: 2, batchVolume: 20, maxTempAfter: 10 };
      expect(actualBeer(m, t)!.abvPct).toBeCloseTo((young.abvPercent * 19 + speiseAlcoholPct(2.5, 10) * 21) / 21, 9);
    });

    it('plans the same way, and leaves the alcohol alone without a Speise or a carbonation by Speise', () => {
      expect(plannedBeer(t)!.abvPct).toBeCloseTo((young.abvPercent * 19 + added * 20) / 20, 9);
      const plain = { ...t, speiseTargetVol: undefined };
      expect(actualBeer({ pitchGravity: 12.5, finalGravity: 2.5 }, plain)).toMatchObject({ abvPct: young.abvPercent, withSpeise: false });
      const none = { ...t, bottling: { ...bottling, speiseL: 0, beerL: 19 } as Bottling };
      expect(plannedBeer(none)).toMatchObject({ abvPct: young.abvPercent, withSpeise: false });
    });
  });

  describe('with a dilution in the keg', () => {
    const kegged = { ...r, water: { ...newRecipe().water, dilution: { at: 'keg' as const, lead: 'volume' as const, volumeL: 4 } } };
    const tk = brewTargets(kegged, inputs());

    it('targets the strong wort up to the fermentation, then the water', () => {
      expect(tk.values.pitchGravity).toBe(t.values.pitchGravity);
      expect(tk.values.finalGravity).toBe(t.values.finalGravity);
      expect(tk.values.batchVolume).toBe(t.values.batchVolume);
      expect(tk.values.dilutionVolume).toBe(4);
      expect(t.values.dilutionVolume).toBeUndefined();
      expect(tk.bottling!.beerL).toBeCloseTo(t.bottling!.beerL + 4, 9);
      expect(unitOfMeasure('dilutionVolume')).toBe('l');
    });

    it('plans the alcohol as the recipe does, and thins the measured one by the water measured', () => {
      const stats = calcStats(own(kegged), catalog, herms, brewery);
      expect(plannedBeer(tk)!.abvPct).toBeCloseTo(stats.abv!, 9);
      const strong = ballingBeerAnalysis(12.5, 2.5).abvPercent;
      const beerL = tk.bottling!.youngL;
      expect(actualBeer({ pitchGravity: 12.5, finalGravity: 2.5 }, tk)!.abvPct).toBeCloseTo(strong * beerL / (beerL + 4), 9);
      expect(actualBeer({ pitchGravity: 12.5, finalGravity: 2.5, dilutionVolume: 5 }, tk)!.abvPct).toBeCloseTo(strong * beerL / (beerL + 5), 9);
    });

    it('keeps the overall efficiency of the undiluted wort', () => {
      const { batchVolume, pitchGravity } = tk.values;
      expect(tk.efficiency!.fermenterPct).toBeCloseTo(t.efficiency!.fermenterPct!, 9);
      expect(measuredFermenterPct({ batchVolume, pitchGravity }, tk)).toBeCloseTo(tk.efficiency!.fermenterPct!, 6);
    });
  });

  it('drops the results the measurements no longer give', () => {
    const b = withResults({ ...m({ pitchGravity: 12.5 }), fgPlato: 2.5, abvPct: 5, attenuationPct: 80, bottledL: 18 }, t);
    expect('fgPlato' in b || 'abvPct' in b || 'attenuationPct' in b || 'bottledL' in b).toBe(false);
  });
});
