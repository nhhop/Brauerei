// Brews ("Sude") + store; the start (copies, stock) is in brewStart.ts, so the
// backup page can load this file without the ingredient catalog code.
// A brew points to the recipe version it is made from.
// Until it starts it computes with today's brewhouse, brewery, fermenter and
// ingredients; "Brautag starten" copies them into `frozen` and takes the linked
// stock lots' amounts from stock (`booked`). Brews live on the device's SD card
// behind /api/brews, with an index like the recipes (RecipeFiles.h).
import { failed } from './api';
import type { Brewery, Brewhouse, MeasureKey } from './brewhouse';
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

export type PhaseId = (typeof PHASES)[number]['id'];

// A brew day value: the brewhouse's measurements plus the mash pH after the
// acid (5b-2) and the wort drawn off at the knock-out (5b-3). Gravities in °P.
// `src` is the sensor it was taken from.
export type MeasureId = MeasureKey | 'mashPhAcid' | 'speiseVolume' | 'dipWortVolume';
export interface Measurement { v: number; at: number; src?: string }

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
  // Brew day (5b). Saved one field at a time on a fresh copy (patchBrew).
  measurements?: Partial<Record<MeasureId, Measurement>>;
  checked?: string[];                    // ticked keys, e.g. `row:<group>`, `dose:<column>:<row id>`
  rowAmounts?: Record<string, number>;   // amount actually used per recipe row, in the row's unit
                                         // (`mashPh:<entry id>`: an acid or base the recipe does not have)
  restTemps?: Record<string, Measurement>;  // temperature measured per mash step id
  mashProgramId?: string;                // the rest timer on the device (brewPrograms.ts)
  boilProgramId?: string;                // the boil timer with its additions
  addedAt?: Record<string, number>;      // when a boil addition went in, per recipe row id
  phaseNotes?: Partial<Record<PhaseId, string>>;
  logId?: string;                        // the device log the mash course is drawn from
  phaseStartedAt?: Partial<Record<PhaseId, number>>;  // epoch ms; mash: when the grain went in
  // Results for the list (brewDay.withResults), set whenever the brew is saved.
  ogPlato?: number;          // gravity after the boil: target
  ogActual?: number;         // ... and measured
  mashEffPct?: number;       // measured
  yieldPct?: number;
  bottledL?: number;         // 5c
}

// What GET /api/brews returns: the firmware's brewSummaryLine.
export type BrewSummary = Pick<Brew, 'id' | 'number' | 'name' | 'recipeId' | 'rootId' | 'version' | 'status'
  | 'brewDate' | 'fermenterId' | 'occupiedFrom' | 'occupiedUntil' | 'updatedAt'
  | 'ogPlato' | 'ogActual' | 'mashEffPct' | 'yieldPct' | 'bottledL'>;

export const SUMMARY_FIELDS = [
  'id', 'number', 'name', 'recipeId', 'rootId', 'version', 'status', 'brewDate', 'fermenterId', 'occupiedFrom',
  'occupiedUntil', 'updatedAt', 'ogPlato', 'ogActual', 'mashEffPct', 'yieldPct', 'bottledL',
] as const satisfies readonly (keyof BrewSummary)[];

export const summaryOf = (b: Brew): BrewSummary =>
  Object.fromEntries(SUMMARY_FIELDS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]])) as unknown as BrewSummary;

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

// ── Brew day edits ──────────────────────────────────────────────────────────────
// Each sets one field, so two devices editing different fields keep both.

export function setMeasurement(b: Brew, key: MeasureId, m: Measurement | undefined): Brew {
  const measurements = { ...b.measurements };
  if (m) measurements[key] = m; else delete measurements[key];
  return { ...b, measurements };
}

export function setRestTemp(b: Brew, stepId: string, m: Measurement | undefined): Brew {
  const restTemps = { ...b.restTemps };
  if (m) restTemps[stepId] = m; else delete restTemps[stepId];
  return { ...b, restTemps };
}

export function setChecked(b: Brew, key: string, on: boolean): Brew {
  const rest = (b.checked ?? []).filter((k) => k !== key);
  return { ...b, checked: on ? [...rest, key] : rest };
}

// Ticks a boil addition with the time it went in.
export function setAddedAt(b: Brew, rowId: string, at: number | undefined): Brew {
  const addedAt = { ...b.addedAt };
  if (at === undefined) delete addedAt[rowId]; else addedAt[rowId] = at;
  return { ...b, addedAt };
}

export function setPhaseStart(b: Brew, phase: PhaseId, at: number | undefined): Brew {
  const phaseStartedAt = { ...b.phaseStartedAt };
  if (at === undefined) delete phaseStartedAt[phase]; else phaseStartedAt[phase] = at;
  return { ...b, phaseStartedAt };
}

export function setRowAmount(b: Brew, rowId: string, amount: number | undefined): Brew {
  const rowAmounts = { ...b.rowAmounts };
  if (amount === undefined) delete rowAmounts[rowId]; else rowAmounts[rowId] = amount;
  return { ...b, rowAmounts };
}

// The fields the page edits in a draft and saves with "Speichern".
export const HEAD_FIELDS = [
  'name', 'brewDate', 'brewhouseId', 'fermenterId', 'occupiedFrom', 'occupiedUntil', 'notes', 'phaseNotes',
] as const satisfies readonly (keyof Brew)[];

export const headOf = (b: Brew): Partial<Brew> => Object.fromEntries(HEAD_FIELDS.map((k) => [k, b[k]]));

// `fresh` with the head fields of `draft`; an unset field is removed.
export function withHead(fresh: Brew, draft: Brew): Brew {
  const out: Record<string, unknown> = { ...fresh, ...headOf(draft) };
  for (const k of HEAD_FIELDS) if (out[k] === undefined) delete out[k];
  return out as unknown as Brew;
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

// Loads the brew fresh, changes it and writes it back, so what another device
// saved in the meantime stays.
export async function patchBrew(id: string, change: (b: Brew) => Brew | Promise<Brew>): Promise<Brew> {
  const fresh = await getBrew(id);
  if (!fresh) throw new Error('Sud nicht gefunden');
  return saveBrew(await change(fresh));
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
