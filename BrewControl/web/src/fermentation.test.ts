import { describe, expect, it } from 'vitest';
import { TEMPLATES, type Brewery, type Brewhouse } from './brewhouse';
import type { EfficiencyBasis } from './efficiency';
import { forcedCarbonationBar, krausenRackingPlato, primingSugarGrams, residualCo2Volumes, speiseVolumeL } from './brewMath';
import type { Container, Fermenter } from './cellar';
import {
  calcBottling, calcCarbonation, dryHopL, fermentationSchedule, fermenterHints, fermentSollCourse, kettleHopL, maxPhasePressureBar,
} from './fermentation';
import type { CatalogIngredient, StockLot } from './ingredientCatalog';
import { atKnockOut, calcStats, knockOutL, pitchedL, wortExtract } from './recipeStats';
import { fermenterShare, resolveDilution } from './recipeWater';
import { newRecipe, type Dilution, type Ingredient, type Recipe } from './recipes';
import { hopFormOf, withLotEntries } from './stockLots';

const base = [
  { id: 'malt:pils', kind: 'fermentable', type: 'malt', name: 'Pilsner', colorEbc: [2.5, 4.5], extractDryPct: [80.5, null], moisturePct: [null, 5] },
  { id: 'hop:motueka', kind: 'hop', name: 'Motueka', alphaPct: [6.5, 7.5] },
  { id: 'yeast:us05', kind: 'culture', organism: 'saccharomyces', name: 'US-05', attenuationPct: [78, 82] },
] as CatalogIngredient[];
const lot: StockLot = { id: 'lot1', ref: 'hop:motueka', form: 't45', amount: 100 };
const catalog = withLotEntries(base, [lot]);

let n = 0;
const row = (p: Partial<Ingredient>): Ingredient =>
  ({ id: String(n++), kind: 'fermentable', name: 'x', amount: 0, timing: 'mash', ...p });
const pils = row({ amount: 6, ingredientId: 'malt:pils' });
const yeast = row({ kind: 'yeast', amount: 11, timing: 'pitch', ingredientId: 'yeast:us05' });
const boilHop = row({ kind: 'hop', amount: 20, timing: 'boil', ingredientId: 'hop:motueka' });   // T90: 0.1 l
const dryHop = row({ kind: 'hop', amount: 50, timing: 'primary', ingredientId: 'hop:motueka' }); // T90: 0.25 l

const herms = TEMPLATES.find((t) => t.key === 'herms3')!.build();
const recipe = (p: Partial<Recipe> = {}): Recipe => ({
  ...newRecipe(), volumeL: 30, ingredients: [pils, yeast, boilHop, dryHop],
  fermentation: [{ id: 'p1', name: 'Hauptgärung', tempC: 20, duration: 7 }, { id: 'p2', name: 'Kaltlagerung', tempC: 2, duration: 14 }],
  ...p,
});
const container = (p: Partial<Container>): Container => ({ id: 'c', updatedAt: 0, kind: 'bottle', sizeL: 0.5, count: 50, ...p });
const keg = container({ id: 'keg', kind: 'keg', sizeL: 19, count: 1 });
const bottle = container({ id: 'bottle', fillLossL: 0.02 });

// The recipe's chain as the Gärung tab computes it.
function chain(r: Recipe, containers: Container[] | null = [keg, bottle]) {
  const wort = wortExtract(r, catalog, herms);
  const dilution = resolveDilution(r, wort.extractKg, herms, wort.draw);
  return { wort, dilution, b: calcBottling(r, herms, dilution, wort.draw, containers) };
}

describe('hop form', () => {
  it('takes the row, then the stock lot, then T90', () => {
    expect(hopFormOf({ ...boilHop, form: 'cone', stockLotId: 'lot1' }, catalog)).toBe('cone');
    expect(hopFormOf({ ...boilHop, stockLotId: 'lot1' }, catalog)).toBe('t45');
    expect(hopFormOf(boilHop, catalog)).toBe('t90');
    expect(hopFormOf({ ...boilHop, stockLotId: 'gone' }, catalog)).toBe('t90');
  });

  it('holds back wort per gram and form, in the kettle and in the fermenter', () => {
    const r = recipe();
    expect(kettleHopL(r, catalog)).toBeCloseTo(0.1, 9);
    expect(dryHopL(r, catalog)).toBeCloseTo(0.25, 9);
    expect(kettleHopL(recipe({ ingredients: [{ ...boilHop, stockLotId: 'lot1' }] }), catalog)).toBeCloseTo(0.08, 9);
    // Mash hops stay in the spent grain, aroma is not counted.
    expect(kettleHopL(recipe({ ingredients: [{ ...boilHop, timing: 'mash' }] }), catalog)).toBe(0);
  });

  it('lowers the share of extract that reaches the fermenter', () => {
    // 30 l · 0.96 = 28.8 l cooled; 2 l dead space and 1 l line → 25.8 l
    const r = recipe();
    expect(fermenterShare(r, herms)).toBeCloseTo(25.8 / 28.8, 9);
    expect(fermenterShare(r, herms, 0.1)).toBeCloseTo(25.7 / 28.8, 9);
    expect(wortExtract(r, catalog, herms).efficiency.fermenterPct).toBeCloseTo(
      wortExtract(recipe({ ingredients: [pils, yeast] }), catalog, herms).efficiency.fermenterPct! * 25.7 / 25.8, 9);
  });
});

describe('calcBottling', () => {
  it('adds up: knock-out and dilution end up in the containers or one of the losses', () => {
    const dilution: Dilution = { at: 'fermenter', lead: 'volume', volumeL: 2 };
    const r = recipe({ trubLossL: 1.5, carbonation: { method: 'speise', targetVol: 2.5 }, water: { dilution },
      bottling: { containers: [{ containerId: 'keg', count: 1 }, { containerId: 'bottle' }] } });
    const { b } = chain(r);
    const losses = b.intake.shrinkL + b.intake.losses.reduce((s, x) => s + x.l, 0) + b.intake.kettleHopL
      + b.trubL + b.dryHopL + b.fillLossL;
    expect(b.bottledL + b.leftL + losses).toBeCloseTo(30 + 2, 9);
    expect(b.speiseL).toBeGreaterThan(0);
    expect(b.pitchL).toBeCloseTo(25.7 - b.speiseL + 2, 9);
    expect(b.youngL).toBeCloseTo(b.pitchL - 1.5 - 0.25, 9);
    expect(b.beerL).toBeCloseTo(b.youngL + b.speiseL, 9);
  });

  it('fills the beer diluted in the keg, the fermenter gets the strong wort', () => {
    const r = recipe({ trubLossL: 1.5, water: { dilution: { at: 'keg', lead: 'volume', volumeL: 6 } } });
    const plain = chain(recipe({ trubLossL: 1.5 })).b;
    const { b } = chain(r, null);
    expect([b.dilutionL, b.kegL]).toEqual([0, 6]);
    expect(b.pitchL).toBeCloseTo(plain.pitchL, 9);
    expect(b.youngL).toBeCloseTo(plain.youngL, 9);
    expect(b.beerL).toBeCloseTo(plain.youngL + 6, 9);
    expect(b.bottledL).toBeCloseTo(b.beerL, 9);
  });

  it('fills the rest row with whole containers', () => {
    const r = recipe({ bottling: { containers: [{ containerId: 'keg', count: 1 }, { containerId: 'bottle' }] } });
    const { b } = chain(r);
    // 25.7 − 0.25 = 25.45 l beer; the keg takes 19 l, 6.45 l / 0.52 l → 12 bottles
    expect(b.beerL).toBeCloseTo(25.45, 9);
    expect(b.lines.map((l) => [l.count, l.rest])).toEqual([[1, false], [12, true]]);
    expect(b.bottles).toBe(12);
    expect(b.kegs).toBe(1);
    expect(b.fillLossL).toBeCloseTo(0.24, 9);
    expect(b.bottledL).toBeCloseTo(25, 9);
    expect(b.leftL).toBeCloseTo(0.21, 9);
  });

  it('says when the rows hold more than there is, or a container is gone', () => {
    const r = recipe({ bottling: { containers: [{ containerId: 'keg', count: 2 }, { containerId: 'gone', count: 3 }] } });
    const { b } = chain(r);
    expect(b.notes.some((x) => x.startsWith('Die Gebinde fassen'))).toBe(true);
    expect(b.notes).toContain('Das Gebinde „gone“ gibt es nicht mehr.');
    expect(b.bottledL).toBeCloseTo(b.beerL, 9);
  });

  it('without containers, all beer counts as bottled', () => {
    const { b } = chain(recipe(), null);
    expect(b.bottledL).toBeCloseTo(b.beerL, 9);
    expect(b.bottles).toBe(0);
  });
});

describe('Speise', () => {
  const speise = (p: Partial<Recipe> = {}) => recipe({ carbonation: { method: 'speise', targetVol: 2.5 }, ...p });

  it('is set aside for the beer to fill, at the knock-out gravity and the yeast attenuation', () => {
    const r = speise();
    const { dilution, b } = chain(r);
    const plato = dilution.finalPlato!;
    expect(dilution.speiseL).toBeCloseTo(speiseVolumeL(b.beerL, 2.5, 20, plato, 0.8), 9);
    expect(dilution.restL).toBeCloseTo(25.7 - dilution.speiseL, 9);
  });

  it('leaves less wort to dilute; a dilution by gravity still reaches its gravity', () => {
    const r = speise({ water: { dilution: { at: 'fermenter', lead: 'gravity', plato: 10 } } });
    const { dilution, b } = chain(r);
    const plain = chain(recipe({ water: r.water })).dilution;
    expect(dilution.finalPlato).toBeCloseTo(10, 6);
    expect(dilution.volumeL).toBeLessThan(plain.volumeL);
    expect(dilution.speiseL).toBeCloseTo(speiseVolumeL(b.beerL, 2.5, 20, dilution.kettlePlato!, 0.8), 6);
  });

  it('needs a yeast, and says so', () => {
    const r = speise({ ingredients: [pils, boilHop] });
    const { dilution } = chain(r);
    expect(dilution.speiseL).toBe(0);
    expect(calcStats(r, catalog, herms).notes.some((x) => x.startsWith('Die Speise braucht'))).toBe(true);
  });
});

describe('calcCarbonation', () => {
  it('computes the sugar for the beer at the highest phase temperature', () => {
    const r = recipe({ carbonation: { method: 'sugar', targetVol: 2.6, sugarType: 'traubenzucker' } });
    const c = calcCarbonation(r, { beerL: 20, speiseL: 0 })!;
    expect(c.residualVol).toBeCloseTo(residualCo2Volumes(20), 9);
    expect(c.sugarG).toBeCloseTo(primingSugarGrams(20, 2.6, 20, 'traubenzucker'), 9);
  });

  it('counts with the measured temperature after the fermentation, also without phases', () => {
    const r = recipe({ carbonation: { method: 'sugar', targetVol: 2.6 }, fermentation: [] });
    const c = calcCarbonation(r, { beerL: 20, speiseL: 0, tempC: 17 })!;
    expect(c.residualTempC).toBe(17);
    expect(c.sugarG).toBeCloseTo(primingSugarGrams(20, 2.6, 17, 'saccharose'), 9);
    expect(c.sugarG!).toBeLessThan(primingSugarGrams(20, 2.6, 22, 'saccharose'));
  });

  it('with a dilution in the keg: sugar and pressure for the diluted beer, no Speise or krausening', () => {
    const r = (method: 'sugar' | 'forced' | 'speise' | 'krausen') =>
      recipe({ carbonation: { method, targetVol: 2.5 }, water: { dilution: { at: 'keg', lead: 'volume', volumeL: 6 } } });
    const { b } = chain(r('sugar'), null);
    const sugar = calcCarbonation(r('sugar'), { beerL: b.beerL, speiseL: 0, keg: true })!;
    expect(sugar.sugarG).toBeCloseTo(primingSugarGrams(b.youngL + 6, 2.5, 20, 'saccharose'), 9);
    expect(calcCarbonation(r('forced'), { beerL: b.beerL, speiseL: 0, keg: true })!.pressureBar).toBeCloseTo(forcedCarbonationBar(2.5, 2), 9);
    for (const m of ['speise', 'krausen'] as const) {
      const c = calcCarbonation(r(m), { beerL: b.beerL, fgPlato: 2.5, speiseL: 0, keg: true })!;
      expect([c.speiseL, c.rackingPlato, c.residualVol]).toEqual([undefined, undefined, undefined]);
      expect(c.notes[0]).toMatch(/passt nicht zum Verschnitt im Keg/);
    }
  });

  it('takes the last phase for a forced carbonation', () => {
    const c = calcCarbonation(recipe({ carbonation: { method: 'forced', targetVol: 2.5 } }), { beerL: 20, speiseL: 0 })!;
    expect(c.storageTempC).toBe(2);
    expect(c.pressureBar).toBeCloseTo(forcedCarbonationBar(2.5, 2), 9);
  });

  it('needs the final gravity to rack green beer, and phases for the CO₂ left', () => {
    const r = recipe({ carbonation: { method: 'krausen', targetVol: 2.5 } });
    expect(calcCarbonation(r, { beerL: 20, fgPlato: 2.5, speiseL: 0 })!.rackingPlato).toBeCloseTo(krausenRackingPlato(2.5, 2.5, 20), 9);
    expect(calcCarbonation(r, { beerL: 20, speiseL: 0 })!.notes[0]).toMatch(/Restextrakt/);
    expect(calcCarbonation({ ...r, fermentation: [] }, { beerL: 20, speiseL: 0 })!.notes[0]).toMatch(/Gärphasen/);
    expect(calcCarbonation(recipe(), { beerL: 20, speiseL: 0 })).toBeUndefined();
  });
});

describe('carbonation formulas', () => {
  it('racks green beer a little under 1 °P above the final gravity', () => {
    const d = krausenRackingPlato(2.5, 2.5, 20) - 2.5;
    expect(d).toBeGreaterThan(0.7);
    expect(d).toBeLessThan(0.95);
    expect(krausenRackingPlato(2.5, 0.5, 20)).toBe(2.5); // the beer already holds more
  });

  it('gives about 0.8 bar for 2.5 vol at 4 °C, more when warmer', () => {
    expect(forcedCarbonationBar(2.5, 4)).toBeGreaterThan(0.75);
    expect(forcedCarbonationBar(2.5, 4)).toBeLessThan(0.9);
    expect(forcedCarbonationBar(2.5, 10)).toBeGreaterThan(forcedCarbonationBar(2.5, 4));
  });
});

describe('maxPhasePressureBar', () => {
  it('counts only with pressure fermentation', () => {
    const r = recipe({ fermentation: [{ id: 'a', name: '', tempC: 18, duration: 7, pressureBar: 1.2 }] });
    expect(maxPhasePressureBar(r)).toBe(0);
    expect(maxPhasePressureBar({ ...r, pressureFermentation: true })).toBe(1.2);
  });
});

describe('knockOutL (volumeBasis)', () => {
  const brewery = (efficiencyBasis: EfficiencyBasis): Brewery => ({ grainTempC: 18, tapWaterTempC: 12, efficiencyBasis });
  const speise = { carbonation: { method: 'speise' as const, targetVol: 2.5 }, trubLossL: 1 };
  const dil = (d: Dilution) => ({ water: { dilution: d } });
  const cases: [string, Partial<Recipe>, Brewhouse | undefined, Brewery | undefined][] = [
    ['without brewhouse', {}, undefined, undefined],
    ['brewhouse losses and kettle hops', {}, herms, undefined],
    ['Speise', speise, herms, undefined],
    ['dilution in the kettle by volume', { ...speise, ...dil({ at: 'kettle', lead: 'volume', volumeL: 3 }) }, herms, undefined],
    ['dilution in the kettle by gravity', { ...speise, ...dil({ at: 'kettle', lead: 'gravity', plato: 16 }) }, herms, undefined],
    ['dilution in the fermenter by volume', { ...speise, ...dil({ at: 'fermenter', lead: 'volume', volumeL: 2 }) }, herms, undefined],
    ['dilution in the fermenter by gravity', { ...speise, ...dil({ at: 'fermenter', lead: 'gravity', plato: 9 }) }, herms, undefined],
    ['basis Brewhouse-Efficiency', speise, herms, brewery('fermenter')],
    ['basis Konversion', speise, herms, brewery('conversion')],
  ];

  it('is the volume itself when hot', () => {
    const r = recipe();
    expect(knockOutL(r, herms, catalog)).toBe(30);
    expect(atKnockOut(r, herms, catalog)).toBe(r);
    expect(atKnockOut({ ...r, volumeBasis: 'hot' }, herms, catalog).volumeL).toBe(30);
    expect(pitchedL(r, herms, catalog)).toBeCloseTo(chain(r).b.pitchL, 9);
  });

  it.each(cases)('counts back to the same knock-out: %s', (_, p, bh, b) => {
    const hot = recipe({ ...p, volumeL: 30 });
    const pitch = pitchedL(hot, bh, catalog, b);
    expect(pitch).toBeGreaterThan(0);
    expect(pitch).not.toBeCloseTo(30, 1);
    const cold: Recipe = { ...hot, volumeL: pitch, volumeBasis: 'cold' };
    expect(knockOutL(cold, bh, catalog, b)).toBeCloseTo(30, 6);
    expect(pitchedL(cold, bh, catalog, b)).toBeCloseTo(pitch, 6);
  });

  it.each(cases)('gives the cold volume as Anstellwürze: %s', (_, p, bh, b) => {
    const cold = recipe({ ...p, volumeL: 20, volumeBasis: 'cold' });
    const hot = atKnockOut(cold, bh, catalog, b);
    expect(hot.volumeBasis).toBeUndefined();
    expect(hot.volumeL).toBeGreaterThan(0);
    expect(pitchedL(hot, bh, catalog, b)).toBeCloseTo(20, 6);
  });

  it('works without the catalog, as the tabs do before it loads', () => {
    const cold = recipe({ ...speise, volumeL: 20, volumeBasis: 'cold' });
    // No hops, no Speise: 20 l + 2 l dead space + 1 l line, over the shrink.
    expect(knockOutL(cold, herms, null)).toBeCloseTo(23 / 0.96, 6);
  });

  it('comes as close as it can when out of reach', () => {
    // 5 l of water in the fermenter alone are more than 3 l.
    const cold = recipe({ ...dil({ at: 'fermenter', lead: 'volume', volumeL: 5 }), volumeL: 3, volumeBasis: 'cold' });
    expect(knockOutL(cold, herms, catalog)).toBe(0);
    expect(pitchedL(cold, herms, catalog)).toBeCloseTo(5, 9);
  });
});

describe('fermentationSchedule', () => {
  const phases = [
    { id: 'a', name: 'Haupt', tempC: 12, duration: 10 }, { id: 'b', name: 'Rast', tempC: 18, duration: 2.5, rampDays: 1 },
    { id: 'c', name: 'Kalt', tempC: 1, duration: 14 },
  ];
  const day = 86400000;

  it('lays the phases one after the other in days from the pitching', () => {
    expect(fermentationSchedule(phases, undefined, 0).map((p) => [p.fromDay, p.toDay, p.state])).toEqual([
      [0, 10, undefined], [10, 12.5, undefined], [12.5, 26.5, undefined],
    ]);
  });

  it('marks the current phase once pitched', () => {
    const at = 1_000_000_000_000;
    const s = fermentationSchedule(phases, at, at + 11 * day);
    expect(s.map((p) => p.state)).toEqual(['done', 'current', 'next']);
    expect(s[1].fromAt).toBe(at + 10 * day);
    expect(fermentationSchedule(phases, at, at + 30 * day).every((p) => p.state === 'done')).toBe(true);
  });
});

describe('fermentSollCourse', () => {
  const s = 1 / 86400;
  const p = (tempC: number, duration: number, rampDays?: number) => ({ id: String(tempC), name: 'P', tempC, duration, rampDays });

  it('holds one phase for its duration', () => {
    expect(fermentSollCourse([p(12, 10)])).toEqual({ xs: [0, 10], ys: [12, 12] });
  });

  it('runs a ramp linearly from the phase before, inside the phase', () => {
    expect(fermentSollCourse([p(12, 10), p(18, 3, 1)])).toEqual({ xs: [0, 10, 11, 13], ys: [12, 12, 18, 18] });
  });

  it('lets a phase that is all ramp end at its target', () => {
    expect(fermentSollCourse([p(12, 10), p(1, 4, 4)])).toEqual({ xs: [0, 10, 14], ys: [12, 12, 1] });
  });

  it('caps a ramp longer than its phase and gives the first phase none', () => {
    expect(fermentSollCourse([p(12, 5, 3), p(20, 2, 9)])).toEqual({ xs: [0, 5, 7], ys: [12, 12, 20] });
  });

  it('jumps in a second of its own without a ramp', () => {
    const c = fermentSollCourse([p(12, 10), p(2, 14)]);
    expect(c.ys).toEqual([12, 12, 2, 2]);
    expect(c.xs[2]).toBeCloseTo(10 + s, 9);
    expect(c.xs[3]).toBe(24);
    expect(c.xs.every((x, i) => i === 0 || x > c.xs[i - 1])).toBe(true);
  });

  it('leaves out a phase without a duration, and has no line without phases', () => {
    expect(fermentSollCourse([p(12, 0), p(20, 4)])).toEqual({ xs: [0, 4], ys: [20, 20] });
    expect(fermentSollCourse([])).toEqual({ xs: [], ys: [] });
  });
});

describe('fermenterHints', () => {
  const f = (p: Partial<Fermenter> = {}): Fermenter =>
    ({ id: 'f', name: 'F', updatedAt: 0, kind: 'bucket', volumeL: 30, tempering: 'none', manual: true, ...p });
  const r = recipe();  // 20 °C, then 2 °C

  it('says when the wort does not fit', () => {
    expect(fermenterHints(f(), r, 25)).toEqual([]);
    expect(fermenterHints(f({ volumeL: 20 }), r, 25)[0]).toMatch(/Anstellwürze \(25 l\) ist größer/);
  });

  it('says when the recipe ferments under more pressure than the fermenter takes', () => {
    const p = recipe({ pressureFermentation: true, fermentation: [{ id: 'p', name: 'Haupt', tempC: 20, duration: 7, pressureBar: 1 }] });
    expect(fermenterHints(f(), p, 25)[0]).toMatch(/nicht druckfest/);
    expect(fermenterHints(f({ maxPressureBar: 0.5 }), p, 25)[0]).toMatch(/nur bis 0,5 bar/);
    expect(fermenterHints(f({ maxPressureBar: 2 }), p, 25)).toEqual([]);
  });

  it('says which phase needs cooling or heating the tempering cannot do, only with the surroundings known', () => {
    expect(fermenterHints(f(), r, 25)).toEqual([]);
    expect(fermenterHints(f({ ambientTempC: 19 }), r, 25)).toEqual([expect.stringMatching(/Kaltlagerung \(2 °C\) braucht Kühlen/)]);
    expect(fermenterHints(f({ ambientTempC: 19, tempering: 'cool' }), r, 25)).toEqual([]);
    expect(fermenterHints(f({ ambientTempC: 10, tempering: 'cool' }), r, 25)).toEqual([expect.stringMatching(/Hauptgärung \(20 °C\) braucht Heizen/)]);
    expect(fermenterHints(f({ ambientTempC: 10, tempering: 'both' }), r, 25)).toEqual([]);
    // Within 2 K of the surroundings nothing is needed.
    expect(fermenterHints(f({ ambientTempC: 18 }), recipe({ fermentation: [{ id: 'p', name: 'H', tempC: 20, duration: 7 }] }), 25)).toEqual([]);
  });
});
