// Stock lots ("Lagerposten") in the calculations. Pure, like recipeStats.ts.
// A recipe row linked to a lot (Ingredient.stockLotId) computes with the lot's
// values: its ingredient with the lot's overrides laid on top.
import type { CatalogIngredient, StockLot } from './ingredientCatalog';
import { HOP_FORMS, type HopForm, type Ingredient } from './recipes';

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
type LotEntry = CatalogIngredient & { lotId?: string; lotForm?: string };

// The ingredients followed by one effective entry per lot whose ingredient exists.
export function withLotEntries(ingredients: CatalogIngredient[], stock: StockLot[]): CatalogIngredient[] {
  const byId = new Map(ingredients.map((c) => [c.id, c]));
  const lots = stock.flatMap((lot): LotEntry[] => {
    const base = byId.get(lot.ref);
    return base ? [{ ...effectiveIngredient(base, lot), lotId: lot.id, lotForm: lot.form }] : [];
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

// The form of a hop row: its own, else its lot's, else T90 (assumption).
export function hopFormOf(i: Pick<Ingredient, 'form' | 'ingredientId' | 'stockLotId'>, entries: CatalogIngredient[] | null): HopForm {
  return i.form ?? lotFormOf(i, entries) ?? 't90';
}

// The form the row's stock lot states, if it is a known one.
export function lotFormOf(i: Pick<Ingredient, 'ingredientId' | 'stockLotId'>, entries: CatalogIngredient[] | null): HopForm | undefined {
  const form = i.stockLotId ? (entryOf(i, entries) as LotEntry | undefined)?.lotForm : undefined;
  return HOP_FORMS.some((f) => f.value === form) ? (form as HopForm) : undefined;
}
