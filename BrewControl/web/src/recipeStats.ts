// Recipe key figures (Kennwerte) from the linked catalog ingredients. Pure, so
// it can later run unchanged on a server. Rows without a catalog link (free
// text) are left out and reported in `notes`; a value that cannot be computed
// stays undefined.
import type { Brewhouse } from './brewhouse';
import { ballingBeerAnalysis, hopIbu, moreyEbc } from './brewMath';
import { platoToSg } from './gravityUnits';
import type { CatalogIngredient, Range } from './ingredientCatalog';
import { resolveDilution } from './recipeWater';
import { DEFAULT_EFFICIENCY, type Recipe } from './recipes';

export interface RecipeStats {
  ogPlato?: number;
  fgPlato?: number;   // apparent, from the yeast's attenuation
  abv?: number;
  ebc?: number;
  ibu?: number;
  notes: string[];
}

// Midpoint, or the one end that is set ("min. 80.5", "max. 5").
export function rangeValue(r: Range): number {
  const [lo, hi] = r;
  return lo !== null && hi !== null ? (lo + hi) / 2 : (lo ?? hi)!;
}

// Extract (kg) of the fermentables that go into the mash or the kettle, and
// their colour rows. Priming sugar and the like (primary, bottling) do not
// count towards the OG. Unset without a linked fermentable.
export function wortExtract(recipe: Recipe, catalog: CatalogIngredient[]): {
  extractKg?: number; colors: { kg: number; ebc: number }[]; note?: string;
} {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const efficiency = (recipe.efficiencyPct ?? DEFAULT_EFFICIENCY) / 100;
  const worts = recipe.ingredients.filter(
    (i) => i.kind === 'fermentable' && (i.timing === 'mash' || i.timing === 'boil'));
  const fermentables = worts.flatMap((i) => {
    const c = i.ingredientId ? byId.get(i.ingredientId) : undefined;
    return c?.kind === 'fermentable' ? [{ kg: i.amount, c }] : [];
  });
  const note = fermentables.length < worts.length
    ? `${worts.length - fermentables.length} von ${worts.length} Vergärbaren ohne Katalogverknüpfung, nicht eingerechnet`
    : undefined;
  if (fermentables.length === 0) return { colors: [], note };
  const extractKg = fermentables.reduce((sum, { kg, c }) => {
    const moisture = c.moisturePct ? rangeValue(c.moisturePct) : 0;
    const asIs = (rangeValue(c.extractDryPct) / 100) * (1 - moisture / 100);
    // Only mashed grain is held back by the brewhouse efficiency.
    const mashed = c.type === 'malt' || c.type === 'raw-grain';
    return sum + kg * asIs * (mashed ? efficiency : 1);
  }, 0);
  return { extractKg, colors: fermentables.map(({ kg, c }) => ({ kg, ebc: rangeValue(c.colorEbc) })), note };
}

// `bh` is the recipe's brewhouse; it only matters for a dilution in the fermenter.
export function calcStats(recipe: Recipe, catalog: CatalogIngredient[], bh?: Brewhouse): RecipeStats {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const find = (ingredientId?: string) => (ingredientId ? byId.get(ingredientId) : undefined);
  const volumeL = recipe.volumeL;
  const notes: string[] = [];
  const stats: RecipeStats = { notes };

  // Gravity and colour after a planned dilution: in the kettle the knock-out
  // already includes it, in the fermenter it thins the wort that arrives.
  const { extractKg, colors, note } = wortExtract(recipe, catalog);
  if (note) notes.push(note);
  const dilution = resolveDilution(recipe, extractKg, bh);
  notes.push(...dilution.notes);
  if (extractKg !== undefined && volumeL > 0) {
    stats.ogPlato = dilution.finalPlato;
    stats.ebc = moreyEbc(colors, volumeL) * (dilution.at === 'fermenter' ? dilution.factor : 1);
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
      notes.push('Bittere braucht die Stammwürze (Vergärbares verknüpfen)');
    } else {
      const { durationMin, whirlpoolTempC, whirlpoolMin } = recipe.boil;
      const sg = platoToSg(dilution.kettlePlato!);
      stats.ibu = dilution.factor * bitter.reduce((sum, { i, c }) => {
        const boilMin = i.timing === 'whirlpool' ? 0 : i.timing === 'firstWort' ? durationMin : (i.timeMin ?? durationMin);
        return sum + hopIbu({
          alphaPct: rangeValue(c.alphaPct), grams: i.amount, volumeL: dilution.kettleL, sg,
          boilMin, whirlpoolTempC, whirlpoolMin,
        });
      }, 0);
    }
  }
  return stats;
}
