// Ingredient catalog access. The catalog is a static, versioned JSON file today;
// `loadCatalog` is the only place that knows where it comes from, so a real
// backend can replace the URL (or the function) without touching the pages.
// The user's own ingredients and stock lots live on the device's SD card
// (/api/ingredients, /api/stock) and are merged in here.
import { useEffect, useState } from 'preact/hooks';
import { failed } from './api';
import type { CatalogIngredient, StockLot, Vocabulary } from './ingredientCatalog';
import { withLotEntries } from './stockLots';
import { VALID_ID, unitOf, type IngredientKind } from './recipes';

export interface Catalog {
  version: string;
  vocab: Vocabulary;
  ingredients: CatalogIngredient[]; // catalog + own
  stock: StockLot[];
  // `ingredients` plus one effective entry per stock lot; what the
  // calculations look recipe rows up in, via entryOf.
  entries: CatalogIngredient[];
  storeFailed: boolean;             // own ingredients or stock did not load
}

const CATALOG_URL = '/modules/recipes/zutaten-datenblaetter.json';

// Recipe kinds use "yeast", the catalog "culture".
export const CATALOG_KIND: Record<IngredientKind, CatalogIngredient['kind']> = {
  fermentable: 'fermentable', hop: 'hop', yeast: 'culture', aroma: 'aroma', auxiliary: 'auxiliary',
};

export function recipeKindOf(kind: CatalogIngredient['kind']): IngredientKind {
  return kind === 'culture' ? 'yeast' : kind;
}

// Unit of an amount of this entry, in a recipe row and in stock: auxiliaries
// measure in their own unit (acids in ml), everything else by kind.
export function unitOfEntry(kind: IngredientKind, entry?: CatalogIngredient): string {
  return entry?.kind === 'auxiliary' ? entry.defaultUnit : unitOf(kind);
}

// Case-insensitive match on name or manufacturer, prefix matches first.
// `only` narrows the kind further (water agents among the auxiliaries).
export function findIngredients(
  all: CatalogIngredient[], kind: IngredientKind, query: string, limit = 8,
  only?: (c: CatalogIngredient) => boolean,
): CatalogIngredient[] {
  const q = query.trim().toLowerCase();
  const ofKind = all.filter((i) => i.kind === CATALOG_KIND[kind] && (!only || only(i)));
  if (!q) return ofKind.slice(0, limit);
  const hits = ofKind.filter((i) => `${i.name} ${i.manufacturer ?? ''}`.toLowerCase().includes(q));
  const starts = (i: CatalogIngredient) => (i.name.toLowerCase().startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b)).slice(0, limit);
}

// Lots of `kind` whose ingredient matches `query` (same rule as findIngredients),
// each with its ingredient.
export function findLots(catalog: Catalog, kind: IngredientKind, query: string,
  only?: (c: CatalogIngredient) => boolean): { lot: StockLot; entry: CatalogIngredient }[] {
  const matches = new Set(findIngredients(catalog.ingredients, kind, query, Infinity, only));
  return catalog.stock.flatMap((lot) => {
    const entry = catalog.ingredients.find((c) => c.id === lot.ref);
    return entry && matches.has(entry) ? [{ lot, entry }] : [];
  });
}

// "2025 · 250 g": what tells the lots of one ingredient apart.
export function lotSummary(lot: StockLot, entry: CatalogIngredient): string {
  const amount = `${String(lot.amount).replace('.', ',')} ${unitOfEntry(recipeKindOf(entry.kind), entry)}`;
  return [lot.cropYear, amount].filter(Boolean).join(' · ');
}

// ── Device storage ──────────────────────────────────────────────────────────────

const USER_URL = '/api/ingredients';
const STOCK_URL = '/api/stock';

async function list<T>(url: string): Promise<T[]> {
  const r = await fetch(url);
  if (!r.ok) await failed(r);
  return (await r.json()) as T[];
}

async function put(url: string, doc: { id: string }): Promise<void> {
  if (!VALID_ID.test(doc.id)) throw new Error('ungültige ID');
  const r = await fetch(`${url}/${encodeURIComponent(doc.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
  if (!r.ok) await failed(r);
}

async function remove(url: string, id: string): Promise<void> {
  const r = await fetch(`${url}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) await failed(r);
}

// Own ingredients have ids "user-…": the id becomes a file name, so no colon.
export const saveUserIngredient = (c: CatalogIngredient) => put(USER_URL, c);
export const deleteUserIngredient = (id: string) => remove(USER_URL, id);
export const saveStockLot = (lot: StockLot) => put(STOCK_URL, lot);
export const deleteStockLot = (id: string) => remove(STOCK_URL, id);

// ── Loading ─────────────────────────────────────────────────────────────────────

let cached: Promise<Catalog> | null = null;
let loaded: Catalog | null = null; // lets a remounting component start with the catalog instead of null
const listeners = new Set<(c: Catalog) => void>();

// Own ingredients and stock are optional: without them the catalog still works.
function loadOwn() {
  return Promise.all([list<CatalogIngredient>(USER_URL), list<StockLot>(STOCK_URL)])
    .then(([user, stock]) => ({ user, stock, storeFailed: false }))
    .catch(() => ({ user: [] as CatalogIngredient[], stock: [] as StockLot[], storeFailed: true }));
}

export function loadCatalog(): Promise<Catalog> {
  cached ??= Promise.all([
    fetch(CATALOG_URL).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    loadOwn(),
  ])
    .then(([d, { user, stock, storeFailed }]) => {
      const ingredients = [...(d.catalog as CatalogIngredient[]), ...user];
      return {
        version: d.catalogVersion as string,
        vocab: d.vocab as Vocabulary,
        ingredients, stock, storeFailed,
        entries: withLotEntries(ingredients, stock),
      };
    })
    .then((c) => (loaded = c))
    .catch((e) => { cached = null; throw e; });
  return cached;
}

// After own ingredients or stock changed: loads again and hands the result to
// every mounted useCatalog.
export async function reloadCatalog(): Promise<Catalog> {
  cached = null;
  const c = await loadCatalog();
  for (const l of listeners) l(c);
  return c;
}

// `catalog` stays null while loading or if the file is missing; the pickers then
// fall back to free text, so a recipe never depends on the catalog being there.
export function useCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(loaded);
  useEffect(() => {
    let live = true;
    const update = (c: Catalog) => { if (live) setCatalog(c); };
    listeners.add(update);
    loadCatalog().then(update).catch(() => {});
    return () => { live = false; listeners.delete(update); };
  }, []);
  return catalog;
}
