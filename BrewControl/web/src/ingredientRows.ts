// Figures per recipe row for the ingredient tables (tab "Zutaten" and the
// process tabs): a fermentable's share and its part of the original gravity
// and the colour, a hop addition's bitterness and oil. Pure, like recipeStats.ts.
// Pass the recipe at its knock-out (recipeStats.atKnockOut), as the tabs do.
import type { Brewery, Brewhouse } from './brewhouse';
import { lovibond } from './brewMath';
import type { CatalogIngredient } from './ingredientCatalog';
import { calcStats, hopIbus, rangeValue, wortExtract } from './recipeStats';
import { pitchL, resolveDilution } from './recipeWater';
import type { Recipe } from './recipes';
import { entryOf } from './stockLots';

// Display values, rounded; a column's rounding difference sits on its largest
// row, so the rows add up to the total shown below them.
export interface RowFigures {
  sharePct?: number; // fermentable in the wort: share of those kg, 0.1 %
  plato?: number;    // its part of the original gravity, 0.1 °P
  ebc?: number;      // its part of the colour, 0.1 EBC
  ibu?: number;      // hop addition, whole IBU
  oilMl?: number;    // hop addition, total oil in ml (0.01)
}

export interface IngredientFigures {
  rows: Map<string, RowFigures>;
  wortKg: number;      // fermentables into the mash or the kettle
  ogPlato?: number;
  ebc?: number;
  ibu?: number;
  hopG: number;
  coldGPerL?: number;  // hops in the fermenter (dip, dry hopping) per litre of Anstellwürze
}

const FERMENTER_HOP = ['dip', 'primary', 'maturation'];

// Rounds `xs` to `digits` and moves the difference to the rounded `total`
// onto the largest value.
export function balance(xs: Map<string, number>, digits: number, total: number): Map<string, number> {
  const f = 10 ** digits;
  const out = new Map([...xs].map(([k, v]) => [k, Math.round(v * f) / f]));
  if (out.size === 0) return out;
  const diff = Math.round(total * f) - [...out.values()].reduce((s, v) => s + Math.round(v * f), 0);
  const largest = [...xs].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  out.set(largest, (Math.round(out.get(largest)! * f) + diff) / f);
  return out;
}

const sum = (xs: Iterable<number>) => [...xs].reduce((s, x) => s + x, 0);

export function ingredientFigures(recipe: Recipe, entries: CatalogIngredient[] | null, bh?: Brewhouse, brewery?: Brewery | null): IngredientFigures {
  const rows = new Map<string, RowFigures>();
  const at = (id: string) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = {}));
    return r;
  };

  const wort = recipe.ingredients.filter((i) => i.kind === 'fermentable' && (i.timing === 'mash' || i.timing === 'boil'));
  const wortKg = sum(wort.map((i) => i.amount));
  if (wortKg > 0) {
    const share = new Map(wort.map((i) => [i.id, (i.amount / wortKg) * 100]));
    for (const [id, v] of balance(share, 1, 100)) at(id).sharePct = v;
  }

  const hops = recipe.ingredients.filter((i) => i.kind === 'hop');
  const hopG = sum(hops.map((i) => i.amount));
  const out: IngredientFigures = { rows, wortKg, hopG };
  if (!entries) return out;

  const stats = calcStats(recipe, entries, bh, brewery);
  out.ogPlato = stats.ogPlato;
  out.ebc = stats.ebc;
  out.ibu = stats.ibu;

  const w = wortExtract(recipe, entries, bh, brewery);
  const extractAll = sum(w.colors.map((p) => p.extractKg));
  const colorAll = sum(w.colors.map((p) => lovibond(p.ebc) * p.kg));
  if (stats.ogPlato !== undefined && extractAll > 0) {
    const plato = new Map(w.colors.map((p) => [p.id, (stats.ogPlato! * p.extractKg) / extractAll]));
    for (const [id, v] of balance(plato, 1, stats.ogPlato)) at(id).plato = v;
  }
  // Morey's MCU are linear in the grain: each row's share of them.
  if (stats.ebc !== undefined && colorAll > 0) {
    const ebc = new Map(w.colors.map((p) => [p.id, (stats.ebc! * lovibond(p.ebc) * p.kg) / colorAll]));
    for (const [id, v] of balance(ebc, 1, stats.ebc)) at(id).ebc = v;
  }

  const dilution = resolveDilution(recipe, w.extractKg, bh, w.draw);
  if (stats.ibu !== undefined) {
    for (const [id, v] of balance(hopIbus(recipe, entries, dilution, brewery), 0, stats.ibu)) at(id).ibu = v;
  }
  for (const i of hops) {
    const c = entryOf(i, entries);
    if (c?.kind === 'hop' && c.oilMlPer100g) at(i.id).oilMl = Math.round(i.amount * rangeValue(c.oilMlPer100g)) / 100;
  }
  const coldG = sum(hops.filter((i) => FERMENTER_HOP.includes(i.timing)).map((i) => i.amount));
  const pitched = pitchL(dilution);
  if (coldG > 0 && pitched > 0) out.coldGPerL = coldG / pitched;
  return out;
}
