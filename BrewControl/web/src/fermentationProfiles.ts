// Fermentation profiles: phase sequences of the recipe's fermentation tab,
// stored on the SD card as /fermprofiles/<id>.json (global, not per recipe).
// A profile holds the phases and whether they run under pressure; dry hops
// and carbonation stay in the recipe.
import { deleteDoc, listDocs, saveDoc } from './docStore';
import { uid, type Phase, type Recipe } from './recipes';

export type ProfilePhase = Omit<Phase, 'id'>;

export interface FermentationProfile {
  id: string;
  name: string;
  description: string;
  phases: ProfilePhase[];
  pressureFermentation?: true;
  updatedAt: number;
}

const phase = (name: string, tempC: number, duration: number, more: Partial<ProfilePhase> = {}): ProfilePhase =>
  ({ name, tempC, duration, ...more });

const NOTE = 'Richtwerte, an Hefe und Bier anpassen; das Ende der Gärung zeigt die Spindel, nicht der Kalender.';

// Shipped read-only; changing one means duplicating it. Durations in days,
// a ramp is part of its phase. Sources: lager main fermentation 5–8 days at
// 5–12 °C (yumda.com "Hauptgärung", APA-Science "Die Bierhefe"); diacetyl rest
// at about 17–18 °C for 2–3 days near the end, then cooling by about 3 K a day
// and lagering four weeks or longer (byo.com "Diacetyl rest", homebrewing.org
// "Lagering – Chapter 2"); ale at 19–20 °C with a free rise to 21 °C and a
// cold crash at 0–4 °C for 2–5 days (brulosophy.com "Fermentation schedules",
// docs.brewfather.app "Fermentation profiles"); wheat about 20 °C as the
// balance of clove (18–19 °C) and banana (22–25 °C), not crashed so the yeast
// stays in suspension (yeast suppliers' notes, e.g. northernbrewer.com "How to
// ferment with German wheat yeast"); kveik 28–37 °C (Omega Yeast), done within
// two to three days (Garshol/Preiss via milkthefunk.com "Kveik",
// beerandbrewing.com "Ferment hot, fast and clean"); warm pressure fermentation
// of a lager at about 1 bar, raised towards the end (byo.com "Pressurized
// fermentations", brewersfriend.com forum "Spunding valves and diacetyl") —
// TODO(verify) against a brewing textbook (Narziß/Back/Gastl/Zarnkow, "Applied
// Malting and Brewing Science", or Kunze); neither is available online.
export const BUILTIN_FERMENTATION_PROFILES: FermentationProfile[] = [
  {
    id: 'std-lager', name: 'Untergärig klassisch', updatedAt: 0,
    description: `Kalte Hauptgärung bei 9 °C, danach langsam abkühlen und vier Wochen kalt lagern. ${NOTE}`,
    phases: [phase('Hauptgärung', 9, 8), phase('Lagerung', 1, 28, { rampDays: 3 })],
  },
  {
    id: 'std-lager-diacetyl', name: 'Untergärig mit Diacetylrast', updatedAt: 0,
    description: `Hauptgärung bei 10 °C; gegen Ende (etwa 60 % vergoren) auf 17 °C erwärmen, damit die Hefe Diacetyl abbaut, dann in Schritten von etwa 3 K pro Tag abkühlen und lagern. ${NOTE}`,
    phases: [
      phase('Hauptgärung', 10, 7), phase('Diacetylrast', 17, 3, { rampDays: 1 }),
      phase('Lagerung', 1, 28, { rampDays: 5 }),
    ],
  },
  {
    id: 'std-ale', name: 'Obergärig', updatedAt: 0,
    description: `Hauptgärung bei 19 °C, nach der stürmischen Phase auf 21 °C steigen lassen, damit die Hefe sauber endvergärt, dann kalt stellen zum Klären. ${NOTE}`,
    phases: [phase('Hauptgärung', 19, 5), phase('Nachgärung', 21, 4, { rampDays: 1 }), phase('Cold Crash', 2, 3, { rampDays: 1 })],
  },
  {
    id: 'std-weizen', name: 'Weizen', updatedAt: 0,
    description: `Bei 20 °C halten sich Nelke und Banane die Waage; kühler betont die Nelke, wärmer die Banane. Nicht kalt stellen, die Hefe soll in Schwebe bleiben. ${NOTE}`,
    phases: [phase('Hauptgärung', 20, 7)],
  },
  {
    id: 'std-kveik', name: 'Kveik', updatedAt: 0,
    description: `Norwegische Bauernhefe: heiß bei 35 °C anstellen, nach zwei bis drei Tagen vergoren, danach kalt stellen. ${NOTE}`,
    phases: [phase('Hauptgärung', 35, 3), phase('Cold Crash', 2, 2, { rampDays: 1 })],
  },
  {
    id: 'std-druck', name: 'Druckgärung untergärig warm', updatedAt: 0, pressureFermentation: true,
    description: `Untergärige Hefe bei 18 °C unter etwa 1 bar: der Druck bremst Ester und Fuselalkohole, so wird das Bier schneller fertig. Gegen Ende den Druck anheben, dann kalt lagern. Braucht einen druckfesten Gärbehälter mit Spundventil. ${NOTE}`,
    phases: [
      phase('Hauptgärung', 18, 7, { pressureBar: 1 }), phase('Reifung', 18, 3, { pressureBar: 1.5 }),
      phase('Lagerung', 1, 14, { rampDays: 2, pressureBar: 1 }),
    ],
  },
];

// Phases the "+ Phase" menu offers, with the values of the shipped profiles
// (sources above; pitching cool and letting it rise a day is common practice,
// TODO(verify): no source found for the pitching temperatures 8 and 17 °C).
// The label tells top- from bottom-fermenting, the name not.
export const PHASE_PRESETS: { label: string; phase: ProfilePhase }[] = [
  { label: 'Anstellen (untergärig)', phase: phase('Anstellen', 8, 1) },
  { label: 'Anstellen (obergärig)', phase: phase('Anstellen', 17, 1) },
  { label: 'Hauptgärung (untergärig)', phase: phase('Hauptgärung', 10, 7) },
  { label: 'Hauptgärung (obergärig)', phase: phase('Hauptgärung', 19, 5) },
  { label: 'Diacetylrast', phase: phase('Diacetylrast', 17, 3, { rampDays: 1 }) },
  { label: 'Cold Crash', phase: phase('Cold Crash', 2, 3, { rampDays: 1 }) },
  { label: 'Lagerung', phase: phase('Lagerung', 1, 28, { rampDays: 3 }) },
];

export const isBuiltinFermentationProfile =(p: Pick<FermentationProfile, 'id'>) =>
  BUILTIN_FERMENTATION_PROFILES.some((b) => b.id === p.id);

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

// Fills in what a hand-edited file lacks; phases without temperature or
// duration are dropped, a ramp or pressure that is not positive is left out.
export function normalizeFermentationProfile(raw: Partial<FermentationProfile> & { id: string }): FermentationProfile {
  const phases = (Array.isArray(raw.phases) ? raw.phases : [])
    .filter((p) => finite(p?.tempC) && finite(p?.duration))
    .map((p): ProfilePhase => ({
      name: p.name ?? '', tempC: p.tempC, duration: p.duration,
      ...(finite(p.rampDays) && p.rampDays > 0 ? { rampDays: p.rampDays } : {}),
      ...(finite(p.pressureBar) && p.pressureBar > 0 ? { pressureBar: p.pressureBar } : {}),
    }));
  return {
    id: raw.id,
    name: raw.name ?? '',
    description: raw.description ?? '',
    phases,
    ...(raw.pressureFermentation ? { pressureFermentation: true as const } : {}),
    updatedAt: raw.updatedAt ?? 0,
  };
}

type Plan = Pick<Recipe, 'fermentation' | 'pressureFermentation'>;

// The recipe's fermentation with the profile applied: all phases replaced
// (new ids), pressure fermentation set or cleared.
export function applyFermentationProfile(r: Plan, p: FermentationProfile): Plan {
  const fermentation = p.phases.map((x) => ({ id: uid(), ...structuredClone(x) }));
  return { ...r, fermentation, pressureFermentation: p.pressureFermentation ? true : undefined };
}

// The profile content of a recipe; without pressure fermentation the phases'
// pressures are not part of it.
export function profileOfFermentation(r: Plan): Pick<FermentationProfile, 'phases' | 'pressureFermentation'> {
  const phases = r.fermentation.map(({ id: _id, ...x }) => {
    const out = structuredClone(x);
    if (!r.pressureFermentation) delete out.pressureBar;
    return out;
  });
  return { phases, ...(r.pressureFermentation ? { pressureFermentation: true as const } : {}) };
}

export function newFermentationProfile(from?: Pick<FermentationProfile, 'phases' | 'pressureFermentation'>): FermentationProfile {
  return {
    id: uid(), name: '', description: '', updatedAt: 0,
    phases: from ? structuredClone(from.phases) : [phase('Hauptgärung', 19, 7)],
    ...(from?.pressureFermentation ? { pressureFermentation: true as const } : {}),
  };
}

export function duplicateFermentationProfile(p: FermentationProfile): FermentationProfile {
  return { ...structuredClone(p), id: uid(), name: `${p.name} (Kopie)`, updatedAt: 0 };
}

export const totalDays = (p: Pick<FermentationProfile, 'phases'>) => p.phases.reduce((s, x) => s + x.duration, 0);

// Highest pressure of the phases; 0 without pressure fermentation.
export const maxPressureBar = (p: Pick<FermentationProfile, 'phases' | 'pressureFermentation'>) =>
  (p.pressureFermentation ? Math.max(0, ...p.phases.map((x) => x.pressureBar ?? 0)) : 0);

const dec = (n: number) => String(n).replace('.', ',');

// "9 °C 8 d → 1 °C 28 d"; with pressure fermentation the pressure of each phase.
// A phase does not wrap (non-breaking spaces), only at the arrows.
export function fermentationProfileSummary(p: FermentationProfile): string {
  return p.phases.map((x) => [`${dec(x.tempC)} °C`, `${dec(x.duration)} d`,
    ...(p.pressureFermentation && x.pressureBar ? [`${dec(x.pressureBar)} bar`] : [])].join(' ').replace(/ /g, ' '))
    .join(' → ');
}

// ── API ────────────────────────────────────────────────────────────────────────
const BASE = '/api/fermentation-profiles';

// The profiles of the SD card; the shipped ones are not among them.
export const listFermentationProfiles = () =>
  listDocs<FermentationProfile>(BASE, normalizeFermentationProfile, (p) => p.name);
export const saveFermentationProfile = (p: FermentationProfile) => saveDoc(BASE, p);
export const deleteFermentationProfile = (id: string) => deleteDoc(BASE, id);
