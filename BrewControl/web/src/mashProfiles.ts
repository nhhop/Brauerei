// Mash profiles: rest sequences of the recipe editor, stored on the SD card as
// /mashprofiles/<id>.json (global, not per recipe or brewhouse). Not to be
// confused with the controller programs under /api/profiles. A profile holds the
// temperatures and holds only; the heating times come from the brewhouse.
import { failed } from './api';
import {
  VALID_ID, chargeIdOf, chargesOf, isMashGrain, splitCharge, uid, type Charge, type MashStep, type Recipe,
} from './recipes';

// A step after the fixed "Einmaischen". `tempC` is the target (decoction: the
// mash after putting it back); a further charge's doughIn has none, its
// temperature results from mixing.
export interface MashProfileStep {
  kind: 'rest' | 'infusion' | 'decoction' | 'doughIn';
  name: string;
  tempC?: number;
  durationMin: number;
  waterTempC?: number;  // infusion: unset = boiling
  sharePct?: number;    // doughIn: the further charge, % of the whole grist
  decoction?: { thin?: boolean; rests: { tempC: number; durationMin: number }[]; boilMin: number };
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

// A decoction to `tempC`; `rests` of the decoction before its boil.
const decoction = (name: string, tempC: number, durationMin: number, boilMin: number,
  rests: [number, number][] = [], thin = false): MashProfileStep => ({
  kind: 'decoction', name, tempC, durationMin,
  decoction: { ...(thin ? { thin } : {}), rests: rests.map(([c, m]) => ({ tempC: c, durationMin: m })), boilMin },
});

const NOTE = 'Richtwerte, an Malz und Sudhaus anpassen.';

// Shipped read-only; changing one means duplicating it. The values are common
// practice (Hochkurz: beer&brewing "Short and High"; wheat: ferulic acid rest
// 45 °C, maltose rest 63 °C, dextrinization 72 °C; decoctions after the
// classic German one-, two- and three-mash methods, e.g. mashcamp.shop
// "Maischverfahren im Vergleich"; Earl's Kochmaische: hobbybrauer.de forum,
// topic 461) — TODO(verify) against a brewing textbook.
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
  {
    id: 'std-einmaisch', name: 'Einmaischverfahren', method: 'Dekoktion, eine Kochmaische', updatedAt: 0,
    description: `Eine dicke Kochmaische hebt von der Eiweißrast auf die Maltoserast, danach wird geheizt. Braucht einen zweiten beheizten Behälter. ${NOTE}`,
    doughIn: { tempC: 50, durationMin: 15 },
    steps: [
      decoction('Kochmaische', 64, 40, 15, [[72, 15]]),
      rest('Verzuckerungsrast', 72, 20), rest('Abmaischen', 78, 5),
    ],
  },
  {
    id: 'std-zweimaisch', name: 'Zweimaischverfahren', method: 'Dekoktion, zwei Kochmaischen', updatedAt: 0,
    description: `Zwei dicke Kochmaischen: von der Eiweißrast auf die Maltoserast und von dort auf die Verzuckerungsrast. Braucht einen zweiten beheizten Behälter. ${NOTE}`,
    doughIn: { tempC: 50, durationMin: 20 },
    steps: [
      decoction('1. Kochmaische', 64, 40, 20, [[72, 15]]),
      decoction('2. Kochmaische', 72, 20, 15, [[72, 10]]),
      rest('Abmaischen', 78, 5),
    ],
  },
  {
    id: 'std-dreimaisch', name: 'Dreimaischverfahren', method: 'Dekoktion, drei Kochmaischen', updatedAt: 0,
    description: `Klassisch: kalt einmaischen, zwei dicke Kochmaischen auf Eiweiß- und Maltoserast, eine dünne Läutermaische zum Abmaischen. Braucht einen zweiten beheizten Behälter. ${NOTE}`,
    doughIn: { tempC: 37, durationMin: 20 },
    steps: [
      decoction('1. Kochmaische', 52, 15, 20, [[72, 10]]),
      decoction('2. Kochmaische', 64, 40, 15, [[72, 10]]),
      decoction('Läutermaische', 76, 5, 10, [], true),
    ],
  },
  {
    id: 'std-earl', name: 'Earls Kochmaische', method: 'Kochmaische im Maischbehälter, zwei Schüttungen', updatedAt: 0,
    description: `80 % der Schüttung verzuckern und im Maischbehälter kochen, mit kaltem Wasser abkühlen, dann die übrigen 20 % einmaischen und rasten. Braucht einen direkt beheizten Maischbehälter. ${NOTE}`,
    doughIn: { tempC: 62, durationMin: 30 },
    steps: [
      rest('Verzuckerungsrast', 72, 20),
      rest('Kochen', 100, 15),
      { kind: 'infusion', name: 'Kaltes Wasser zugeben', tempC: 62, durationMin: 0, waterTempC: 12 },
      { kind: 'doughIn', name: 'Schüttung 2 zugeben', durationMin: 10, sharePct: 20 },
      rest('Maltoserast', 63, 30), rest('Verzuckerungsrast', 72, 20), rest('Abmaischen', 78, 5),
    ],
  },
];

export const isBuiltinProfile = (p: Pick<MashProfile, 'id'>) => BUILTIN_MASH_PROFILES.some((b) => b.id === p.id);

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

// One step of a hand-edited file; one of an unknown kind or without its numbers
// is dropped.
function normalizeStep(raw: Partial<MashProfileStep> | null | undefined): MashProfileStep[] {
  if (!raw || !finite(raw.durationMin)) return [];
  const name = raw.name ?? '';
  const { kind, durationMin } = raw;
  if (kind === 'doughIn') {
    return finite(raw.sharePct) && raw.sharePct > 0 && raw.sharePct < 100 ? [{ kind, name, durationMin, sharePct: raw.sharePct }] : [];
  }
  if ((kind !== 'rest' && kind !== 'infusion' && kind !== 'decoction') || !finite(raw.tempC)) return [];
  const step: MashProfileStep = { kind, name, tempC: raw.tempC, durationMin };
  if (kind === 'infusion' && finite(raw.waterTempC)) step.waterTempC = raw.waterTempC;
  if (kind === 'decoction') {
    const d = raw.decoction;
    step.decoction = {
      ...(d?.thin ? { thin: true } : {}),
      rests: (Array.isArray(d?.rests) ? d.rests : []).filter((r) => finite(r?.tempC) && finite(r?.durationMin))
        .map((r) => ({ tempC: r.tempC, durationMin: r.durationMin })),
      boilMin: finite(d?.boilMin) ? d.boilMin : 15,
    };
  }
  return [step];
}

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
    steps: (Array.isArray(raw.steps) ? raw.steps : []).flatMap(normalizeStep),
    updatedAt: raw.updatedAt ?? 0,
  };
}

type Plan = Pick<Recipe, 'mash' | 'charges' | 'ingredients'>;

const grainKgOf = (r: Pick<Recipe, 'ingredients'>, charges: Charge[], id?: string) => r.ingredients
  .filter((i) => isMashGrain(i) && (id === undefined || chargeIdOf(i, charges) === id))
  .reduce((s, i) => s + i.amount, 0);

// The plan with the profile applied: the two fixed steps stay (the profile sets
// the temperature and hold of the second), every other step is replaced. The
// profile's doughIn steps take the recipe's further charges in order; where the
// recipe has none left, the share is split off the first charge. Further
// charges beyond the profile's keep their grain but lose their doughIn step.
// Infusions and decoctions come led by temperature.
export function applyMashProfile(r: Plan, p: MashProfile): Plan {
  const [strike, doughIn] = r.mash;
  let charges = chargesOf(r);
  let ingredients = r.ingredients;
  const totalKg = grainKgOf(r, charges);
  let next = 1;
  const steps = p.steps.map((s): MashStep => {
    const base = { id: uid(), name: s.name, tempC: s.tempC, durationMin: s.durationMin };
    switch (s.kind) {
      case 'doughIn': {
        let charge = charges[next];
        if (!charge) {
          const firstKg = grainKgOf({ ingredients }, charges, charges[0].id);
          const pct = firstKg > 0 ? Math.min(((s.sharePct ?? 0) * totalKg) / firstKg, 100) : 0;
          const split = splitCharge({ charges, ingredients }, charges[0].id, pct);
          charges = [...charges, split.charge];
          ingredients = split.ingredients;
          charge = split.charge;
        }
        next++;
        return { id: base.id, kind: 'doughIn', name: s.name || `${charge.name} zugeben`, durationMin: s.durationMin, chargeId: charge.id };
      }
      case 'infusion':
        return { ...base, kind: 'infusion', infusion: { lead: 'temp', ...(s.waterTempC !== undefined ? { waterTempC: s.waterTempC } : {}) } };
      case 'decoction': {
        const d = s.decoction ?? { rests: [], boilMin: 15 };
        return {
          ...base, kind: 'decoction',
          decoction: { lead: 'temp', ...(d.thin ? { thin: true } : {}), rests: d.rests.map((x) => ({ ...x })), boilMin: d.boilMin },
        };
      }
      default:
        return { ...base, kind: 'rest' };
    }
  });
  return {
    mash: [strike, { ...doughIn, tempC: p.doughIn.tempC, durationMin: p.doughIn.durationMin }, ...steps],
    charges: charges.length > chargesOf(r).length ? charges : r.charges,
    ingredients,
  };
}

// What loading `p` does beyond the steps, for the confirmation: the charges it
// splits off (with their share of the grist) and the further charges that are
// left without a doughIn step.
export function profileLoadEffects(r: Plan, p: MashProfile): { created: { name: string; pct: number }[]; unplaced: string[] } {
  const before = chargesOf(r);
  const after = applyMashProfile(r, p);
  const charges = chargesOf(after);
  const totalKg = grainKgOf(after, charges);
  const created = charges.filter((c) => !before.some((b) => b.id === c.id)).map((c) => ({
    name: c.name, pct: totalKg > 0 ? Math.round((grainKgOf(after, charges, c.id) / totalKg) * 100) : 0,
  }));
  const unplaced = before.slice(1)
    .filter((c) => !after.mash.some((s) => s.kind === 'doughIn' && s.chargeId === c.id))
    .map((c) => c.name);
  return { created, unplaced };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// The profile content of a plan, after the fixed steps: rests, infusions (with
// their water temperature when it leads), decoctions (with the temperature the
// plan computed when the share leads, `resultC`) and the doughIn steps of
// further charges as their share of the grist. A rest without a temperature
// keeps the one before it.
export function profileOfPlan(r: Plan, resultC?: (s: MashStep) => number | undefined): Pick<MashProfile, 'doughIn' | 'steps'> {
  const { mash } = r;
  const charges = chargesOf(r);
  const totalKg = grainKgOf(r, charges);
  let last = mash[1]?.tempC ?? 67;
  const steps: MashProfileStep[] = [];
  for (const s of mash.slice(2)) {
    const durationMin = s.durationMin ?? 0;
    switch (s.kind) {
      case 'doughIn': {
        const id = chargeIdOf(s, charges);
        if (id === charges[0].id || totalKg <= 0) break;
        steps.push({ kind: 'doughIn', name: s.name, durationMin, sharePct: round1((grainKgOf(r, charges, id) / totalKg) * 100) });
        break;
      }
      case 'rest':
        last = s.tempC ?? last;
        steps.push({ kind: 'rest', name: s.name, tempC: last, durationMin });
        break;
      case 'infusion': {
        last = s.tempC ?? last;
        const inf = s.infusion;
        const water = inf?.lead === 'temp' && !inf.ice && inf.waterTempC !== undefined ? { waterTempC: inf.waterTempC } : {};
        steps.push({ kind: 'infusion', name: s.name, tempC: last, durationMin, ...water });
        break;
      }
      case 'decoction': {
        const d = s.decoction ?? { lead: 'temp', rests: [], boilMin: 15 };
        const result = d.lead === 'share' ? resultC?.(s) : undefined;
        last = result !== undefined ? round1(result) : s.tempC ?? last;
        steps.push({
          kind: 'decoction', name: s.name, tempC: last, durationMin,
          decoction: { ...(d.thin ? { thin: true } : {}), rests: d.rests.map((x) => ({ ...x })), boilMin: d.boilMin },
        });
        break;
      }
    }
  }
  return { doughIn: { tempC: mash[1]?.tempC ?? 67, durationMin: mash[1]?.durationMin ?? 0 }, steps };
}

export function newMashProfile(from?: Pick<MashProfile, 'doughIn' | 'steps'>): MashProfile {
  return {
    id: uid(), name: '', method: '', description: '', updatedAt: 0,
    doughIn: from ? { ...from.doughIn } : { tempC: 67, durationMin: 60 },
    steps: from ? structuredClone(from.steps) : [rest('Abmaischen', 78, 5)],
  };
}

export function duplicateMashProfile(p: MashProfile): MashProfile {
  return { ...structuredClone(p), id: uid(), name: `${p.name} (Kopie)`, updatedAt: 0 };
}

// "45 °C 15 min → 63 °C 40 min → …"; a decoction is marked, a further charge
// shows its share.
export function mashProfileSummary(p: MashProfile): string {
  const t = (c: number | undefined, m: number) => `${String(c ?? '?').replace('.', ',')} °C ${m} min`;
  return [
    t(p.doughIn.tempC, p.doughIn.durationMin),
    ...p.steps.map((s) => (s.kind === 'doughIn' ? `+${String(s.sharePct).replace('.', ',')} % Schüttung`
      : s.kind === 'decoction' ? `Dekoktion ${t(s.tempC, s.durationMin)}` : t(s.tempC, s.durationMin))),
  ].join(' → ');
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
