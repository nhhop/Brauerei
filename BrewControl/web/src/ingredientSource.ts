// Ingredient catalog access. The catalog is a static, versioned JSON file today;
// `loadCatalog` is the only place that knows where it comes from, so a real
// backend can replace the URL (or the function) without touching the pages.
import { useEffect, useState } from 'preact/hooks';
import type { CatalogIngredient, Vocabulary } from './ingredientCatalog';
import type { IngredientKind } from './recipes';

export interface Catalog {
  version: string;
  vocab: Vocabulary;
  ingredients: CatalogIngredient[];
}

const CATALOG_URL = '/modules/recipes/zutaten-datenblaetter.json';
const USER_KEY = 'bc.userIngredients';

// Recipe kinds use "yeast", the catalog "culture".
const CATALOG_KIND: Record<IngredientKind, CatalogIngredient['kind']> = {
  fermentable: 'fermentable', hop: 'hop', yeast: 'culture', aroma: 'aroma', auxiliary: 'auxiliary',
};

// User ingredients are stored apart from the catalog (ids "user:…").
function readUserIngredients(): CatalogIngredient[] {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as CatalogIngredient[]) : [];
  } catch { return []; }
}

// Case-insensitive match on name or manufacturer, prefix matches first.
export function findIngredients(
  all: CatalogIngredient[], kind: IngredientKind, query: string, limit = 8,
): CatalogIngredient[] {
  const q = query.trim().toLowerCase();
  const ofKind = all.filter((i) => i.kind === CATALOG_KIND[kind]);
  if (!q) return ofKind.slice(0, limit);
  const hits = ofKind.filter((i) => `${i.name} ${i.manufacturer ?? ''}`.toLowerCase().includes(q));
  const starts = (i: CatalogIngredient) => (i.name.toLowerCase().startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b)).slice(0, limit);
}

let cached: Promise<Catalog> | null = null;
let loaded: Catalog | null = null; // lets a remounting component start with the catalog instead of null

export function loadCatalog(): Promise<Catalog> {
  cached ??= fetch(CATALOG_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((d) => ({
      version: d.catalogVersion as string,
      vocab: d.vocab as Vocabulary,
      ingredients: [...(d.catalog as CatalogIngredient[]), ...readUserIngredients()],
    }))
    .then((c) => (loaded = c))
    .catch((e) => { cached = null; throw e; });
  return cached;
}

// `catalog` stays null while loading or if the file is missing; the pickers then
// fall back to free text, so a recipe never depends on the catalog being there.
export function useCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(loaded);
  useEffect(() => {
    let live = true;
    loadCatalog().then((c) => { if (live) setCatalog(c); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return catalog;
}
