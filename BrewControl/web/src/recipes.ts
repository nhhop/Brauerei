// Recipe model + store. Recipes live on the device's SD card behind /api/recipes
// (SD boards only); the functions at the bottom are the only persistence surface.

import { failed } from './api';
import type { TargetIons } from './waterChem';

export type IngredientKind = 'fermentable' | 'hop' | 'yeast' | 'aroma' | 'auxiliary';

export type Timing =
  | 'water' | 'mainWater' | 'mash' | 'mashPh' | 'sparge' | 'preBoil' | 'knockOut' | 'dilution'
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
  water: 'Brauwasser', mainWater: 'Hauptguss', mash: 'Maische', mashPh: 'Maische nach pH-Messung', sparge: 'Nachguss',
  preBoil: 'Würze vor dem Kochen', knockOut: 'Ausschlagwürze', dilution: 'Verschnitt',
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
  auxiliary: ['water', 'mainWater', 'mash', 'mashPh', 'sparge', 'preBoil', 'boil', 'knockOut', 'dilution', 'pitch', 'maturation'],
};

// The process tabs show the same ingredient list, filtered by moment. "Brauwasser"
// is shared out over strike and sparge water by volume; the mash and wort
// moments are in both the water and the mash or boil scope.
export type Scope = 'water' | 'mash' | 'boil' | 'fermentation';
export const SCOPE_TIMINGS: Record<Scope, Timing[]> = {
  water: ['water', 'mainWater', 'mash', 'mashPh', 'sparge', 'preBoil', 'knockOut', 'dilution'],
  mash: ['mash', 'mashPh'],
  boil: ['preBoil', 'firstWort', 'boil', 'whirlpool', 'hopBack', 'knockOut', 'kettleSour'],
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
  strengthPct?: number; // acid or solution: concentration of this addition; unset = the catalog's
  auto?: true;          // laid out by the water automation; a run replaces it, editing by hand drops the mark
  chargeId?: string;    // fermentable in the mash: its charge (Schüttung); unset = the first
}

// Mash plan (tab "Maischen", mashPlan.ts computes it). Every step has a target
// temperature and a hold; the kind only sets how the mash gets there. The plan
// always starts with `strike` and the first `doughIn`, which stay in place.
export type MashStepKind = 'strike' | 'doughIn' | 'rest' | 'infusion' | 'decoction';

export interface MashStep {
  id: string;
  kind: MashStepKind;
  name: string;
  tempC?: number;       // target; doughIn: input only for the first, a result for later charges
  durationMin?: number; // hold at tempC
  chargeId?: string;    // doughIn: the charge it adds; unset = the first
  infusion?: Infusion;
  decoction?: Decoction;
}

// Water added to the mash. Volume and water temperature depend on each other;
// `lead` names the one edited last. Ice melts at 0 °C and always leads by temperature.
export interface Infusion { lead: 'volume' | 'temp'; volumeL?: number; waterTempC?: number; ice?: boolean }

// Part of the mash boiled in a second vessel and put back (tempC: the mash after
// that). Share and that temperature depend on each other; `lead` names the one
// edited last. Thick takes mostly grain, thin only liquid.
export interface Decoction {
  lead: 'share' | 'temp';
  sharePct?: number;    // of the mash volume, while it leads
  thin?: boolean;       // unset = thick
  rests: { tempC: number; durationMin: number }[];  // in the decoction vessel, before the boil
  boilMin: number;
}

// A share of the grist that is mashed in by its own doughIn step. Without
// `Recipe.charges` there is exactly one, implicit.
export interface Charge { id: string; name: string }

// Fermentation phase (duration in days).
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
  efficiencyPct?: number; // input of the brewery's efficiency basis (efficiency.ts); unset = its default
  conversionPct?: number; // basis "Konversion": override of the brewhouse's value
  brewhouseId?: string;   // unset = no brewhouse chosen yet
  water?: RecipeWater;
  status: 'draft' | 'final';
  updatedAt: number;
  ingredients: Ingredient[];
  mash: MashStep[];
  charges?: Charge[];     // unset = one charge, FIRST_CHARGE
  boil: { durationMin: number; whirlpoolTempC: number; whirlpoolMin: number };
  fermentation: Phase[];
}

export const DEFAULT_EFFICIENCY = 75;

// Water tab settings; every field is optional and read via its default.
export interface RecipeWater {
  sparge?: boolean;               // "Mit Nachguss"; only takes effect if the brewhouse has the sparge step
  mashRatioLPerKg?: number;
  spargeTempC?: number;
  spargeMethod?: 'batch' | 'fly'; // with sparge; unset = batch
  spargeBatches?: number;         // batch sparge: equal additions; unset = 1
  evaporationLPerH?: number;      // override; unset = the boil vessel's value
  grainAbsorptionLPerKg?: number; // override; unset = the lauter vessel's value
  // Source water per water; unset waterId = the brewery's default water, blended
  // with blendPct % of blendId (unset = VE water).
  sources?: Partial<Record<WaterKey, WaterSource>>;
  dilution?: Dilution;
  targetPh?: Partial<Record<PhKey, number>>;  // target of the acid and base helper
  target?: WaterTarget;           // water profile the strike water is compared with
}

// A target profile by id (built in or the brewery's), or own ions; {} shows the
// comparison before one is picked.
export interface WaterTarget { id?: string; ions?: TargetIons }

export type WaterKey = 'strike' | 'sparge' | 'dilution';
export type PhKey = WaterKey | 'mash' | 'preBoil' | 'knockOut';
export interface WaterSource { waterId?: string; blendId?: string; blendPct?: number }

// Planned dilution (high gravity), at the end of the boil or in the fermenter.
// Volume and gravity depend on each other; `lead` names the one last edited,
// the other is computed. `plato` is the gravity the grist does not fix: in the
// kettle before the dilution, or the pitched wort after it.
export interface Dilution {
  at: 'kettle' | 'fermenter';
  lead: 'volume' | 'gravity';
  volumeL?: number;
  plato?: number;
}

export const DEFAULT_MASH_RATIO = 3.5;
export const DEFAULT_SPARGE_TEMP = 78;

// Plain HTTP means no crypto.randomUUID (secure contexts only).
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function newRecipe(): Recipe {
  return {
    id: uid(), name: 'Neues Rezept', description: '', style: '', volumeL: 20,
    status: 'draft', updatedAt: Date.now(),
    ingredients: [], mash: normalizeMash([]),
    boil: { durationMin: 60, whirlpoolTempC: 80, whirlpoolMin: 15 },
    fermentation: [],
  };
}

// ── Mash plan and charges ──────────────────────────────────────────────────────

export const MASH_KIND_LABEL: Record<MashStepKind, string> = {
  strike: 'Wasser vorlegen', doughIn: 'Einmaischen', rest: 'Rast', infusion: 'Zubrühen', decoction: 'Dekoktion',
};

const MASH_KINDS = Object.keys(MASH_KIND_LABEL);

// Entries without a known kind (the rest list before stage 3) are dropped, there
// is no migration. Puts the first `strike` and the first `doughIn` in front,
// adding them when missing; the first doughIn always mashes in the first charge.
export function normalizeMash(raw: unknown): MashStep[] {
  const steps = (Array.isArray(raw) ? raw : []).filter(
    (s): s is MashStep => typeof s?.id === 'string' && MASH_KINDS.includes(s.kind));
  const strike = steps.find((s) => s.kind === 'strike') ?? { id: uid(), kind: 'strike', name: 'Hauptguss erhitzen' };
  const doughIn = steps.find((s) => s.kind === 'doughIn')
    ?? { id: uid(), kind: 'doughIn', name: 'Einmaischen', tempC: 67, durationMin: 60 };
  const { chargeId: _, ...first } = doughIn;
  return [strike, first, ...steps.filter((s) => s.kind !== 'strike' && s !== doughIn)];
}

export const FIRST_CHARGE: Charge = { id: 'c1', name: 'Schüttung 1' };

export function chargesOf(r: Pick<Recipe, 'charges'>): Charge[] {
  return r.charges?.length ? r.charges : [FIRST_CHARGE];
}

// The charge of an ingredient or doughIn step; an unknown id counts as the first.
export function chargeIdOf(x: { chargeId?: string }, charges: Charge[]): string {
  return charges.some((c) => c.id === x.chargeId) ? x.chargeId! : charges[0].id;
}

export const isMashGrain = (i: Ingredient) => i.kind === 'fermentable' && i.timing === 'mash';

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// A new charge, named after the next free number, and the ingredients with
// `pct` % of every grain of charge `fromId` moved into it (the kg per malt stay
// the same). Without `fromId` or `pct` the charge is empty.
export function splitCharge(r: Pick<Recipe, 'charges' | 'ingredients'>, fromId?: string, pct?: number): { charge: Charge; ingredients: Ingredient[] } {
  const charges = chargesOf(r);
  let n = charges.length + 1;
  while (charges.some((c) => c.name === `Schüttung ${n}`)) n++;
  const charge: Charge = { id: uid(), name: `Schüttung ${n}` };
  const ingredients = r.ingredients.flatMap((i) => {
    if (!fromId || !pct || !isMashGrain(i) || chargeIdOf(i, charges) !== fromId) return [i];
    const move = round3((i.amount * pct) / 100);
    return [{ ...i, amount: round3(i.amount - move) }, { ...i, id: uid(), amount: move, chargeId: charge.id, auto: undefined }];
  });
  return { charge, ingredients };
}

// Adds a charge and its doughIn step after `afterStepId` (unset = at the end),
// splitting `pct` % off charge `fromId` (splitCharge).
export function addCharge(r: Recipe, opts: { fromId?: string; pct?: number; afterStepId?: string } = {}): Partial<Recipe> {
  const charges = chargesOf(r);
  const { charge, ingredients } = splitCharge(r, opts.fromId, opts.pct);
  const step: MashStep = { id: uid(), kind: 'doughIn', name: `${charge.name} zugeben`, durationMin: 10, chargeId: charge.id };
  const at = r.mash.findIndex((s) => s.id === opts.afterStepId);
  const mash = at < 0 ? [...r.mash, step] : [...r.mash.slice(0, at + 1), step, ...r.mash.slice(at + 1)];
  return { charges: [...charges, charge], ingredients, mash };
}

// Removes a charge (not the first) and its doughIn steps. Its grain goes back to
// the first charge, merged into a row of the same malt there.
export function removeCharge(r: Recipe, id: string): Partial<Recipe> {
  const charges = chargesOf(r);
  if (id === charges[0].id) return {};
  const rest = charges.filter((c) => c.id !== id);
  const first = rest[0].id;
  const ingredients: Ingredient[] = [];
  for (const i of r.ingredients) {
    // Copies, since a merge below changes the row in place.
    if (!isMashGrain(i) || chargeIdOf(i, charges) !== id) { ingredients.push({ ...i }); continue; }
    const same = ingredients.find((x) => isMashGrain(x) && chargeIdOf(x, charges) === first
      && x.name === i.name && x.ingredientId === i.ingredientId);
    if (same) same.amount = round3(same.amount + i.amount);
    else ingredients.push({ ...i, chargeId: undefined });
  }
  return {
    charges: rest.length > 1 ? rest : undefined,
    ingredients: rest.length > 1 ? ingredients : ingredients.map((i) => (i.chargeId ? { ...i, chargeId: undefined } : i)),
    mash: r.mash.filter((s) => !(s.kind === 'doughIn' && s.chargeId === id)),
  };
}

// The plan with every decoction turned into a rest to the same temperature and
// hold, for a brewhouse without a decoction vessel. `resultC` gives the
// temperature a decoction led by its share reaches (the plan's row).
export function replaceDecoctions(mash: MashStep[], resultC?: (s: MashStep) => number | undefined): MashStep[] {
  return mash.map((s) => {
    if (s.kind !== 'decoction') return s;
    const { decoction, ...rest } = s;
    const tempC = decoction?.lead === 'share' ? resultC?.(s) ?? s.tempC : s.tempC;
    return { ...rest, kind: 'rest', tempC: tempC === undefined ? undefined : Math.round(tempC * 10) / 10 };
  });
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
  const recipe = (await r.json()) as Recipe;
  return { ...recipe, mash: normalizeMash(recipe.mash) };
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

// ── Backup file ─────────────────────────────────────────────────────────────────
// GET /api/backup covers /config only; recipes get their own file, built and
// replayed here one request at a time (the SD read/write costs ~60 ms per recipe).
const BUNDLE_TYPE = 'brewcontrol-recipes';

// The firmware's isValidRecipeId (RecipeFiles.h): the id becomes a file name.
export const VALID_ID = /^[0-9a-zA-Z_-]{1,32}$/;

export async function exportRecipes(): Promise<string> {
  const recipes: Recipe[] = [];
  for (const { id } of await fetchList()) {
    const r = await getRecipe(id);
    if (r) recipes.push(r);
  }
  return JSON.stringify({ type: BUNDLE_TYPE, version: 1, recipes });
}

export function parseRecipeBundle(text: string): Recipe[] {
  let bundle: { type?: unknown; version?: unknown; recipes?: unknown };
  try { bundle = JSON.parse(text); } catch { throw new Error('keine gültige JSON-Datei'); }
  if (bundle?.type !== BUNDLE_TYPE) throw new Error('keine Rezept-Sicherung');
  if (bundle.version !== 1) throw new Error('nicht unterstützte Version');
  if (!Array.isArray(bundle.recipes)) throw new Error('Rezeptliste fehlt');
  for (const r of bundle.recipes as Recipe[]) {
    if (typeof r?.id !== 'string' || !VALID_ID.test(r.id)) throw new Error('Rezept mit ungültiger ID');
  }
  return bundle.recipes as Recipe[];
}

// Same id → overwritten, updatedAt kept. Stops at the first failure; running it
// again is safe, so the message says how far it got.
export async function importRecipes(
  text: string, onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const recipes = parseRecipeBundle(text);
  let done = 0;
  onProgress?.(0, recipes.length);
  for (const r of recipes) {
    try { await put(r); } catch (e) {
      throw new Error(`${done} von ${recipes.length} Rezepten eingespielt, dann: ${e}`);
    }
    done++;
    onProgress?.(done, recipes.length);
  }
  return done;
}
