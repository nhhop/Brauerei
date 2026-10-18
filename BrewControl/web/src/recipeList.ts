import type { Brewery, Brewhouse } from './brewhouse';
import { brewsOfRoot, type BrewSummary } from './brews';
import type { CatalogIngredient } from './ingredientCatalog';
import { atKnockOut, calcStats } from './recipeStats';
import { rootOf, type ListFigures, type Recipe, type RecipeSummary } from './recipes';

// The figures the recipe list shows, as the recipe tab "Übersicht" computes them
// (at knock-out). Stored with the recipe on saving, so the list needs no catalog.
export function listFigures(recipe: Recipe, entries: CatalogIngredient[], bh?: Brewhouse, brewery?: Brewery | null): ListFigures {
  const s = calcStats(atKnockOut(recipe, bh, entries, brewery), entries, bh, brewery);
  return { ogPlato: s.ogPlato, abvPct: s.abv, ibu: s.ibu, ebc: s.ebc };
}

// Beer colour swatch for an EBC value: linear between anchor colours, text
// colour picked for contrast.
const EBC_ANCHORS: [number, [number, number, number]][] = [
  [4, [248, 231, 112]], [8, [240, 208, 100]], [14, [217, 160, 50]], [22, [181, 101, 29]],
  [40, [124, 58, 14]], [80, [43, 22, 8]],
];

export function ebcSwatch(ebc: number): { bg: string; fg: string } {
  const a = EBC_ANCHORS;
  let rgb = a[a.length - 1][1];
  if (ebc <= a[0][0]) rgb = a[0][1];
  else for (let i = 1; i < a.length; i++) {
    if (ebc <= a[i][0]) {
      const t = (ebc - a[i - 1][0]) / (a[i][0] - a[i - 1][0]);
      rgb = a[i - 1][1].map((c, k) => Math.round(c + (a[i][1][k] - c) * t)) as [number, number, number];
      break;
    }
  }
  const luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return { bg: `rgb(${rgb.join(',')})`, fg: luma > 140 ? '#1a1a1a' : '#ffffff' };
}

export interface RecipeRow {
  versions: RecipeSummary[];   // oldest first
  latest: RecipeSummary;
  brewCount: number;           // brews of any version
  lastBrewed?: string;         // newest brewDate (ISO date) of those
}

export function recipeRows(groups: RecipeSummary[][], brews: BrewSummary[] | null): RecipeRow[] {
  return groups.map((versions) => {
    const mine = brews ? brewsOfRoot(brews, rootOf(versions[0])) : [];
    const dates = mine.map((b) => b.brewDate).filter((d): d is string => !!d).sort();
    return { versions, latest: versions[versions.length - 1], brewCount: mine.length, lastBrewed: dates[dates.length - 1] };
  });
}

export function filterRows(rows: RecipeRow[], query: string): RecipeRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(({ latest }) => `${latest.name} ${latest.style}`.toLowerCase().includes(q));
}

export type SortKey = 'name' | 'og' | 'abv' | 'ibu' | 'ebc' | 'brews' | 'last';

export const SORT_LABEL: Record<SortKey, string> = {
  name: 'Name', og: 'Stammwürze', abv: 'Alkohol', ibu: 'IBU', ebc: 'EBC', brews: 'Sude', last: 'Zuletzt gebraut',
};

const numberOf = (r: RecipeRow, key: SortKey): number | string | undefined => {
  switch (key) {
    case 'name': return (r.latest.name || '').toLowerCase();
    case 'og': return r.latest.ogPlato;
    case 'abv': return r.latest.abvPct;
    case 'ibu': return r.latest.ibu;
    case 'ebc': return r.latest.ebc;
    case 'brews': return r.brewCount;
    case 'last': return r.lastBrewed;
  }
};

// Name ascending, everything else descending (highest, newest first); rows
// without a value come last.
export function sortRows(rows: RecipeRow[], key: SortKey): RecipeRow[] {
  const dir = key === 'name' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = numberOf(a, key), y = numberOf(b, key);
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1;
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}
