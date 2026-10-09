// Mash profiles: rest sequences of the recipe editor, stored on the SD card as
// /mashprofiles/<id>.json (global, not per recipe or brewhouse). Not to be
// confused with the controller programs under /api/profiles. A profile holds the
// temperatures and holds only; the heating times come from the brewhouse.
import { failed } from './api';
import { VALID_ID, uid, type MashStep } from './recipes';

export interface MashProfileStep {
  kind: 'rest' | 'infusion';
  name: string;
  tempC: number;
  durationMin: number;
}

export interface MashProfile {
  id: string;
  name: string;
  method: string;       // free text, e.g. "Infusion, Einrast"
  description: string;
  // The fixed step "Einmaischen" is not part of `steps`, but its temperature and
  // hold are the first rest of the sequence and so belong to the profile.
  doughIn: { tempC: number; durationMin: number };
  steps: MashProfileStep[];
  updatedAt: number;
}

const rest = (name: string, tempC: number, durationMin: number): MashProfileStep =>
  ({ kind: 'rest', name, tempC, durationMin });

const NOTE = 'Richtwerte, an Malz und Sudhaus anpassen.';

// Shipped read-only; changing one means duplicating it. The values are common
// practice (Hochkurz: beer&brewing "Short and High"; wheat: ferulic acid rest
// 45 °C, maltose rest 63 °C, dextrinization 72 °C) — TODO(verify) against a
// brewing textbook.
export const BUILTIN_MASH_PROFILES: MashProfile[] = [
  {
    id: 'std-hochkurz', name: 'Hochkurz', method: 'Infusion, Stufen', updatedAt: 0,
    description: `Beginnt oberhalb der Eiweißrast und ist kurz: Maltoserast, Verzuckerungsrast, Abmaischen. ${NOTE}`,
    doughIn: { tempC: 62, durationMin: 35 },
    steps: [rest('Verzuckerungsrast', 72, 20), rest('Abmaischen', 78, 5)],
  },
  {
    id: 'std-einrast', name: 'Einrast-Infusion', method: 'Infusion, Einrast', updatedAt: 0,
    description: `Eine Rast bei 67 °C für gut gelöstes Malz, danach Abmaischen. ${NOTE}`,
    doughIn: { tempC: 67, durationMin: 60 },
    steps: [rest('Abmaischen', 78, 5)],
  },
  {
    id: 'std-weizen', name: 'Weizen mit Ferulasäurerast', method: 'Infusion, Stufen', updatedAt: 0,
    description: `Ferulasäurerast bei 45 °C für das Nelkenaroma (4-Vinylguajakol), dann Maltose- und Verzuckerungsrast. ${NOTE}`,
    doughIn: { tempC: 45, durationMin: 20 },
    steps: [rest('Maltoserast', 63, 45), rest('Verzuckerungsrast', 72, 20), rest('Abmaischen', 78, 5)],
  },
  {
    id: 'std-eiweiss', name: 'Klassisch mit Eiweißrast', method: 'Infusion, Stufen', updatedAt: 0,
    description: `Für schlecht gelöstes Malz: Eiweißrast bei 52 °C, Maltose- und Verzuckerungsrast. ${NOTE}`,
    doughIn: { tempC: 52, durationMin: 10 },
    steps: [rest('Maltoserast', 63, 40), rest('Verzuckerungsrast', 72, 20), rest('Abmaischen', 78, 5)],
  },
  {
    id: 'std-kombirast', name: 'Kombirast 66 °C', method: 'Infusion, Einrast', updatedAt: 0,
    description: `Eine Rast bei 66 °C, wo Alpha- und Beta-Amylase gemeinsam arbeiten, danach Abmaischen. ${NOTE}`,
    doughIn: { tempC: 66, durationMin: 70 },
    steps: [rest('Abmaischen', 78, 5)],
  },
];

export const isBuiltinProfile = (p: Pick<MashProfile, 'id'>) => BUILTIN_MASH_PROFILES.some((b) => b.id === p.id);

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

// Fills in what a hand-edited file lacks; steps of another kind or without
// numbers are dropped.
export function normalizeMashProfile(raw: Partial<MashProfile> & { id: string }): MashProfile {
  return {
    id: raw.id,
    name: raw.name ?? '',
    method: raw.method ?? '',
    description: raw.description ?? '',
    doughIn: {
      tempC: finite(raw.doughIn?.tempC) ? raw.doughIn.tempC : 67,
      durationMin: finite(raw.doughIn?.durationMin) ? raw.doughIn.durationMin : 60,
    },
    steps: (Array.isArray(raw.steps) ? raw.steps : []).filter(
      (s): s is MashProfileStep => (s?.kind === 'rest' || s?.kind === 'infusion') && finite(s.tempC) && finite(s.durationMin))
      .map((s) => ({ kind: s.kind, name: s.name ?? '', tempC: s.tempC, durationMin: s.durationMin })),
    updatedAt: raw.updatedAt ?? 0,
  };
}

// The plan with the profile applied: the two fixed steps stay (the profile sets
// the temperature and hold of the second), every other step is replaced.
export function applyMashProfile(mash: MashStep[], p: MashProfile): MashStep[] {
  const [strike, doughIn] = mash;
  return [
    strike,
    { ...doughIn, tempC: p.doughIn.tempC, durationMin: p.doughIn.durationMin },
    ...p.steps.map((s): MashStep => ({
      id: uid(), kind: s.kind, name: s.name, tempC: s.tempC, durationMin: s.durationMin,
      infusion: s.kind === 'infusion' ? { lead: 'temp' } : undefined,
    })),
  ];
}

// What a load drops: the doughIn steps of further charges, which the profile
// cannot hold.
export const droppedChargeSteps = (mash: MashStep[]) => mash.slice(2).filter((s) => s.kind === 'doughIn');

// The profile content of a plan. Only rests and infusions after the fixed steps
// count; a rest without a temperature keeps the one before it.
export function profileOfPlan(mash: MashStep[]): Pick<MashProfile, 'doughIn' | 'steps'> {
  let last = mash[1]?.tempC ?? 67;
  const steps: MashProfileStep[] = [];
  for (const s of mash.slice(2)) {
    if (s.kind !== 'rest' && s.kind !== 'infusion') continue;
    last = s.tempC ?? last;
    steps.push({ kind: s.kind, name: s.name, tempC: last, durationMin: s.durationMin ?? 0 });
  }
  return { doughIn: { tempC: mash[1]?.tempC ?? 67, durationMin: mash[1]?.durationMin ?? 0 }, steps };
}

export function newMashProfile(from?: Pick<MashProfile, 'doughIn' | 'steps'>): MashProfile {
  return {
    id: uid(), name: '', method: '', description: '', updatedAt: 0,
    doughIn: from ? { ...from.doughIn } : { tempC: 67, durationMin: 60 },
    steps: from ? from.steps.map((s) => ({ ...s })) : [rest('Abmaischen', 78, 5)],
  };
}

export function duplicateMashProfile(p: MashProfile): MashProfile {
  return { ...structuredClone(p), id: uid(), name: `${p.name} (Kopie)`, updatedAt: 0 };
}

// "45 °C 15 min → 63 °C 40 min → …"
export function mashProfileSummary(p: MashProfile): string {
  const t = (c: number, m: number) => `${String(c).replace('.', ',')} °C ${m} min`;
  return [t(p.doughIn.tempC, p.doughIn.durationMin), ...p.steps.map((s) => t(s.tempC, s.durationMin))].join(' → ');
}

// ── API ────────────────────────────────────────────────────────────────────────
const BASE = '/api/mash-profiles';

// The profiles of the SD card; the shipped ones are not among them.
export async function listMashProfiles(): Promise<MashProfile[]> {
  const r = await fetch(BASE);
  if (!r.ok) await failed(r);
  return ((await r.json()) as (Partial<MashProfile> & { id: string })[])
    .map(normalizeMashProfile).sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveMashProfile(p: MashProfile): Promise<MashProfile> {
  if (!VALID_ID.test(p.id)) throw new Error('ungültige ID');
  const saved = { ...p, updatedAt: Date.now() };
  const r = await fetch(`${BASE}/${encodeURIComponent(p.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saved),
  });
  if (!r.ok) await failed(r);
  return saved;
}

export async function deleteMashProfile(id: string): Promise<void> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) await failed(r);
}
