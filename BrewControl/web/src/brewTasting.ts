// A brew's tastings (Verkostung): what the beer looked, smelled and tasted like,
// one entry per tasting, so a beer can be followed from young beer to the bottle
// after weeks. One document per brew in /api/brews/<id>/tasting (SD boards),
// apart from the brew itself so it stays under the firmware's 16 KB body limit.
// Descriptors only, no scores. The values of the choices are the ids of
// tastingVocab.ts.
import { failed } from './api';
import { VALID_ID } from './docBundle';
import { uid } from './recipes';

export type FaultLevel = 'slight' | 'clear' | 'strong';
export interface FaultMark { id: string; level: FaultLevel }

// The phases of a tasting in the order they happen: appearance, smell, attack,
// main sip, finish; then the off-flavours and the overall impression. Each phase
// has a note.
export interface Tasting {
  id: string;
  at: number;                  // epoch ms
  taster?: string;
  appearance: { color?: string; clarity?: string; headAmount?: string; headTexture?: string; headStability?: string; notes?: string };
  aroma: { descriptors: string[]; notes?: string };
  attack: { carbonation?: string; impression?: string; notes?: string };
  main: { body?: string; balance?: string; textures: string[]; notes?: string };
  finish: {
    bitterIntensity?: string; bitterQuality?: string; aftertaste: string[]; length?: string; alcohol?: string;
    drinkability?: string; notes?: string;
  };
  faults: FaultMark[];
  overall: { complexity?: string; styleFit?: string; enjoyment?: number; notes?: string };  // enjoyment: 1 to 5 stars
}

export interface BrewTasting { id: string; tastings: Tasting[] }

export const emptyTasting = (at: number, id: string = uid()): Tasting => ({
  id,
  at,
  appearance: {},
  aroma: { descriptors: [] },
  attack: {},
  main: { textures: [] },
  finish: { aftertaste: [] },
  faults: [],
  overall: {},
});

// ── The list ──────────────────────────────────────────────────────────────────────
// Oldest first, as they happened; the page shows the newest on top.
const byTime = (a: Tasting, b: Tasting) => a.at - b.at;

export const addTasting = (doc: BrewTasting, t: Tasting): BrewTasting =>
  ({ ...doc, tastings: [...doc.tastings, t].sort(byTime) });

export const updateTasting = (doc: BrewTasting, t: Tasting): BrewTasting =>
  ({ ...doc, tastings: doc.tastings.map((x) => (x.id === t.id ? t : x)).sort(byTime) });

export const removeTasting = (doc: BrewTasting, id: string): BrewTasting =>
  ({ ...doc, tastings: doc.tastings.filter((x) => x.id !== id) });

// ── Picking ───────────────────────────────────────────────────────────────────────
// Adds the id, or takes it out when it is there.
export const toggleId = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

// Picks a single choice; the same one again clears it.
export const pickOne = (current: string | undefined, id: string): string | undefined =>
  current === id ? undefined : id;

// Picks a star rating; the same one again clears it.
export const pickRating = (current: number | undefined, n: number): number | undefined =>
  current === n ? undefined : n;

// ── Own aroma words ───────────────────────────────────────────────────────────────
// A word typed in is kept in the aroma lists as "~word", next to the ids of
// tastingVocab.ts, so it needs no storage of its own.
const CUSTOM_PREFIX = '~';
export const MAX_CUSTOM_LENGTH = 40;

export const isCustom = (id: string): boolean => id.startsWith(CUSTOM_PREFIX);
export const customLabel = (id: string): string => id.slice(CUSTOM_PREFIX.length);

// Adds a typed word and picks it; empty text, or a word already in the list
// (any case), leaves the list as it is.
export function addCustom(ids: string[], text: string): string[] {
  const word = text.trim().slice(0, MAX_CUSTOM_LENGTH);
  if (word === '') return ids;
  const lower = word.toLowerCase();
  if (ids.some((x) => isCustom(x) && customLabel(x).toLowerCase() === lower)) return ids;
  return [...ids, CUSTOM_PREFIX + word];
}

// The own words used in a brew's tastings (smell and aftertaste), each once, in
// the order they were first used: offered again in the next tasting.
export function customTerms(tastings: Tasting[]): string[] {
  const seen = new Map<string, string>();
  for (const t of tastings) {
    for (const id of [...t.aroma.descriptors, ...t.finish.aftertaste]) {
      if (isCustom(id) && !seen.has(customLabel(id).toLowerCase())) seen.set(customLabel(id).toLowerCase(), id);
    }
  }
  return [...seen.values()];
}

// An off-flavour newly marked is "slight"; a marked one is taken out again.
export const toggleFault = (faults: FaultMark[], id: string): FaultMark[] =>
  faults.some((f) => f.id === id) ? faults.filter((f) => f.id !== id) : [...faults, { id, level: 'slight' }];

export const setFaultLevel = (faults: FaultMark[], id: string, level: FaultLevel): FaultMark[] =>
  faults.map((f) => (f.id === id ? { ...f, level } : f));

// Empty text is no text.
export const textOrUndefined = (text: string): string | undefined => (text.trim() === '' ? undefined : text);

// Whole days between the bottling and a tasting; none before the bottling or
// when the brew was not bottled yet.
export const daysSinceBottling = (at: number, bottledAt: number | undefined): number | undefined =>
  bottledAt === undefined || at < bottledAt ? undefined : Math.floor((at - bottledAt) / 86_400_000);

// ── Size ─────────────────────────────────────────────────────────────────────────
// The firmware takes 16 KB (about 12 tastings filled in down to the notes, 1.2 KB
// each); a little room is left for the id.
const MAX_BYTES = 15000;

export const fitsLimit = (doc: BrewTasting): boolean =>
  new TextEncoder().encode(JSON.stringify(doc)).length <= MAX_BYTES;

// ── Store ────────────────────────────────────────────────────────────────────────
const urlOf = (id: string) => `/api/brews/${encodeURIComponent(id)}/tasting`;

// A brew without tastings has no file (404).
export async function getTasting(id: string): Promise<BrewTasting> {
  const r = await fetch(urlOf(id));
  if (r.status === 404) return { id, tastings: [] };
  if (!r.ok) await failed(r);
  const doc = (await r.json()) as Partial<BrewTasting>;
  return { id, tastings: Array.isArray(doc.tastings) ? doc.tastings : [] };
}

export async function saveTasting(doc: BrewTasting): Promise<void> {
  if (!VALID_ID.test(doc.id)) throw new Error('ungültige ID');
  if (!fitsLimit(doc)) throw new Error('Zu viele Verkostungen: Der Speicher des Geräts nimmt höchstens etwa 12 voll ausgefüllte je Sud auf.');
  const res = await fetch(urlOf(doc.id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
  if (!res.ok) await failed(res);
}
