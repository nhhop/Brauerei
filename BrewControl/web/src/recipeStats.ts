// Recipe key figures (Kennwerte) from the linked catalog ingredients. Pure, so
// it can later run unchanged on a server. Rows without a catalog link (free
// text) are left out and reported in `notes`; a value that cannot be computed
// stays undefined.
import { breweryBoilC, type Brewery, type Brewhouse } from './brewhouse';
import { ballingBeerAnalysis, hopIbu, moreyEbc } from './brewMath';
import { resolveEfficiency, type Efficiency } from './efficiency';
import { platoToSg } from './gravityUnits';
import type { CatalogIngredient, Range } from './ingredientCatalog';
import { resolveDilution, type DilutionResult } from './recipeWater';
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
export function wortExtract(recipe: Recipe, catalog: CatalogIngredient[], bh?: Brewhouse, brewery?: Brewery | null): {
  extractKg?: number; colors: WortPart[]; note?: string; efficiency: Efficiency;
} {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const worts = recipe.ingredients.filter(
    (i) => i.kind === 'fermentable' && (i.timing === 'mash' || i.timing === 'boil'));
  const fermentables = worts.flatMap((i) => {
    const c = i.ingredientId ? byId.get(i.ingredientId) : undefined;
    return c?.kind === 'fermentable' ? [{ id: i.id, kg: i.amount, c }] : [];
  });
  const note = fermentables.length < worts.length
    ? `${worts.length - fermentables.length} von ${worts.length} Vergärbaren ohne Katalogverknüpfung, nicht eingerechnet`
    : undefined;
  const parts = fermentables.map(({ id, kg, c }) => {
    const moisture = c.moisturePct ? rangeValue(c.moisturePct) : 0;
    const potentialKg = kg * (rangeValue(c.extractDryPct) / 100) * (1 - moisture / 100);
    // Only mashed grain is held back by the efficiency.
    return { id, kg, ebc: rangeValue(c.colorEbc), potentialKg, mashed: c.type === 'malt' || c.type === 'raw-grain' };
  });
  const total = (xs: typeof parts, key: 'kg' | 'potentialKg') => xs.reduce((s, p) => s + p[key], 0);
  const grain = parts.filter((p) => p.mashed);
  const efficiency = resolveEfficiency(recipe, {
    grainKg: total(grain, 'kg'),
    grainExtractKg: total(grain, 'potentialKg'),
    otherExtractKg: total(parts.filter((p) => !p.mashed), 'potentialKg'),
  }, bh, brewery);
  if (fermentables.length === 0) return { colors: [], note, efficiency };
  const eta = efficiency.mashPct === undefined ? undefined : efficiency.mashPct / 100;
  const colors = parts.map(({ id, kg, ebc, potentialKg, mashed }) =>
    ({ id, kg, ebc, extractKg: potentialKg * (mashed ? eta ?? 0 : 1) }));
  const known = eta !== undefined || grain.length === 0;
  return { extractKg: known ? colors.reduce((s, p) => s + p.extractKg, 0) : undefined, colors, note, efficiency };
}

// Beer colour after a planned dilution: in the kettle the knock-out already
// includes it, in the fermenter it thins the wort that arrives.
export function beerEbc(colors: { kg: number; ebc: number }[], volumeL: number, dilution: DilutionResult): number {
  return moreyEbc(colors, volumeL) * (dilution.at === 'fermenter' ? dilution.factor : 1);
}

// `bh` is the recipe's brewhouse; it only matters for a dilution in the fermenter.
// The brewery's altitude sets the boiling point for the bitterness.
export function calcStats(recipe: Recipe, catalog: CatalogIngredient[], bh?: Brewhouse, brewery?: Brewery | null): RecipeStats {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const find = (ingredientId?: string) => (ingredientId ? byId.get(ingredientId) : undefined);
  const volumeL = recipe.volumeL;
  const notes: string[] = [];
  const stats: RecipeStats = { notes };

  // Gravity and colour after a planned dilution: in the kettle the knock-out
  // already includes it, in the fermenter it thins the wort that arrives.
  const { extractKg, colors, note, efficiency } = wortExtract(recipe, catalog, bh, brewery);
  if (note) notes.push(note);
  stats.efficiency = efficiency;
  notes.push(...efficiency.notes);
  const dilution = resolveDilution(recipe, extractKg, bh);
  notes.push(...dilution.notes);
  if (colors.length > 0 && volumeL > 0) {
    stats.ogPlato = dilution.finalPlato;
    stats.ebc = beerEbc(colors, volumeL, dilution);
  }

  // Alcohol: first yeast with a catalog link that states an attenuation.
  const yeast = recipe.ingredients
    .filter((i) => i.kind === 'yeast')
    .map((i) => find(i.ingredientId))
    .find((c) => c?.kind === 'culture' && 'attenuationPct' in c);
  if (stats.ogPlato !== undefined) {
    if (yeast && 'attenuationPct' in yeast) {
      stats.fgPlato = stats.ogPlato * (1 - rangeValue(yeast.attenuationPct) / 100);
      stats.abv = ballingBeerAnalysis(stats.ogPlato, stats.fgPlato).abvPercent;
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
    const c = find(i.ingredientId);
    return c?.kind === 'hop' ? [{ i, c }] : [];
  });
  if (bitter.length < counted.length) {
    notes.push(`${counted.length - bitter.length} von ${counted.length} Hopfengaben ohne Katalogverknüpfung, nicht eingerechnet`);
  }
  if (bitter.length > 0) {
    if (stats.ogPlato === undefined) {
      notes.push(colors.length > 0 ? 'Bittere braucht die Stammwürze' : 'Bittere braucht die Stammwürze (Vergärbares verknüpfen)');
    } else {
      const { durationMin, whirlpoolTempC, whirlpoolMin } = recipe.boil;
      const sg = platoToSg(dilution.kettlePlato!);
      const boilTempC = breweryBoilC(brewery);
      stats.ibu = dilution.factor * bitter.reduce((sum, { i, c }) => {
        const boilMin = i.timing === 'whirlpool' ? 0 : i.timing === 'firstWort' ? durationMin : (i.timeMin ?? durationMin);
        return sum + hopIbu({
          alphaPct: rangeValue(c.alphaPct), grams: i.amount, volumeL: dilution.kettleL, sg,
          boilMin, whirlpoolTempC, whirlpoolMin, boilTempC,
        });
      }, 0);
    }
  }
  return stats;
}
