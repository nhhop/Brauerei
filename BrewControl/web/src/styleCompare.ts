// Compares the recipe's key figures with the ranges of a beer style. Pure.
import type { RecipeStats } from './recipeStats';
import type { BeerStyle, Span } from './styleSource';

export type StyleStatus = 'in' | 'below' | 'above' | 'unknown';

export interface StyleRow {
  key: 'og' | 'fg' | 'abv' | 'ibu' | 'ebc';
  label: string;
  unit: string;
  digits: number;
  min?: number;       // unset when the style has no range for this figure
  max?: number;
  value?: number;
  status: StyleStatus;
  delta: number;      // distance outside the range, 0 when inside or unknown
}

export interface StyleComparison {
  rows: StyleRow[];
  inCount: number;
  knownCount: number;
}

export const STYLE_FIGURES: { key: StyleRow['key']; label: string; unit: string; digits: number }[] = [
  { key: 'og', label: 'Stammwürze', unit: '°P', digits: 1 },
  { key: 'fg', label: 'Restextrakt', unit: '°P', digits: 1 },
  { key: 'abv', label: 'Alkohol', unit: '% vol', digits: 1 },
  { key: 'ibu', label: 'Bittere', unit: 'IBU', digits: 0 },
  { key: 'ebc', label: 'Farbe', unit: 'EBC', digits: 0 },
];

const VALUE: Record<StyleRow['key'], (s: RecipeStats) => number | undefined> = {
  og: (s) => s.ogPlato, fg: (s) => s.fgPlato, abv: (s) => s.abv, ibu: (s) => s.ibu, ebc: (s) => s.ebc,
};

// A figure is unknown when the recipe has no value or the style no range.
export function compareToStyle(stats: RecipeStats, style: BeerStyle): StyleComparison {
  const rows = STYLE_FIGURES.map(({ key, label, unit, digits }): StyleRow => {
    const range: Span | undefined = style[key];
    const value = VALUE[key](stats);
    const base = { key, label, unit, digits, min: range?.[0], max: range?.[1], value };
    if (!range || value === undefined) return { ...base, status: 'unknown', delta: 0 };
    const [min, max] = range;
    if (value < min) return { ...base, status: 'below', delta: min - value };
    if (value > max) return { ...base, status: 'above', delta: value - max };
    return { ...base, status: 'in', delta: 0 };
  });
  return {
    rows,
    inCount: rows.filter((r) => r.status === 'in').length,
    knownCount: rows.filter((r) => r.status !== 'unknown').length,
  };
}

// Styles ordered by how well the recipe fits: most figures inside first, then
// the smallest distance outside, each measured in widths of its range. Stable,
// so equal fits keep the order they came in.
export function rankStyles(stats: RecipeStats, styles: BeerStyle[]): { style: BeerStyle; cmp: StyleComparison }[] {
  const miss = (c: StyleComparison) =>
    c.rows.reduce((sum, r) => sum + (r.delta > 0 ? r.delta / Math.max(r.max! - r.min!, 1e-6) : 0), 0);
  return styles
    .map((style) => ({ style, cmp: compareToStyle(stats, style) }))
    .map((x) => ({ ...x, miss: miss(x.cmp) }))
    .sort((a, b) => b.cmp.inCount - a.cmp.inCount || a.miss - b.miss)
    .map(({ style, cmp }) => ({ style, cmp }));
}
