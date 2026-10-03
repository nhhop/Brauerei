// Recipe model + store. Phase 1 keeps recipes in localStorage; the functions at
// the bottom are the only persistence surface, so they can later move behind
// /api/recipes without touching the pages.

export type IngredientKind = 'fermentable' | 'hop' | 'yeast' | 'aroma' | 'auxiliary';

export type Timing =
  | 'mainWater' | 'mash' | 'mashPh' | 'sparge'
  | 'firstWort' | 'boil' | 'whirlpool' | 'hopBack' | 'kettleSour'
  | 'pitch' | 'dip' | 'primary' | 'maturation' | 'bottling';

export const KINDS: { id: IngredientKind; label: string; unit: string }[] = [
  { id: 'fermentable', label: 'Vergärbares', unit: 'kg' },
  { id: 'hop', label: 'Hopfen', unit: 'g' },
  { id: 'yeast', label: 'Hefen & Kulturen', unit: 'g' },
  { id: 'aroma', label: 'Aromazutaten', unit: 'g' },
  { id: 'auxiliary', label: 'Hilfsstoffe', unit: 'g' },
];

export const TIMING_LABEL: Record<Timing, string> = {
  mainWater: 'Hauptguss', mash: 'Maische', mashPh: 'Maische nach pH-Messung', sparge: 'Nachguss',
  firstWort: 'Vorderwürze', boil: 'Kochen', whirlpool: 'Whirlpool', hopBack: 'Hop Back',
  kettleSour: 'Kettle Sour', pitch: 'Anstellen', dip: 'Dip', primary: 'Hauptgärung',
  maturation: 'Reifung', bottling: 'Abfüllung',
};

// Which moments are offered per kind (rezept-sud-editor.md → "Erlaubte Zeitpunkte").
const TIMINGS: Record<IngredientKind, Timing[]> = {
  fermentable: ['mash', 'boil', 'primary', 'bottling'],
  hop: ['mash', 'firstWort', 'boil', 'whirlpool', 'hopBack', 'dip', 'primary', 'maturation'],
  yeast: ['pitch', 'maturation', 'bottling', 'kettleSour'],
  aroma: ['boil', 'whirlpool', 'primary', 'maturation'],
  auxiliary: ['mainWater', 'mash', 'mashPh', 'sparge', 'boil', 'pitch', 'maturation'],
};

// The process tabs show the same ingredient list, filtered by moment. Water
// (Hauptguss/Nachguss) has no tab yet and only appears under "Zutaten".
export type Scope = 'mash' | 'boil' | 'fermentation';
export const SCOPE_TIMINGS: Record<Scope, Timing[]> = {
  mash: ['mash', 'mashPh'],
  boil: ['firstWort', 'boil', 'whirlpool', 'hopBack', 'kettleSour'],
  fermentation: ['pitch', 'dip', 'primary', 'maturation', 'bottling'],
};

export function allowedTimings(kind: IngredientKind, scope?: Scope): Timing[] {
  const all = TIMINGS[kind];
  return scope ? all.filter((t) => SCOPE_TIMINGS[scope].includes(t)) : all;
}

// Moment a freshly added ingredient starts with: the usual one for its kind if
// the scope allows it, else the first allowed.
const DEFAULT_TIMING: Record<IngredientKind, Timing> = {
  fermentable: 'mash', hop: 'boil', yeast: 'pitch', aroma: 'boil', auxiliary: 'mash',
};

export function defaultTiming(kind: IngredientKind, scope?: Scope): Timing {
  const allowed = allowedTimings(kind, scope);
  return allowed.includes(DEFAULT_TIMING[kind]) ? DEFAULT_TIMING[kind] : allowed[0];
}

export function unitOf(kind: IngredientKind): string {
  return KINDS.find((k) => k.id === kind)!.unit;
}

export interface Ingredient {
  id: string;
  kind: IngredientKind;
  name: string;
  ingredientId?: string; // catalog/user ingredient this row points to; unset = free text
  amount: number;
  timing: Timing;
  timeMin?: number; // hops at "Kochen": minutes before the end of the boil; unset = whole boil
}

// Mash rest (duration in minutes) and fermentation phase (duration in days).
export interface Phase {
  id: string;
  name: string;
  tempC: number;
  duration: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  style: string;
  styleId?: string; // BJCP 2021 number the style text was picked from; unset = free text
  volumeL: number;
  efficiencyPct?: number; // Sudhausausbeute; unset in old recipes, read via DEFAULT_EFFICIENCY
  status: 'draft' | 'final';
  updatedAt: number;
  ingredients: Ingredient[];
  mash: Phase[];
  boil: { durationMin: number; whirlpoolTempC: number; whirlpoolMin: number };
  fermentation: Phase[];
}

export const DEFAULT_EFFICIENCY = 75;

// Plain HTTP means no crypto.randomUUID (secure contexts only).
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function newRecipe(): Recipe {
  return {
    id: uid(), name: 'Neues Rezept', description: '', style: '', volumeL: 20, efficiencyPct: DEFAULT_EFFICIENCY,
    status: 'draft', updatedAt: Date.now(),
    ingredients: [], mash: [],
    boil: { durationMin: 60, whirlpoolTempC: 80, whirlpoolMin: 15 },
    fermentation: [],
  };
}

const KEY = 'bc.recipes';

function readAll(): Recipe[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Recipe[]) : [];
  } catch { return []; }
}

function writeAll(list: Recipe[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
}

export function listRecipes(): Recipe[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getRecipe(id: string): Recipe | null {
  return readAll().find((r) => r.id === id) ?? null;
}

export function saveRecipe(r: Recipe): Recipe {
  const saved = { ...r, updatedAt: Date.now() };
  const list = readAll();
  const i = list.findIndex((x) => x.id === r.id);
  if (i >= 0) list[i] = saved; else list.push(saved);
  writeAll(list);
  return saved;
}

export function deleteRecipe(id: string) {
  writeAll(readAll().filter((r) => r.id !== id));
}
