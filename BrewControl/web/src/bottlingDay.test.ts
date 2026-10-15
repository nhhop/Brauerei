import { describe, expect, it } from 'vitest';
import { brewTargets, type BrewInputs } from './brewDay';
import { TEMPLATES, type Brewery } from './brewhouse';
import { forcedCarbonationBar, krausenRackingPlato, primingSugarGrams, speiseVolumeL } from './brewMath';
import { beerNow, carbonationNow, carbonationPlan, containerLiters, containerPlan, containerRows } from './bottlingDay';
import type { Container } from './cellar';
import type { CatalogIngredient } from './ingredientCatalog';
import { newRecipe, type Ingredient, type Recipe } from './recipes';

const catalog = [
  { id: 'malt:base', kind: 'fermentable', type: 'malt', name: 'Base', colorEbc: [3, 3], extractDryPct: [80, 80], moisturePct: [4, 4] },
  { id: 'yeast:us05', kind: 'culture', organism: 'saccharomyces', name: 'US-05', attenuationPct: [78, 82] },
] as CatalogIngredient[];
const herms = { ...TEMPLATES.find((t) => t.key === 'herms3')!.build(), id: 'bh-herms' };
const brewery: Brewery = { grainTempC: 18, tapWaterTempC: 12, altitudeM: 300 };
const inputs = (containers: Container[] | null = null): BrewInputs => ({ bh: herms, brewery, entries: catalog, containers });

const row = (p: Partial<Ingredient>): Ingredient =>
  ({ id: Math.random().toString(36).slice(2), kind: 'fermentable', name: 'x', amount: 0, timing: 'mash', ...p });
const malt = row({ id: 'm', ingredientId: 'malt:base', amount: 5 });
const yeast = row({ id: 'y', kind: 'yeast', ingredientId: 'yeast:us05', amount: 11, timing: 'pitch' });
const phases = [{ id: 'p1', name: 'Haupt', tempC: 19, duration: 7 }, { id: 'p2', name: 'Kalt', tempC: 2, duration: 14 }];
const recipe = (p: Partial<Recipe> = {}): Recipe =>
  ({ ...newRecipe(), volumeL: 22, brewhouseId: herms.id, ingredients: [malt, yeast], fermentation: phases, trubLossL: 0.5, ...p });

const keg: Container = { id: 'keg', updatedAt: 0, kind: 'keg', sizeL: 19, count: 1 };
const bottle: Container = { id: 'bottle', updatedAt: 0, kind: 'bottle', sizeL: 0.5, count: 50, fillLossL: 0.02 };

describe('carbonationNow', () => {
  const sugar = recipe({ carbonation: { method: 'sugar', targetVol: 2.5 } });
  const t = brewTargets(sugar, inputs());

  it('gives the plan back when nothing was measured', () => {
    const plan = carbonationPlan(sugar, t)!;
    const now = carbonationNow(sugar, t, {}, catalog)!;
    expect(now.beerL).toBeCloseTo(t.bottling!.beerL, 9);
    expect(now.result!.sugarG).toBeCloseTo(plan.sugarG!, 9);
    expect(plan.sugarG).toBeCloseTo(primingSugarGrams(t.bottling!.beerL, 2.5, 19, 'saccharose'), 9);
  });

  it('counts the beer from the pitched wort as measured, and the temperature', () => {
    const less = carbonationNow(sugar, t, { batchVolume: t.values.batchVolume! - 2 }, catalog)!;
    expect(less.beerL).toBeCloseTo(t.bottling!.beerL - 2, 9);
    expect(less.result!.sugarG!).toBeLessThan(carbonationPlan(sugar, t)!.sugarG!);
    const warm = carbonationNow(sugar, t, { maxTempAfter: 22 }, catalog)!;
    expect(warm.result!.residualTempC).toBe(22);
    expect(warm.result!.sugarG!).toBeGreaterThan(carbonationPlan(sugar, t)!.sugarG!);  // less CO₂ stays in warm beer
  });

  it('racks green beer at the final gravity as measured', () => {
    const krausen = recipe({ carbonation: { method: 'krausen', targetVol: 2.5 } });
    const k = brewTargets(krausen, inputs());
    expect(carbonationNow(krausen, k, { finalGravity: 3.1 }, catalog)!.result!.rackingPlato).toBeCloseTo(krausenRackingPlato(3.1, 2.5, 19), 9);
    expect(carbonationNow(krausen, k, {}, catalog)!.result!.rackingPlato).toBeCloseTo(carbonationPlan(krausen, k)!.rackingPlato!, 9);
  });

  it('keeps the pressure of a forced carbonation', () => {
    const forced = recipe({ carbonation: { method: 'forced', targetVol: 2.5 } });
    expect(carbonationNow(forced, brewTargets(forced, inputs()), {}, catalog)!.result!.pressureBar).toBeCloseTo(forcedCarbonationBar(2.5, 2), 9);
  });

  it('is unset without a carbonation or the chain', () => {
    expect(carbonationNow(recipe(), brewTargets(recipe(), inputs()), {}, catalog)).toBeUndefined();
    expect(carbonationNow(sugar, brewTargets(sugar, { ...inputs(), bh: undefined }), {}, catalog)).toBeUndefined();
  });
});

describe('carbonationNow with Speise', () => {
  const speise = recipe({ carbonation: { method: 'speise', targetVol: 2.5 } });
  const t = brewTargets(speise, inputs());

  it('has enough Speise when the brew is as planned, and the plan names the amount', () => {
    const now = carbonationNow(speise, t, {}, catalog)!;
    expect(t.bottling!.speiseL).toBeGreaterThan(0);
    expect(now.speise!.haveL).toBeCloseTo(t.bottling!.speiseL, 9);
    expect(now.speise!.needL).toBeCloseTo(t.bottling!.speiseL, 6);
    expect(now.speise!.enough).toBe(true);
    expect(now.result!.speiseL).toBeCloseTo(now.speise!.needL, 9);
  });

  it('needs more with more beer or a colder end, and says when the Speise falls short', () => {
    const more = carbonationNow(speise, t, { batchVolume: t.values.batchVolume! + 5 }, catalog)!;
    expect(more.speise!.needL).toBeGreaterThan(t.bottling!.speiseL);
    expect(more.speise!.enough).toBe(false);
    const less = carbonationNow(speise, t, { speiseVolume: t.bottling!.speiseL / 2 }, catalog)!;
    expect(less.speise!.enough).toBe(false);
    expect(carbonationNow(speise, t, { speiseVolume: t.bottling!.speiseL + 1 }, catalog)!.speise!.enough).toBe(true);
  });

  it('uses the knock-out gravity as measured', () => {
    const now = carbonationNow(speise, t, { postBoilGravity: t.values.postBoilGravity! - 2 }, catalog)!;
    const beerL = now.beerL;
    expect(now.speise!.needL).toBeCloseTo(speiseVolumeL(beerL, 2.5, 19, t.values.postBoilGravity! - 2, 0.8), 6);
    expect(now.speise!.needL).toBeGreaterThan(t.bottling!.speiseL);
  });

  it('gives no verdict without a yeast attenuation', () => {
    expect(carbonationNow(speise, t, {}, [])!.speise).toBeUndefined();
  });
});

describe('containers', () => {
  const r = recipe({ bottling: { containers: [{ containerId: 'bottle', count: 20 }, { containerId: 'keg' }] } });
  const t = brewTargets(r, inputs([keg, bottle]));

  it('starts from the recipe and sums the litres', () => {
    const plan = containerPlan(t.bottling);
    expect(Object.keys(plan)).toEqual(['bottle', 'keg']);
    expect(plan.bottle).toBe(20);
    const rows = containerRows(plan, [keg, bottle]);
    expect(containerLiters(rows)).toBeCloseTo(10 + plan.keg * 19, 9);
    expect(containerLiters(rows)).toBeCloseTo(t.values.bottledVolume!, 9);
  });

  it('has no litres while a container is unknown or there are none', () => {
    expect(containerLiters(containerRows({ keg: 1 }, null))).toBeUndefined();
    expect(containerLiters(containerRows({ gone: 2 }, [keg]))).toBeUndefined();
    expect(containerLiters([])).toBeUndefined();
    expect(containerPlan(undefined)).toEqual({});
  });
});

describe('beerNow', () => {
  const speise = recipe({ carbonation: { method: 'speise', targetVol: 2.5 } });
  const t = brewTargets(speise, inputs());
  const b = t.bottling!;

  it('is the plan\'s beer before anything was measured', () => {
    const now = beerNow(t, {})!;
    expect(now).toMatchObject({ measured: false });
    expect(now.youngL).toBeCloseTo(b.youngL, 9);
    expect(now.beerL).toBeCloseTo(b.beerL, 9);
  });

  it('follows the pitched wort and the Speise as measured', () => {
    const now = beerNow(t, { batchVolume: b.pitchL - 1.5, speiseVolume: b.speiseL + 0.5 })!;
    expect(now.measured).toBe(true);
    expect(now.youngL).toBeCloseTo(b.youngL - 1.5, 9);
    expect(now.beerL).toBeCloseTo(b.beerL - 1.5 + 0.5, 9);
  });

  it('is unset without the chain', () => {
    expect(beerNow(brewTargets(speise, { ...inputs(), bh: undefined }), {})).toBeUndefined();
  });
});
