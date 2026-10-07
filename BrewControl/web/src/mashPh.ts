// pH of mash and wort (card "Aufbereitung" in the tab "Wasser"), estimated from
// the grist and the treated water. Pure, like waterChem.ts.
//
// Model "troester": Troester 2009, "The effect of brewing water and grist
// composition on the pH of the mash" (braukaiser.com).
// - Distilled water pH of the grist: Σ pHb·gb + 5.7·Σ gs − 0.14·Σ(as·gs)/R, with
//   base malts by their distilled water pH, specialty malts by their acidity
//   (mEq/kg, titrated to pH 5.7) and R the mash thickness in l/kg.
// - The water shifts it by s·RA, s = 0.013·R + 0.013 pH·l/mEq.
// - Acid beyond the water's alkalinity acts on the malt's buffer instead: 38.5
//   mEq/(kg·pH) from Troester's mash titration (0.104 pH·l/mEq at 4 l/kg), close
//   to the 40 the literature gives (deLange). Linear in the RA, his own series
//   with hydrochloric acid (Table 3, pilsner malt) is up to 0.2 pH off; with the
//   buffer it is within 0.04. Decision 2026-10-07.
// - The wort keeps that buffer per kg of grist: mixing and boiling off change
//   acid and buffer alike. What goes in after mashing (sparge water, additions)
//   counts with its residual alkalinity, bicarbonate fully, since the CO₂ boils
//   off. TODO(verify): Troester measured the mash only.
// Model "kolbach": the residual alkalinity only, against Palmer's range for the
// beer colour; no pH figure, as RA is classically used.
import { EBC_PER_SRM } from './brewMath';
import type { CatalogIngredient, Fermentable } from './ingredientCatalog';
import { rangeValue } from './recipeStats';
import type { Recipe } from './recipes';
import { figuresOf, type WaterState } from './waterChem';

export type PhModel = 'troester' | 'kolbach';
export const PH_MODEL_LABEL: Record<PhModel, string> = { troester: 'Troester', kolbach: 'Kolbach' };
export const DEFAULT_PH_MODEL: PhModel = 'troester';

export const DEFAULT_MASH_PH = 5.4;   // target of the mash helper while none is set
export const MALT_BUFFER = 38.5;      // mEq/(kg·pH)
// Drop during the boil, from calcium phosphate, Maillard products and hop
// acids: 0.1–0.2 (Troester, braukaiser.com, "How pH affects brewing").
export const BOIL_PH_DROP = 0.15;

const SPECIALTY_PH = 5.7;     // end point of the specialty malt titration
const ACIDITY_SLOPE = 0.14;   // pH·l/mEq
// Troester's base malt line (Table 2, R² 0.54) spans 3.5–25 EBC; a darker
// specialty malt without data counts as caramel malt (decision 2026-10-07: his
// biscuit malt had 20.2 mEq/kg, the caramel line gives 21.8).
const BASE_LINE_MAX_EBC = 25;
const LACTIC_MOLAR = 90.08;

export const alkalinitySlope = (ratio: number) => 0.013 * ratio + 0.013;

// A malt in Troester's terms: a base malt by its distilled water pH, a specialty
// malt by its acidity. `estimated`: from role and colour, the data sheet has neither.
export interface GristPart {
  name: string;
  kg: number;
  ph?: number;
  acidity?: number;     // mEq/kg
  estimated: boolean;
  lactic?: boolean;     // acidity from the lactic acid content (acidulated malt)
}

export function gristPart(name: string, kg: number, c: Fermentable): GristPart | undefined {
  if (c.type !== 'malt' && c.type !== 'raw-grain') return undefined;
  const ebc = rangeValue(c.colorEbc);
  const base: GristPart = { name, kg, ph: 5.82 - 0.02 * ebc, estimated: true };
  const caramel: GristPart = { name, kg, acidity: 14 + 0.13 * ebc, estimated: true };
  if (c.type === 'raw-grain') return base;
  if (c.acidityMeqPerKg) return { name, kg, acidity: rangeValue(c.acidityMeqPerKg), estimated: false };
  if (c.lacticAcidPct) return { name, kg, acidity: (rangeValue(c.lacticAcidPct) * 10000) / LACTIC_MOLAR, estimated: false, lactic: true };
  if (c.distilledWaterPh) return { name, kg, ph: rangeValue(c.distilledWaterPh), estimated: false };
  if (c.role === 'base') return base;
  if (c.role === 'caramel') return caramel;
  if (c.role === 'roasted') return { name, kg, acidity: 40, estimated: true };
  return ebc <= BASE_LINE_MAX_EBC ? base : caramel;
}

// The mashed malts and raw grain of a recipe; sugar in the mash is no grist.
export function gristOf(recipe: Recipe, catalog: CatalogIngredient[] | null): { parts: GristPart[]; notes: string[] } {
  const notes: string[] = [];
  const mashed = recipe.ingredients.filter((i) => i.kind === 'fermentable' && i.timing === 'mash');
  let unlinked = 0;
  const parts = mashed.flatMap((i) => {
    const c = catalog?.find((x) => x.id === i.ingredientId);
    if (c?.kind !== 'fermentable') {
      unlinked++;
      return [];
    }
    const p = gristPart(i.name || c.name, i.amount, c);
    return p ? [p] : [];
  });
  if (unlinked > 0) notes.push(`${unlinked} von ${mashed.length} Malzen ohne Katalogverknüpfung, nicht in der pH-Schätzung.`);
  const estimated = parts.filter((p) => p.estimated).map((p) => p.name);
  if (estimated.length > 0) notes.push(`Ohne Malzdaten, aus Rolle und Farbe geschätzt: ${estimated.join(', ')}.`);
  if (parts.some((p) => p.lactic)) {
    notes.push('Sauermalz zählt nach Troesters Malzformel und wirkt dort etwa 1,5-mal stärker als dieselbe Milchsäure flüssig.');
  }
  return { parts, notes };
}

export function distilledWaterPh(parts: GristPart[], ratio: number): number | undefined {
  const kg = parts.reduce((s, p) => s + p.kg, 0);
  if (kg <= 0 || ratio <= 0) return undefined;
  return parts.reduce((s, p) => {
    const g = p.kg / kg;
    return s + (p.acidity === undefined ? g * p.ph! : g * SPECIALTY_PH - (ACIDITY_SLOPE * p.acidity * g) / ratio);
  }, 0);
}

// Mash of a grist with distilled water pH `diPh` in `ratio` l/kg of `w`: the
// strike water with everything dosed into the mash, per litre of strike water.
export function mashPh(diPh: number, ratio: number, w: WaterState): number {
  const { alk, ra } = figuresOf(w);
  const hardness = alk - ra;
  return diPh + alkalinitySlope(ratio) * (Math.max(alk, 0) - hardness) + (Math.min(alk, 0) * ratio) / MALT_BUFFER;
}

// Palmer (How to Brew): RA as CaCO₃ over the beer colour in SRM, from 12.2·SRM −
// 122.4 (colour from base and caramel malts) to 12.2·(SRM − 5.2) (from roasted
// malts); in mEq/l. TODO(verify): taken from a forum post quoting the book.
export function raRangeForColor(ebc: number): [number, number] {
  const srm = ebc / EBC_PER_SRM;
  return [(12.2 * srm - 122.4) / 50, (12.2 * (srm - 5.2)) / 50];
}
