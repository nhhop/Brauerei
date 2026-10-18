// Recipe key figures (Kennwerte) from the linked catalog ingredients. Pure, so
// it can later run unchanged on a server. Rows without a catalog link (free
// text) are left out and reported in `notes`; a value that cannot be computed
// stays undefined.
import { breweryBoilC, type Brewery, type Brewhouse } from './brewhouse';
import { ballingBeerAnalysis, hopIbu, moreyEbc } from './brewMath';
import { resolveEfficiency, type Efficiency, type Grist } from './efficiency';
import { platoToSg } from './gravityUnits';
import type { CatalogIngredient, Range } from './ingredientCatalog';
import { pitchL, resolveDilution, type DilutionResult } from './recipeWater';
import { wortDraw, type WortDraw } from './fermentation';
import { entryOf } from './stockLots';
import type { Recipe } from './recipes';

export interface RecipeStats {
  ogPlato?: number;
  fgPlato?: number;   // apparent, from the yeast's attenuation
  abv?: number;
  ebc?: number;
  ibu?: number;
  efficiency?: Efficiency;
  notes: string[];
}

// Midpoint, or the one end that is set ("min. 80.5", "max. 5").
export function rangeValue(r: Range): number {
  const [lo, hi] = r;
  return lo !== null && hi !== null ? (lo + hi) / 2 : (lo ?? hi)!;
}

// One linked fermentable that counts towards the OG: its colour row and the
// extract it brings (kg, after the efficiency).
export interface WortPart { id: string; kg: number; ebc: number; extractKg: number }

// Extract (kg) of the fermentables that go into the mash or the kettle, and
// their colour rows. Priming sugar and the like (primary, bottling) do not
// count towards the OG. Unset without a linked fermentable, or when the
// efficiency chain cannot give the Maischeeffizienz (efficiency.ts).
// `bh` and `brewery` feed the chain; without them it takes the recipe's input.
// `grist` is what the efficiency chain saw; `boilOtherKg` the part of its
// other extract added in the kettle (sugar at "Kochen"), missing before the boil.
// `draw` is what the hops, trub and Speise take off the wort (fermentation.ts),
// for calcWater and resolveDilution.
export function wortExtract(recipe: Recipe, catalog: CatalogIngredient[], bh?: Brewhouse, brewery?: Brewery | null): {
  extractKg?: number; colors: WortPart[]; note?: string; efficiency: Efficiency; grist: Grist; boilOtherKg: number; draw: WortDraw;
} {
  const worts = recipe.ingredients.filter(
    (i) => i.kind === 'fermentable' && (i.timing === 'mash' || i.timing === 'boil'));
  const fermentables = worts.flatMap((i) => {
    const c = entryOf(i, catalog);
    return c?.kind === 'fermentable' ? [{ id: i.id, kg: i.amount, c, boil: i.timing === 'boil' }] : [];
  });
  const note = fermentables.length < worts.length
    ? `${worts.length - fermentables.length} von ${worts.length} Vergärbaren ohne Katalogverknüpfung, nicht eingerechnet`
    : undefined;
  const parts = fermentables.map(({ id, kg, c, boil }) => {
    const moisture = c.moisturePct ? rangeValue(c.moisturePct) : 0;
    const potentialKg = kg * (rangeValue(c.extractDryPct) / 100) * (1 - moisture / 100);
    // Only mashed grain is held back by the efficiency.
    return { id, kg, ebc: rangeValue(c.colorEbc), potentialKg, mashed: c.type === 'malt' || c.type === 'raw-grain', boil };
  });
  const total = (xs: typeof parts, key: 'kg' | 'potentialKg') => xs.reduce((s, p) => s + p[key], 0);
  const grain = parts.filter((p) => p.mashed);
  const grist: Grist = {
    grainKg: total(grain, 'kg'),
    grainExtractKg: total(grain, 'potentialKg'),
    otherExtractKg: total(parts.filter((p) => !p.mashed), 'potentialKg'),
  };
  const boilOtherKg = total(parts.filter((p) => !p.mashed && p.boil), 'potentialKg');
  const draw = wortDraw(recipe, catalog, yeastAttenuation(recipe, catalog));
  const efficiency = resolveEfficiency(recipe, grist, bh, brewery, draw.kettleHopL);
  if (fermentables.length === 0) return { colors: [], note, efficiency, grist, boilOtherKg, draw };
  const eta = efficiency.mashPct === undefined ? undefined : efficiency.mashPct / 100;
  const colors = parts.map(({ id, kg, ebc, potentialKg, mashed }) =>
    ({ id, kg, ebc, extractKg: potentialKg * (mashed ? eta ?? 0 : 1) }));
  const known = eta !== undefined || grain.length === 0;
  return { extractKg: known ? colors.reduce((s, p) => s + p.extractKg, 0) : undefined, colors, note, efficiency, grist, boilOtherKg, draw };
}

// Anstellwürze of the recipe brewed with a knock-out of `knockOutL`, as the tabs
// compute it (without catalog no extract and no draw).
function pitchAt(recipe: Recipe, knockOutL: number, bh: Brewhouse | undefined, entries: CatalogIngredient[] | null, brewery?: Brewery | null): number {
  const r: Recipe = { ...recipe, volumeL: knockOutL, volumeBasis: undefined };
  const wort = entries ? wortExtract(r, entries, bh, brewery) : undefined;
  return pitchL(resolveDilution(r, wort?.extractKg, bh, wort?.draw));
}

// The knock-out (hot): the recipe's volume, or with volumeBasis 'cold' the one
// whose chain gives the recipe's volume as Anstellwürze. The knock-out reaches
// into the efficiency (fermenter share, lauter) and the gravity (Speise, a
// dilution led by gravity), so it is solved for: the Anstellwürze grows with
// the knock-out, regula falsi (Illinois) between 0 and a doubled bracket.
// Every reader of the knock-out goes through here (or atKnockOut); the chain's
// own functions read `volumeL` of that copy, they are what is solved.
// Out of reach: the knock-out that comes closest (check with pitchedL).
export function knockOutL(recipe: Recipe, bh: Brewhouse | undefined, entries: CatalogIngredient[] | null, brewery?: Brewery | null): number {
  const target = recipe.volumeL;
  if (recipe.volumeBasis !== 'cold' || !(target > 0)) return target;
  const miss = (k: number) => pitchAt(recipe, k, bh, entries, brewery) - target;
  // A dilution in the fermenter by volume is there without any knock-out.
  let lo = 0, flo = miss(0);
  if (flo >= 0) return 0;
  let hi = target, fhi = miss(hi);
  for (let i = 0; fhi < 0 && i < 40; i++) {
    lo = hi; flo = fhi;
    hi *= 2; fhi = miss(hi);
  }
  if (fhi < 0) return hi;
  let side = 0;
  for (let i = 0; i < 100 && hi - lo > 1e-9; i++) {
    const k = (lo * fhi - hi * flo) / (fhi - flo);
    const f = miss(k);
    if (Math.abs(f) < 1e-9) return k;
    if (f < 0) {
      lo = k; flo = f;
      if (side === -1) fhi /= 2;
      side = -1;
    } else {
      hi = k; fhi = f;
      if (side === 1) flo /= 2;
      side = 1;
    }
  }
  return (lo + hi) / 2;
}

// The recipe with its knock-out as volume, for the chain's functions
// (calcWater, calcStats, wortExtract, resolveDilution, calcBottling). The same
// object with volumeBasis 'hot'. Only for computing, never to save.
export function atKnockOut(recipe: Recipe, bh: Brewhouse | undefined, entries: CatalogIngredient[] | null, brewery?: Brewery | null): Recipe {
  return recipe.volumeBasis !== 'cold' ? recipe
    : { ...recipe, volumeL: knockOutL(recipe, bh, entries, brewery), volumeBasis: undefined };
}

// The Anstellwürze the recipe gives; with 'cold' its volume when in reach.
export const pitchedL = (recipe: Recipe, bh: Brewhouse | undefined, entries: CatalogIngredient[] | null, brewery?: Brewery | null) =>
  pitchAt(recipe, knockOutL(recipe, bh, entries, brewery), bh, entries, brewery);

// Apparent attenuation (%) of the first yeast with a catalog link that states one.
export function yeastAttenuation(recipe: Recipe, catalog: CatalogIngredient[]): number | undefined {
  const yeast = recipe.ingredients
    .filter((i) => i.kind === 'yeast')
    .map((i) => entryOf(i, catalog))
    .find((c) => c?.kind === 'culture' && 'attenuationPct' in c);
  return yeast && 'attenuationPct' in yeast ? rangeValue(yeast.attenuationPct) : undefined;
}

// Beer colour after a planned dilution: in the kettle the knock-out already
// includes it, in the fermenter it thins the wort that arrives, in the keg the beer.
export function beerEbc(colors: { kg: number; ebc: number }[], volumeL: number, dilution: DilutionResult): number {
  return moreyEbc(colors, volumeL) * (dilution.at !== 'kettle' ? dilution.factor : 1);
}

// `bh` is the recipe's brewhouse; it only matters for a dilution in the fermenter.
// The brewery's altitude sets the boiling point for the bitterness.
export function calcStats(recipe: Recipe, catalog: CatalogIngredient[], bh?: Brewhouse, brewery?: Brewery | null): RecipeStats {
  const volumeL = recipe.volumeL;
  const notes: string[] = [];
  const stats: RecipeStats = { notes };

  // Gravity and colour after a planned dilution: in the kettle the knock-out
  // already includes it, in the fermenter it thins the wort that arrives.
  const { extractKg, colors, note, efficiency, draw } = wortExtract(recipe, catalog, bh, brewery);
  if (note) notes.push(note);
  stats.efficiency = efficiency;
  notes.push(...efficiency.notes);
  const dilution = resolveDilution(recipe, extractKg, bh, draw);
  notes.push(...dilution.notes);
  if (colors.length > 0 && volumeL > 0) {
    stats.ogPlato = dilution.finalPlato;
    stats.ebc = beerEbc(colors, volumeL, dilution);
  }

  // Alcohol: first yeast with a catalog link that states an attenuation.
  const attenuation = yeastAttenuation(recipe, catalog);
  if (stats.ogPlato !== undefined) {
    if (attenuation !== undefined) {
      stats.fgPlato = stats.ogPlato * (1 - attenuation / 100);
      // In the keg the finished beer is diluted: its alcohol by volume.
      const og = dilution.at === 'keg' ? dilution.kettlePlato! : stats.ogPlato;
      const factor = dilution.at === 'keg' ? dilution.factor : 1;
      stats.abv = ballingBeerAnalysis(og, og * (1 - attenuation / 100)).abvPercent * factor;
    } else {
      notes.push('Alkohol braucht eine Hefe mit Katalogverknüpfung');
    }
  }

  // Bitterness: first wort, boil and whirlpool additions. The boil gravity and
  // volume are approximated by the gravity and volume at the end of the boil;
  // a dilution thins the result.
  const hops = recipe.ingredients.filter((i) => i.kind === 'hop');
  const counted = hops.filter((i) => i.timing === 'firstWort' || i.timing === 'boil' || i.timing === 'whirlpool');
  if (counted.length < hops.length) {
    notes.push(`${hops.length - counted.length} Hopfengaben (Hop Back, Dip, Maische, Gärung) nicht in der Bittere`);
  }
  const bitter = counted.flatMap((i) => {
    const c = entryOf(i, catalog);
    return c?.kind === 'hop' ? [{ i, c }] : [];
  });
  if (bitter.length < counted.length) {
    notes.push(`${counted.length - bitter.length} von ${counted.length} Hopfengaben ohne Katalogverknüpfung, nicht eingerechnet`);
  }
  if (bitter.length > 0) {
    if (stats.ogPlato === undefined) {
      notes.push(colors.length > 0 ? 'Bittere braucht die Stammwürze' : 'Bittere braucht die Stammwürze (Vergärbares verknüpfen)');
    } else {
      stats.ibu = [...hopIbus(recipe, catalog, dilution, brewery).values()].reduce((s, x) => s + x, 0);
    }
  }
  return stats;
}

// Bitterness of each linked first wort, boil and whirlpool addition (by row
// id), after the dilution; needs the kettle gravity. The boil gravity and
// volume are approximated by those at the end of the boil.
export function hopIbus(recipe: Recipe, catalog: CatalogIngredient[], dilution: DilutionResult, brewery?: Brewery | null): Map<string, number> {
  const out = new Map<string, number>();
  if (dilution.kettlePlato === undefined) return out;
  const { durationMin, whirlpoolTempC, whirlpoolMin } = recipe.boil;
  const sg = platoToSg(dilution.kettlePlato);
  const boilTempC = breweryBoilC(brewery);
  for (const i of recipe.ingredients) {
    if (i.kind !== 'hop' || !(i.timing === 'firstWort' || i.timing === 'boil' || i.timing === 'whirlpool')) continue;
    const c = entryOf(i, catalog);
    if (c?.kind !== 'hop') continue;
    const boilMin = i.timing === 'whirlpool' ? 0 : i.timing === 'firstWort' ? durationMin : (i.timeMin ?? durationMin);
    out.set(i.id, dilution.factor * hopIbu({
      alphaPct: rangeValue(c.alphaPct), grams: i.amount, volumeL: dilution.kettleL, sg,
      boilMin, whirlpoolTempC, whirlpoolMin, boilTempC,
    }));
  }
  return out;
}
