// Compares the recipe's key figures with the ranges of a BJCP style. Pure.
import { EBC_PER_SRM } from './brewMath';
import { sgToPlato } from './gravityUnits';
import type { RecipeStats } from './recipeStats';
import type { BjcpStyle, Span } from './styleSource';

export type StyleStatus = 'in' | 'below' | 'above' | 'unknown';

export interface StyleRow {
  key: 'og' | 'fg' | 'abv' | 'ibu' | 'ebc';
  label: string;
  unit: string;
  digits: number;
  min: number;
  max: number;
  value?: number;
  status: StyleStatus;
  delta: number;      // distance outside the range, 0 when inside or unknown
}

export interface StyleComparison {
  rows: StyleRow[];
  inCount: number;
  knownCount: number;
}

// The BJCP prints OG/FG in SG and colour in SRM; the app shows °P and EBC.
const plato = (sg: Span): Span => [sgToPlato(sg[0]), sgToPlato(sg[1])];
const ebc = (srm: Span): Span => [srm[0] * EBC_PER_SRM, srm[1] * EBC_PER_SRM];

export function compareToStyle(stats: RecipeStats, style: BjcpStyle): StyleComparison {
  const defs: [StyleRow['key'], string, string, number, Span, number | undefined][] = [
    ['og', 'Stammwürze', '°P', 1, plato(style.og), stats.ogPlato],
    ['fg', 'Restextrakt', '°P', 1, plato(style.fg), stats.fgPlato],
    ['abv', 'Alkohol', '% vol', 1, style.abv, stats.abv],
    ['ibu', 'Bittere', 'IBU', 0, style.ibu, stats.ibu],
    ['ebc', 'Farbe', 'EBC', 0, ebc(style.srm), stats.ebc],
  ];
  const rows = defs.map(([key, label, unit, digits, [min, max], value]): StyleRow => {
    if (value === undefined) return { key, label, unit, digits, min, max, status: 'unknown', delta: 0 };
    if (value < min) return { key, label, unit, digits, min, max, value, status: 'below', delta: min - value };
    if (value > max) return { key, label, unit, digits, min, max, value, status: 'above', delta: value - max };
    return { key, label, unit, digits, min, max, value, status: 'in', delta: 0 };
  });
  return {
    rows,
    inCount: rows.filter((r) => r.status === 'in').length,
    knownCount: rows.filter((r) => r.status !== 'unknown').length,
  };
}
