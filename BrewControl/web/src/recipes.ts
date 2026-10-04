// Recipe model + store. Recipes live on the device's SD card behind /api/recipes
// (SD boards only); the functions at the bottom are the only persistence surface.

import { failed } from './api';

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

// What the list shows; GET /api/recipes returns only these fields.
export type RecipeSummary = Pick<Recipe, 'id' | 'name' | 'style' | 'volumeL' | 'status' | 'updatedAt'>;

const BASE = '/api/recipes';
const urlOf = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

async function fetchList(): Promise<RecipeSummary[]> {
  const r = await fetch(BASE);
  if (!r.ok) await failed(r);
  return (await r.json()) as RecipeSummary[];
}

async function put(r: Recipe): Promise<void> {
  const res = await fetch(urlOf(r.id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(r),
  });
  if (!res.ok) await failed(res);
}

// Before the SD storage, recipes lived in this browser's localStorage. Uploads
// the ones the device does not have yet (the device wins on a clash) and drops
// the local copy only when every upload worked, so a failure can be retried.
const LOCAL_KEY = 'bc.recipes';

export async function importLocalRecipes(): Promise<void> {
  let local: Recipe[];
  try {
    local = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as Recipe[];
  } catch { return; }
  if (!Array.isArray(local) || local.length === 0) return;
  const known = new Set((await fetchList()).map((r) => r.id));
  for (const r of local) if (!known.has(r.id)) await put(r);
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* storage blocked */ }
}

export async function listRecipes(): Promise<RecipeSummary[]> {
  return (await fetchList()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const r = await fetch(urlOf(id));
  if (r.status === 404) return null;
  if (!r.ok) await failed(r);
  return (await r.json()) as Recipe;
}

export async function saveRecipe(r: Recipe): Promise<Recipe> {
  const saved = { ...r, updatedAt: Date.now() };
  await put(saved);
  return saved;
}

export async function deleteRecipe(id: string): Promise<void> {
  const r = await fetch(urlOf(id), { method: 'DELETE' });
  if (!r.ok) await failed(r);
}
