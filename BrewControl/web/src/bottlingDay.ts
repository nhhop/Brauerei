// Bottling of a brew (Sud 5c-5): the carbonation counted again with what was
// measured, and the containers filled. Pure, like brewDay.ts.
import type { BrewTargets } from './brewDay';
import { speiseVolumeL } from './brewMath';
import type { MeasureId } from './brews';
import type { Container } from './cellar';
import { calcCarbonation, residualTempC, type Bottling, type CarbonationResult } from './fermentation';
import type { CatalogIngredient } from './ingredientCatalog';
import { yeastAttenuation } from './recipeStats';
import type { Recipe } from './recipes';

type Measured = Partial<Record<MeasureId, number>>;

// The carbonation as the recipe plans it, on the beer the chain gives.
export function carbonationPlan(recipe: Recipe, t: BrewTargets): CarbonationResult | undefined {
  const b = t.bottling;
  return b && calcCarbonation(recipe, { beerL: b.beerL, fgPlato: t.values.finalGravity, speiseL: b.speiseL, keg: b.kegL > 0 });
}

// The beer as brewed: the pitched wort as measured (else as planned) less trub
// and dry hops, the Speise set aside and the dilution in the keg as measured
// (else as planned).
export interface BeerNow {
  youngL: number;
  speiseL: number;
  dilutionL: number;           // water added in the keg; 0 without such a dilution
  beerL: number;               // young beer plus Speise and dilution: what is carbonated and filled
  measured: boolean;           // the pitched wort was measured
}

export function beerNow(t: Pick<BrewTargets, 'bottling'>, m: Measured): BeerNow | undefined {
  const b = t.bottling;
  if (!b) return undefined;
  const youngL = b.youngL + ((m.batchVolume ?? b.pitchL) - b.pitchL);
  const speiseL = m.speiseVolume ?? b.speiseL;
  const dilutionL = b.kegL > 0 ? m.dilutionVolume ?? b.kegL : 0;
  return { youngL, speiseL, dilutionL, beerL: Math.max(youngL + speiseL, 0) + dilutionL, measured: m.batchVolume !== undefined };
}

export interface CarbonationNow {
  result?: CarbonationResult;
  beerL: number;               // the beer to carbonate: young beer plus Speise
  speise?: { needL: number; haveL: number; enough: boolean };  // with Speise: what the beer takes against what was set aside
}

// Speise counts as enough within this much, litres.
const SPEISE_SLACK_L = 0.05;

// The carbonation with the beer as brewed (beerNow), the highest temperature
// after the fermentation and the final gravity as measured. The Speise's
// gravity is the knock-out's (as in recipeWater.resolveDilution), its
// attenuation the yeast's. Unset without a planned carbonation or the volume
// chain.
export function carbonationNow(recipe: Recipe, t: BrewTargets, m: Measured, entries: CatalogIngredient[] | null): CarbonationNow | undefined {
  const beer = beerNow(t, m);
  const c = recipe.carbonation;
  if (!beer || !c) return undefined;
  const { speiseL: haveL, beerL } = beer;
  const tempC = m.maxTempAfter ?? residualTempC(recipe);
  const keg = (t.bottling?.kegL ?? 0) > 0;

  let speise: CarbonationNow['speise'];
  let needL = 0;
  if (c.method === 'speise' && !keg) {
    const plato = t.dilutionInKettle ? t.water?.dilution.finalPlato : m.postBoilGravity ?? t.values.postBoilGravity;
    const att = entries ? yeastAttenuation(recipe, entries) : undefined;
    if (plato !== undefined && att !== undefined && tempC !== undefined) {
      needL = speiseVolumeL(beerL, c.targetVol, tempC, plato, att / 100);
      speise = { needL, haveL, enough: haveL >= needL - SPEISE_SLACK_L };
    }
  }
  const result = calcCarbonation(recipe, {
    beerL, fgPlato: m.finalGravity ?? t.values.finalGravity, speiseL: needL, tempC, keg,
  });
  return { result, beerL, speise };
}

// ── Containers ───────────────────────────────────────────────────────────────────

export interface ContainerRow { containerId: string; count: number; container?: Container }

// The recipe's plan as counts per container id (what a brew starts from).
export const containerPlan = (b: Bottling | undefined): Record<string, number> =>
  Object.fromEntries((b?.lines ?? []).map((l) => [l.row.containerId, l.count]));

// `containers` null = not loaded, then a row has no container.
export const containerRows = (counts: Record<string, number>, containers: Container[] | null): ContainerRow[] =>
  Object.entries(counts).map(([containerId, count]) => ({ containerId, count, container: containers?.find((c) => c.id === containerId) }));

// Litres in the containers filled; unset while a container is unknown.
export function containerLiters(rows: ContainerRow[]): number | undefined {
  if (rows.length === 0 || rows.some((r) => !r.container)) return undefined;
  return rows.reduce((l, r) => l + r.count * r.container!.sizeL, 0);
}
