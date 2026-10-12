// "Brautag starten": what a brew copies and takes from stock (brews.ts).
import type { Booking, Brew, Frozen } from './brews';
import type { CatalogIngredient, StockLot } from './ingredientCatalog';
import { unitOfEntry, type Catalog } from './ingredientSource';
import type { Recipe } from './recipes';
import { entryOf } from './stockLots';

const TEXT_FIELDS = ['notes', 'flavors', 'source', 'productUrl', 'substitutes'] as const;

// The entries the recipe's rows compute with, each once, without descriptive texts.
export function freezeEntries(recipe: Pick<Recipe, 'ingredients'>, entries: CatalogIngredient[]): CatalogIngredient[] {
  const out: CatalogIngredient[] = [];
  for (const row of recipe.ingredients) {
    const e = entryOf(row, entries);
    if (!e || out.some((o) => o.id === e.id && lotIdOf(o) === lotIdOf(e))) continue;
    const copy: Record<string, unknown> = { ...e };
    for (const k of TEXT_FIELDS) delete copy[k];
    out.push(copy as unknown as CatalogIngredient);
  }
  return out;
}

const lotIdOf = (e: CatalogIngredient) => (e as { lotId?: string }).lotId;

export interface StockLine {
  lotId: string;
  name: string;           // the ingredient's
  lot?: StockLot;         // unset = the lot is gone
  entry?: CatalogIngredient;
  amount: number;         // what the recipe uses, summed over its rows
  unit: string;
  short: boolean;         // the stock does not cover it
}

// One line per stock lot the recipe's rows point to.
export function stockPlan(recipe: Pick<Recipe, 'ingredients'>, catalog: Pick<Catalog, 'stock' | 'ingredients'>): StockLine[] {
  const lines: StockLine[] = [];
  for (const row of recipe.ingredients) {
    if (!row.stockLotId) continue;
    const known = lines.find((l) => l.lotId === row.stockLotId);
    if (known) { known.amount = round3(known.amount + row.amount); continue; }
    const lot = catalog.stock.find((l) => l.id === row.stockLotId);
    const entry = catalog.ingredients.find((c) => c.id === (lot?.ref ?? row.ingredientId));
    lines.push({
      lotId: row.stockLotId, name: entry?.name ?? row.name, lot, entry,
      amount: row.amount, unit: unitOfEntry(row.kind, entry), short: false,
    });
  }
  for (const l of lines) l.short = !!l.lot && l.lot.amount < l.amount;
  return lines;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Takes `amount` from the lot, down to 0 at most; `taken` is what really went,
// so giving it back restores the lot exactly.
export function bookStock(lot: StockLot, amount: number): { lot: StockLot; taken: number } {
  const taken = round3(Math.min(Math.max(lot.amount, 0), amount));
  return { lot: { ...lot, amount: round3(lot.amount - taken) }, taken };
}

export function unbookStock(lot: StockLot, taken: number): StockLot {
  return { ...lot, amount: round3(lot.amount + taken) };
}

// Brings what a lot gave to the brew (`booked`) to `target`: takes more, down
// to 0 at most, or gives back. `booked` comes back as what the brew now holds.
export function rebook(lot: StockLot, booked: number, target: number): { lot: StockLot; booked: number } {
  const diff = round3(Math.max(target, 0) - booked);
  if (diff >= 0) {
    const { lot: next, taken } = bookStock(lot, diff);
    return { lot: next, booked: round3(booked + taken) };
  }
  return { lot: unbookStock(lot, -diff), booked: round3(booked + diff) };
}

// What the brew uses of a lot: per row the amount used, else the recipe's.
export function lotTarget(recipe: Pick<Recipe, 'ingredients'>, rowAmounts: Record<string, number> | undefined, lotId: string): number {
  return round3(recipe.ingredients
    .filter((i) => i.stockLotId === lotId)
    .reduce((s, i) => s + (rowAmounts?.[i.id] ?? i.amount), 0));
}

export function withBooking(booked: Booking[] | undefined, lotId: string, amount: number): Booking[] {
  return [...(booked ?? []).filter((b) => b.lotId !== lotId), { lotId, amount }];
}

export function startBrew(brew: Brew, frozen: Frozen, booked: Booking[], now = Date.now()): Brew {
  return { ...brew, status: 'active', startedAt: now, frozen, booked, brewhouseId: frozen.brewhouse?.id ?? brew.brewhouseId };
}

