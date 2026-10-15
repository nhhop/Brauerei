// Volume chain of a recipe from the knock-out to the containers (tab "Gärung")
// and its carbonation. Pure, like recipeWater.ts.
import { forcedCarbonationBar, krausenRackingPlato, primingSugarGrams, residualCo2Volumes } from './brewMath';
import type { Brewhouse } from './brewhouse';
import type { Container, Fermenter } from './cellar';
import type { CatalogIngredient } from './ingredientCatalog';
import type { BottlingRow, HopForm, Ingredient, Phase, Recipe } from './recipes';
import { fermenterIntake, pitchL, type DilutionResult, type Intake } from './recipeWater';
import { hopFormOf } from './stockLots';

// Wort a gram of hops holds back (ml/g), in the kettle and in the fermenter.
// TODO(verify): rules of thumb only (about 5–6 ml/g for cones in homebrewing
// forums; pellets less, extract nothing); no measured source yet.
export const KETTLE_HOP_ML_PER_G: Record<HopForm, number> = { cone: 8, t90: 5, t45: 4, lupulin: 3, extract: 0 };
export const DRY_HOP_ML_PER_G: Record<HopForm, number> = { cone: 7, t90: 5, t45: 4, lupulin: 3, extract: 0 };

const KETTLE_HOP_TIMINGS: Ingredient['timing'][] = ['firstWort', 'boil', 'whirlpool', 'hopBack'];
const FERMENTER_HOP_TIMINGS: Ingredient['timing'][] = ['dip', 'primary', 'maturation'];

function hopL(recipe: Recipe, entries: CatalogIngredient[] | null, timings: Ingredient['timing'][], mlPerG: Record<HopForm, number>): number {
  return recipe.ingredients
    .filter((i) => i.kind === 'hop' && timings.includes(i.timing))
    .reduce((l, i) => l + (i.amount * mlPerG[hopFormOf(i, entries)]) / 1000, 0);
}

// Hops in the kettle (first wort to hop back) and in the fermenter (dip, dry hopping).
export const kettleHopL = (recipe: Recipe, entries: CatalogIngredient[] | null) => hopL(recipe, entries, KETTLE_HOP_TIMINGS, KETTLE_HOP_ML_PER_G);
export const dryHopL = (recipe: Recipe, entries: CatalogIngredient[] | null) => hopL(recipe, entries, FERMENTER_HOP_TIMINGS, DRY_HOP_ML_PER_G);

// The highest phase temperature sets the CO₂ left in the young beer (a
// diacetyl rest is assumed to follow the end of the fermentation); the last
// phase is the storage temperature of a forced carbonation.
export const residualTempC = (r: Pick<Recipe, 'fermentation'>) =>
  r.fermentation.length ? Math.max(...r.fermentation.map((p) => p.tempC)) : undefined;
export const storageTempC = (r: Pick<Recipe, 'fermentation'>) => r.fermentation[r.fermentation.length - 1]?.tempC;

// What leaves the wort between knock-out and containers besides the
// brewhouse's losses; recipeWater.resolveDilution takes it into account.
export interface WortDraw {
  kettleHopL: number;
  dryHopL: number;
  trubL: number;
  // Carbonation with Speise: wort set aside at the knock-out, at its gravity.
  speise?: { targetVol: number; tempC?: number; attenuationPct?: number };
}

// `attenuationPct` is the yeast's (recipeStats.yeastAttenuation).
export function wortDraw(recipe: Recipe, entries: CatalogIngredient[] | null, attenuationPct: number | undefined): WortDraw {
  const c = recipe.carbonation;
  return {
    kettleHopL: kettleHopL(recipe, entries),
    dryHopL: dryHopL(recipe, entries),
    trubL: recipe.trubLossL ?? 0,
    speise: c?.method === 'speise' ? { targetVol: c.targetVol, tempC: residualTempC(recipe), attenuationPct } : undefined,
  };
}

export interface BottlingLine {
  row: BottlingRow;
  container?: Container;  // unset = deleted since, or the list did not load
  count: number;
  rest: boolean;          // the count follows from what is left
}

export interface Bottling {
  intake: Intake;         // knock-out to what reaches the fermenter
  speiseL: number;
  dilutionL: number;      // in the fermenter; one in the kettle is part of the knock-out
  pitchL: number;         // Anstellwürze
  trubL: number;
  dryHopL: number;
  youngL: number;         // Jungbier
  beerL: number;          // young beer plus Speise, ready to fill
  lines: BottlingLine[];
  fillLossL: number;
  bottledL: number;
  leftL: number;          // beer that fits no container of the plan
  bottles: number;
  kegs: number;
  notes: string[];
}

// `containers` null = not loaded.
export function calcBottling(recipe: Recipe, bh: Brewhouse, dilution: DilutionResult, draw: WortDraw, containers: Container[] | null): Bottling {
  const notes: string[] = [];
  const intake = fermenterIntake(recipe, bh, draw.kettleHopL);
  const dilutionL = dilution.at === 'fermenter' ? dilution.volumeL : 0;
  const pitch = pitchL(dilution);
  const youngL = pitch - draw.trubL - draw.dryHopL;
  const beerL = Math.max(youngL + dilution.speiseL, 0);
  if (youngL < 0) notes.push('Trub und Stopfhopfen nehmen mehr auf, als angestellt wird.');

  const rows = recipe.bottling?.containers ?? [];
  if (rows.length > 0 && !containers) notes.push('Gebinde nicht geladen, Abfüllverluste nicht eingerechnet.');
  let left = beerL;
  let fillLossL = 0;
  let filledL = 0;
  const lines = rows.map((row, i): BottlingLine => {
    const container = containers?.find((c) => c.id === row.containerId);
    if (containers && !container) notes.push(`Das Gebinde „${row.containerId}“ gibt es nicht mehr.`);
    const loss = container?.fillLossL ?? 0;
    const per = container ? container.sizeL + loss : 0;
    const rest = row.count === undefined && i === rows.length - 1;
    const count = !container ? 0 : rest ? (per > 0 ? Math.floor(Math.max(left, 0) / per + 1e-9) : 0) : row.count ?? 0;
    left -= count * per;
    fillLossL += count * loss;
    filledL += count * (container?.sizeL ?? 0);
    return { row, container, count, rest };
  });
  if (left < -1e-9) notes.push(`Die Gebinde fassen ${(-left).toFixed(1).replace('.', ',')} l mehr, als abgefüllt wird.`);
  const bottledL = lines.length > 0 ? Math.min(filledL, beerL - fillLossL) : beerL;
  const countOf = (kind: Container['kind']) => lines.reduce((n, l) => n + (l.container?.kind === kind ? l.count : 0), 0);
  return {
    intake, speiseL: dilution.speiseL, dilutionL, pitchL: pitch, trubL: draw.trubL, dryHopL: draw.dryHopL, youngL, beerL,
    lines, fillLossL, bottledL, leftL: Math.max(beerL - fillLossL - bottledL, 0),
    bottles: countOf('bottle'), kegs: countOf('keg'), notes,
  };
}

export interface CarbonationResult {
  residualVol?: number;
  residualTempC?: number;
  sugarG?: number;
  speiseL?: number;
  rackingPlato?: number;  // Grünschlauchen: apparent extract to rack at
  pressureBar?: number;   // forced: gauge pressure at the storage temperature
  storageTempC?: number;
  notes: string[];
}

// Unset without a planned carbonation. `fgPlato` from recipeStats, `speiseL`
// from the dilution (recipeWater.resolveDilution).
export function calcCarbonation(recipe: Recipe, p: { beerL: number; fgPlato?: number; speiseL: number }): CarbonationResult | undefined {
  const c = recipe.carbonation;
  if (!c) return undefined;
  const notes: string[] = [];
  const tempC = residualTempC(recipe);
  const out: CarbonationResult = { notes, residualTempC: tempC };
  if (tempC === undefined && c.method !== 'forced') {
    notes.push('Die Restkohlensäure braucht die Gärphasen.');
    return out;
  }
  if (tempC !== undefined) out.residualVol = residualCo2Volumes(tempC);
  if (c.method === 'sugar') out.sugarG = primingSugarGrams(p.beerL, c.targetVol, tempC!, c.sugarType ?? 'saccharose');
  if (c.method === 'speise') {
    out.speiseL = p.speiseL;
    if (p.speiseL <= 0) notes.push('Die Speise braucht Stammwürze und eine Hefe mit Endvergärungsgrad.');
  }
  if (c.method === 'krausen') {
    if (p.fgPlato === undefined) notes.push('Grünschlauchen braucht den Restextrakt (Hefe verknüpfen).');
    else out.rackingPlato = krausenRackingPlato(p.fgPlato, c.targetVol, tempC!);
  }
  if (c.method === 'forced') {
    out.storageTempC = storageTempC(recipe);
    if (out.storageTempC === undefined) notes.push('Der Druck braucht die Gärphasen (Temperatur der letzten).');
    else out.pressureBar = forcedCarbonationBar(c.targetVol, out.storageTempC);
  }
  return out;
}

// Highest pressure the phases ask for; 0 without pressure fermentation.
export function maxPhasePressureBar(recipe: Recipe): number {
  if (!recipe.pressureFermentation) return 0;
  return Math.max(0, ...recipe.fermentation.map((p) => p.pressureBar ?? 0));
}

// ── Brew (5c-2) ─────────────────────────────────────────────────────────────────

const DAY_MS = 86400000;

export interface ScheduledPhase {
  phase: Phase;
  fromDay: number;        // days after pitching
  toDay: number;
  fromAt?: number;        // epoch ms, once pitched
  toAt?: number;
  state?: 'done' | 'current' | 'next';  // unset before pitching
}

// The recipe's phases one after the other from the pitching; a ramp counts
// within its phase's duration.
export function fermentationSchedule(phases: Phase[], pitchedAt: number | undefined, now: number): ScheduledPhase[] {
  let day = 0;
  return phases.map((phase) => {
    const fromDay = day;
    day += Math.max(phase.duration || 0, 0);
    const out: ScheduledPhase = { phase, fromDay, toDay: day };
    if (pitchedAt !== undefined) {
      out.fromAt = pitchedAt + fromDay * DAY_MS;
      out.toAt = pitchedAt + day * DAY_MS;
      out.state = now >= out.toAt ? 'done' : now >= out.fromAt ? 'current' : 'next';
    }
    return out;
  });
}

// The temperature line the phases ask for, x in days after pitching. The line
// is the one fermentationProgram sets on the device (brewPrograms.ts): the first
// phase does not ramp, a later one runs linearly from the one before over
// `rampDays` (at most its duration), a phase without a duration is not on it.
// A jump gets a second of its own, so each x is there once.
export function fermentSollCourse(phases: Phase[]): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const point = (x: number, y: number) => {
    xs.push(xs.length > 0 && x <= xs[xs.length - 1] ? xs[xs.length - 1] + 1 / 86400 : x);
    ys.push(y);
  };
  let day = 0;
  phases.forEach((p) => {
    const d = Math.max(p.duration || 0, 0);
    if (d <= 0) return;
    const ramp = xs.length === 0 ? 0 : Math.min(Math.max(p.rampDays ?? 0, 0), d);
    point(day + ramp, p.tempC);
    if (ramp < d) point(day + d, p.tempC);
    day += d;
  });
  return { xs, ys };
}

// A phase this far off the fermenter's surroundings needs cooling or heating.
export const AMBIENT_TOLERANCE_K = 2;

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

// What speaks against a fermenter for this brew; nothing is blocked.
export function fermenterHints(f: Fermenter, recipe: Recipe, pitchedL: number | undefined): string[] {
  const hints: string[] = [];
  if (pitchedL !== undefined && pitchedL > f.volumeL) {
    hints.push(`Die Anstellwürze (${fmt(pitchedL)} l) ist größer als der Gärplatz (${fmt(f.volumeL)} l).`);
  }
  const bar = maxPhasePressureBar(recipe);
  if (bar > (f.maxPressureBar ?? 0)) {
    hints.push(f.maxPressureBar
      ? `Das Rezept vergärt unter ${fmt(bar)} bar, der Gärplatz ist nur bis ${fmt(f.maxPressureBar)} bar druckfest.`
      : `Das Rezept vergärt unter ${fmt(bar)} bar, der Gärplatz ist nicht druckfest.`);
  }
  const ambient = f.ambientTempC;
  if (ambient !== undefined) {
    const cools = f.tempering === 'cool' || f.tempering === 'both';
    const heats = f.tempering === 'heat' || f.tempering === 'both';
    for (const p of recipe.fermentation) {
      const need = p.tempC < ambient - AMBIENT_TOLERANCE_K && !cools ? 'Kühlen'
        : p.tempC > ambient + AMBIENT_TOLERANCE_K && !heats ? 'Heizen' : undefined;
      if (need) {
        hints.push(`${p.name || 'Phase'} (${fmt(p.tempC)} °C) braucht ${need} bei ${fmt(ambient)} °C Umgebung, der Gärplatz kann es nicht.`);
      }
    }
  }
  return hints;
}
