import { describe, expect, it } from 'vitest';
import { TEMPLATES } from './brewhouse';
import { forcedCarbonationBar, krausenRackingPlato, primingSugarGrams, residualCo2Volumes, speiseVolumeL } from './brewMath';
import type { Container } from './cellar';
import { calcBottling, calcCarbonation, dryHopL, kettleHopL, maxPhasePressureBar } from './fermentation';
import type { CatalogIngredient, StockLot } from './ingredientCatalog';
import { calcStats, wortExtract } from './recipeStats';
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
