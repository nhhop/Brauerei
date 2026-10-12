// Brews ("Sude") + store; the start (copies, stock) is in brewStart.ts, so the
// backup page can load this file without the ingredient catalog code.
// A brew points to the recipe version it is made from.
// Until it starts it computes with today's brewhouse, brewery, fermenter and
// ingredients; "Brautag starten" copies them into `frozen` and takes the linked
// stock lots' amounts from stock (`booked`). Brews live on the device's SD card
// behind /api/brews, with an index like the recipes (RecipeFiles.h).
import { failed } from './api';
import type { Brewery, Brewhouse } from './brewhouse';
import type { Fermenter } from './cellar';
import { importBundle, makeBundle, type BundleKind } from './docBundle';
import type { CatalogIngredient } from './ingredientCatalog';
import { VALID_ID, rootOf, uid, versionOf, type Recipe } from './recipes';

export type BrewStatus = 'planned' | 'active' | 'done';

export const STATUS_LABEL: Record<BrewStatus, string> = { planned: 'Geplant', active: 'Läuft', done: 'Abgeschlossen' };

// The tabs of a brew; their content follows with 5b (brew day) and 5c.
export const PHASES = [
  { id: 'prep', label: 'Vorbereitung' },
  { id: 'mash', label: 'Maischen' },
  { id: 'boil', label: 'Würzekochen' },
  { id: 'fermentation', label: 'Gärung' },
  { id: 'maturation', label: 'Reifung' },
  { id: 'bottling', label: 'Abfüllung' },
] as const;

export interface Frozen {
  brewhouse?: Brewhouse;
  brewery: Brewery;
  fermenter?: Fermenter;
  // The entries the recipe rows hit (entryOf), a stock lot's with its values;
  // without descriptive texts. entryOf works on this list as on Catalog.entries.
  entries: CatalogIngredient[];
}

export interface Booking { lotId: string; amount: number }  // what was taken, in the lot's unit

export interface Brew {
  id: string;
  number: number;            // running number of the site
  name: string;
  recipeId: string;          // the recipe version
  rootId: string;            // its version 1, to group brews by recipe
  version: number;
  status: BrewStatus;
  updatedAt: number;
  brewDate?: string;         // ISO date
  brewhouseId?: string;      // until the start; then frozen.brewhouse
  fermenterId?: string;
  occupiedFrom?: string;     // ISO dates, the fermenter's booked period (inclusive)
  occupiedUntil?: string;
  startedAt?: number;
  frozen?: Frozen;
  booked?: Booking[];
  notes?: string;
}

// What GET /api/brews returns: the firmware's brewSummaryLine.
export type BrewSummary = Pick<Brew, 'id' | 'number' | 'name' | 'recipeId' | 'rootId' | 'version' | 'status'
  | 'brewDate' | 'fermenterId' | 'occupiedFrom' | 'occupiedUntil' | 'updatedAt'>;

// ── Dates ────────────────────────────────────────────────────────────────────────
// ISO dates (YYYY-MM-DD) compare as strings; arithmetic goes through UTC so a
// daylight saving change cannot shift a day.

export function todayIso(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

// The fermenter is booked from the brew day for the recipe's fermentation phases.
export function fermentationDays(recipe: Pick<Recipe, 'fermentation'>): number {
  return Math.ceil(recipe.fermentation.reduce((sum, p) => sum + (p.duration || 0), 0));
}

// ── Brews ────────────────────────────────────────────────────────────────────────

export function newBrew(recipe: Recipe, all: Pick<BrewSummary, 'number'>[], today = todayIso()): Brew {
  return {
    id: uid(),
    number: Math.max(0, ...all.map((b) => b.number ?? 0)) + 1,
    name: recipe.name,
    recipeId: recipe.id,
    rootId: rootOf(recipe),
    version: versionOf(recipe),
    status: 'planned',
    updatedAt: Date.now(),
    brewDate: today,
    brewhouseId: recipe.brewhouseId,
    occupiedFrom: today,
    occupiedUntil: addDays(today, fermentationDays(recipe)),
  };
}

// A new brew day moves the booked period along with it.
export function moveBrewDate(brew: Brew, date: string | undefined): Brew {
  if (!date) return { ...brew, brewDate: undefined };
  const shift = brew.brewDate ? daysBetween(brew.brewDate, date) : 0;
  return {
    ...brew,
    brewDate: date,
    occupiedFrom: brew.occupiedFrom && addDays(brew.occupiedFrom, shift),
    occupiedUntil: brew.occupiedUntil && addDays(brew.occupiedUntil, shift),
  };
}

// Other brews booking the same fermenter in an overlapping period.
export function occupancyOverlaps(brew: BrewSummary, all: BrewSummary[]): BrewSummary[] {
  const { fermenterId, occupiedFrom: from, occupiedUntil: until } = brew;
  if (!fermenterId || !from || !until) return [];
  return all.filter((b) => b.id !== brew.id && b.fermenterId === fermenterId
    && !!b.occupiedFrom && !!b.occupiedUntil && b.occupiedFrom <= until && from <= b.occupiedUntil);
}

export const brewsOfVersion = <T extends Pick<BrewSummary, 'recipeId'>>(all: T[], recipeId: string) =>
  all.filter((b) => b.recipeId === recipeId);
export const brewsOfRoot = <T extends Pick<BrewSummary, 'rootId'>>(all: T[], rootId: string) =>
  all.filter((b) => b.rootId === rootId);

// ── Store ────────────────────────────────────────────────────────────────────────

const BASE = '/api/brews';
const urlOf = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

async function fetchList(): Promise<BrewSummary[]> {
  const r = await fetch(BASE);
  if (!r.ok) await failed(r);
  return (await r.json()) as BrewSummary[];
}

async function put(b: Brew): Promise<void> {
  if (!VALID_ID.test(b.id)) throw new Error('ungültige ID');
  const res = await fetch(urlOf(b.id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  });
  if (!res.ok) await failed(res);
}

// Newest first.
export async function listBrews(): Promise<BrewSummary[]> {
  return (await fetchList()).sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
}

export async function getBrew(id: string): Promise<Brew | null> {
  const r = await fetch(urlOf(id));
  if (r.status === 404) return null;
  if (!r.ok) await failed(r);
  return (await r.json()) as Brew;
}

export async function saveBrew(b: Brew): Promise<Brew> {
  const saved = { ...b, updatedAt: Date.now() };
  await put(saved);
  return saved;
}

export async function deleteBrew(id: string): Promise<void> {
  const r = await fetch(urlOf(id), { method: 'DELETE' });
  if (!r.ok) await failed(r);
}

// ── Backup file ──────────────────────────────────────────────────────────────────
const BUNDLE: BundleKind = {
  type: 'brewcontrol-brews', key: 'brews', backup: 'Sud-Sicherung', list: 'Sudliste', one: 'Sud', many: 'Suden',
};

export async function exportBrews(): Promise<string> {
  const brews: Brew[] = [];
  for (const { id } of await fetchList()) {
    const b = await getBrew(id);
    if (b) brews.push(b);
  }
  return makeBundle(BUNDLE, brews);
}

// Same id → overwritten, updatedAt kept. Stock is not touched.
export const importBrews = (text: string, onProgress?: (done: number, total: number) => void) =>
  importBundle<Brew>(BUNDLE, text, put, onProgress);
