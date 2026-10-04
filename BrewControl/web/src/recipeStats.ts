// Recipe key figures (Kennwerte) from the linked catalog ingredients. Pure, so
// it can later run unchanged on a server. Rows without a catalog link (free
// text) are left out and reported in `notes`; a value that cannot be computed
// stays undefined.
import { ballingBeerAnalysis, hopIbu, moreyEbc, platoFromExtract } from './brewMath';
import { platoToSg } from './gravityUnits';
import type { CatalogIngredient, Range } from './ingredientCatalog';
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

export function calcStats(recipe: Recipe, catalog: CatalogIngredient[]): RecipeStats {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const find = (ingredientId?: string) => (ingredientId ? byId.get(ingredientId) : undefined);
  const efficiency = (recipe.efficiencyPct ?? DEFAULT_EFFICIENCY) / 100;
  const volumeL = recipe.volumeL;
  const notes: string[] = [];
  const stats: RecipeStats = { notes };

  // Gravity and colour: fermentables that go into the mash or the kettle.
  // Priming sugar and the like (primary, bottling) do not count towards the OG.
  const worts = recipe.ingredients.filter(
    (i) => i.kind === 'fermentable' && (i.timing === 'mash' || i.timing === 'boil'));
  const fermentables = worts.flatMap((i) => {
    const c = find(i.ingredientId);
    return c?.kind === 'fermentable' ? [{ kg: i.amount, c }] : [];
  });
  if (fermentables.length < worts.length) {
    notes.push(`${worts.length - fermentables.length} von ${worts.length} Vergärbaren ohne Katalogverknüpfung, nicht eingerechnet`);
  }
  if (fermentables.length > 0 && volumeL > 0) {
    const extractKg = fermentables.reduce((sum, { kg, c }) => {
      const moisture = c.moisturePct ? rangeValue(c.moisturePct) : 0;
      const asIs = (rangeValue(c.extractDryPct) / 100) * (1 - moisture / 100);
      // Only mashed grain is held back by the brewhouse efficiency.
      const mashed = c.type === 'malt' || c.type === 'raw-grain';
      return sum + kg * asIs * (mashed ? efficiency : 1);
    }, 0);
    stats.ogPlato = platoFromExtract(extractKg, volumeL);
    stats.ebc = moreyEbc(fermentables.map(({ kg, c }) => ({ kg, ebc: rangeValue(c.colorEbc) })), volumeL);
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
  // volume are approximated by OG and the batch volume.
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
      stats.ibu = bitter.reduce((sum, { i, c }) => {
        const boilMin = i.timing === 'whirlpool' ? 0 : i.timing === 'firstWort' ? durationMin : (i.timeMin ?? durationMin);
        return sum + hopIbu({
          alphaPct: rangeValue(c.alphaPct), grams: i.amount, volumeL, sg: platoToSg(stats.ogPlato!),
          boilMin, whirlpoolTempC, whirlpoolMin,
        });
      }, 0);
    }
  }
  return stats;
}
