// Stock lots ("Lagerposten") in the calculations. Pure, like recipeStats.ts.
// A recipe row linked to a lot (Ingredient.stockLotId) computes with the lot's
// values: its ingredient with the lot's overrides laid on top.
import type { CatalogIngredient, StockLot } from './ingredientCatalog';
import type { Ingredient } from './recipes';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Nested groups (oilComposition, thiols, …) merge one level deep, so
// overriding one oil keeps the others.
export function effectiveIngredient(base: CatalogIngredient, lot: StockLot): CatalogIngredient {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(lot.overrides ?? {})) {
    if (v === undefined) continue;
    out[k] = isObject(v) && isObject(out[k]) ? { ...out[k], ...v } : v;
  }
  return out as unknown as CatalogIngredient;
}

// A lot's effective entry keeps the ingredient's id, so whatever looks an id
// up without knowing about lots still finds the plain entry, which comes first.
type LotEntry = CatalogIngredient & { lotId?: string };

// The ingredients followed by one effective entry per lot whose ingredient exists.
export function withLotEntries(ingredients: CatalogIngredient[], stock: StockLot[]): CatalogIngredient[] {
  const byId = new Map(ingredients.map((c) => [c.id, c]));
  const lots = stock.flatMap((lot): LotEntry[] => {
    const base = byId.get(lot.ref);
    return base ? [{ ...effectiveIngredient(base, lot), lotId: lot.id }] : [];
  });
  return [...ingredients, ...lots];
}

// The entry a recipe row computes with: its lot's while the lot exists, else
// the plain catalog or own entry. `entries` comes from withLotEntries.
export function entryOf(
  i: Pick<Ingredient, 'ingredientId' | 'stockLotId'>, entries: CatalogIngredient[] | null,
): CatalogIngredient | undefined {
  if (!i.ingredientId || !entries) return undefined;
  const all = entries as LotEntry[];
  const lot = i.stockLotId ? all.find((e) => e.lotId === i.stockLotId && e.id === i.ingredientId) : undefined;
  return lot ?? all.find((e) => e.id === i.ingredientId && !e.lotId);
}
