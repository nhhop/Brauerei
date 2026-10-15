// A brew's hand-entered readings (5c-4): gravity, temperature and pH measured
// during fermentation and maturation. One document per brew in
// /api/brews/<id>/readings (SD boards), apart from the brew itself so a brew
// stays under the firmware's 16 KB body limit however often it is measured.
import { failed } from './api';
import { apparentExtractFromRefractometer } from './brewMath';
import { VALID_ID } from './docBundle';
import { sgToPlato, type GravityUnit } from './gravityUnits';

// gravity in °P; brix as read on the refractometer (raw: with alcohol in the
// wort it needs the original extract to become a gravity, see readingPlato).
export type ReadingKind = 'gravity' | 'brix' | 'temp' | 'ph';

export interface Reading { at: number; kind: ReadingKind; v: number; note?: string }  // at: epoch ms
export interface BrewReadings { id: string; readings: Reading[] }

export const KIND_LABEL: Record<ReadingKind, string> = {
  gravity: 'Dichte', brix: 'Dichte (Refraktometer)', temp: 'Temperatur', ph: 'pH',
};

// The firmware takes 16 KB (about 300 readings); a little room is left for the id.
const MAX_BYTES = 15000;

export const fitsLimit = (doc: BrewReadings): boolean =>
  new TextEncoder().encode(JSON.stringify(doc)).length <= MAX_BYTES;

// Newest last, as the chart takes them.
export const addReading = (doc: BrewReadings, r: Reading): BrewReadings =>
  ({ ...doc, readings: [...doc.readings, r].sort((a, b) => a.at - b.at) });

export const removeReading = (doc: BrewReadings, index: number): BrewReadings =>
  ({ ...doc, readings: doc.readings.filter((_, i) => i !== index) });

// The gravity in °P a reading stands for. A refractometer reading needs the
// original extract (°P) of the wort; without it there is no value.
export function readingPlato(r: Reading, originalPlato: number | undefined): number | null {
  if (r.kind === 'gravity') return r.v;
  if (r.kind === 'brix' && originalPlato !== undefined) return apparentExtractFromRefractometer(originalPlato, r.v);
  return null;
}

// What the entry form offers; a gravity is entered in °P, SG or °Bx.
export type EntryKind = 'gravity' | 'temp' | 'ph';

const RANGE: Record<GravityUnit | 'temp' | 'ph', [number, number]> = {
  plato: [0, 40], sg: [0.99, 1.2], brix: [0, 40], temp: [-20, 120], ph: [0, 14],
};
const round = (v: number, decimals: number) => Math.round(v * 10 ** decimals) / 10 ** decimals;

// The reading for what was typed ("1,012" with a comma too), null when it is not
// a number or out of any sensible range. An SG becomes °P; °Bx stays as read.
export function entryToReading(kind: EntryKind, unit: GravityUnit, text: string, at: number, note?: string): Reading | null {
  const raw = Number(text.trim().replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(raw)) return null;
  const [min, max] = RANGE[kind === 'gravity' ? unit : kind];
  if (raw < min || raw > max) return null;
  const n = note?.trim() || undefined;
  const base = kind === 'gravity' && unit === 'brix' ? { kind: 'brix' as const, v: round(raw, 2) }
    : kind === 'gravity' ? { kind: 'gravity' as const, v: round(unit === 'sg' ? sgToPlato(raw) : raw, 2) }
    : { kind, v: round(raw, 2) };
  return { at, ...base, ...(n && { note: n }) };
}

const dec = (v: number, d: number) => v.toFixed(d).replace('.', ',');

// "9,5 °P", "8,0 °Bx (≙ 5,1 °P)", "18,0 °C", "4,50"
export function readingText(r: Reading, originalPlato: number | undefined): string {
  if (r.kind === 'gravity') return `${dec(r.v, 1)} °P`;
  if (r.kind === 'temp') return `${dec(r.v, 1)} °C`;
  if (r.kind === 'ph') return dec(r.v, 2);
  const plato = readingPlato(r, originalPlato);
  return `${dec(r.v, 1)} °Bx${plato === null ? '' : ` (≙ ${dec(plato, 1)} °P)`}`;
}

const urlOf = (id: string) => `/api/brews/${encodeURIComponent(id)}/readings`;

// A brew without readings has no file (404).
export async function getReadings(id: string): Promise<BrewReadings> {
  const r = await fetch(urlOf(id));
  if (r.status === 404) return { id, readings: [] };
  if (!r.ok) await failed(r);
  const doc = (await r.json()) as Partial<BrewReadings>;
  return { id, readings: Array.isArray(doc.readings) ? doc.readings : [] };
}

export async function saveReadings(doc: BrewReadings): Promise<void> {
  if (!VALID_ID.test(doc.id)) throw new Error('ungültige ID');
  if (!fitsLimit(doc)) throw new Error('Zu viele Messungen: Der Speicher des Geräts nimmt höchstens etwa 300 je Sud auf.');
  const res = await fetch(urlOf(doc.id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
  if (!res.ok) await failed(res);
}
