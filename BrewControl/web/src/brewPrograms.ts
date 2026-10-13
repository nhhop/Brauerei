// Programs a brew lays on the device (Sud 5b). Their steps switch nothing
// (targets {}); they tell the brewer what to do: a step that waits for "Weiter"
// (confirm), or one that reports itself when it begins (notify). The program
// keeps running with the page closed and through a reboot. Pure.
import { heatingOf, type Brewhouse } from './brewhouse';
import type { CatalogIngredient } from './ingredientCatalog';
import { unitOfEntry } from './ingredientSource';
import type { MashRow } from './mashPlan';
import type { Ingredient, Recipe } from './recipes';
import { entryOf } from './stockLots';
import type { ProgramConfig, ProgramStep } from './types';

// A temperature counts as reached this close to the target. An assumption for
// a mash heated by hand.
export const REACHED_MARGIN_K = 0.5;

// The mash is regulated when its heater is linked to a controller; then the
// course comes from the device log (5b-4) and there is no rest timer.
export function isRegulated(bh: Brewhouse | undefined): boolean {
  const h = bh && heatingOf(bh, 'mash').heater;
  return !!h && !h.manual && !!h.controller;
}

// Sensors of the brewhouse's measurements, for steps that end when reached.
export interface TimerSensors { strike?: string; mash?: string }

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
const fmtC = (c: number) => `${fmt(c)} °C`;

const act = (name: string): ProgramStep => ({ name, targets: {}, holdSec: 0, confirm: true });

// Heating or cooling by hand: waits for "Weiter", or with a sensor ends by
// itself and says so.
function reach(name: string, tempC: number, up: boolean, sensor?: string): ProgramStep {
  if (!sensor) return act(name);
  return {
    name, targets: {}, holdSec: 0, notify: true, end: 'sensor',
    // To 0.1 K, as the step's name shows the temperature (the card prints the threshold).
    cond: { ref: `sensor/${sensor}`, op: up ? 'gt' : 'lt', value: Math.round((tempC + (up ? -REACHED_MARGIN_K : REACHED_MARGIN_K)) * 10) / 10, hyst: 0 },
  };
}

// What the brewer does to get from the row before to this row's temperature.
function moveTo(row: MashRow, sensors: TimerSensors, charges: number): ProgramStep | undefined {
  const t = row.tempC;
  switch (row.step.kind) {
    case 'strike':
      return reach(`Hauptguss auf ${fmtC(t)} heizen`, t, true, sensors.strike);
    case 'doughIn':
      return act(`Einmaischen ${fmt(row.grainKg ?? 0)} kg${charges > 1 && row.chargeName ? ` (${row.chargeName})` : ''}`);
    case 'infusion':
      return act(row.ice ? `${fmt(row.waterL ?? 0)} kg Eis zugeben` : `Zubrühen ${fmt(row.waterL ?? 0)} l mit ${fmtC(row.waterTempC ?? t)}`);
  }
  const d = row.decoction;
  if (d) return act(`Dekoktion: ${fmt(d.volumeL)} l ziehen, kochen, zurück auf ${fmtC(t)}`);
  switch (row.transition.kind) {
    case 'heat': return reach(`Aufheizen auf ${fmtC(t)}`, t, true, sensors.mash);
    case 'cool': return reach(`Abkühlen auf ${fmtC(t)}`, t, false, sensors.mash);
    case 'mix': return act(`Zubrühen ${fmt(row.waterL ?? 0)} l mit ${fmtC(row.waterTempC ?? t)}`);
    default: return undefined;
  }
}

// The rest timer of a mash heated by hand, from the plan's rows (calcMash):
// per row the move to its temperature, then its rest. The end of the last rest
// is the program's end ("Programm fertig").
export function mashTimerProgram(brewNumber: number, rows: MashRow[], sensors: TimerSensors): { name: string; steps: ProgramStep[] } {
  const steps: ProgramStep[] = [];
  const charges = rows.filter((r) => r.step.kind === 'doughIn').length;
  for (const row of rows) {
    const move = moveTo(row, sensors, charges);
    if (move) steps.push(move);
    if (row.holdMin > 0) {
      steps.push({
        name: `Rast ${fmtC(row.tempC)} · ${fmt(row.holdMin)} min`, targets: {}, holdSec: Math.round(row.holdMin * 60),
        // Reached by a sensor: the brewer learns the rest has begun.
        ...(move?.end === 'sensor' && { notify: true }),
      });
    }
  }
  return { name: `Sud #${brewNumber} Maischen`, steps };
}

// ── Boil ─────────────────────────────────────────────────────────────────────

// What goes into the wort from the first wort to the knock-out, plus the dip
// hops, whose wort is drawn off then.
export const BOIL_GROUPS = ['firstWort', 'boil', 'whirlpool', 'hopBack', 'kettleSour', 'dip'] as const;
export type BoilGroup = (typeof BOIL_GROUPS)[number];

export interface BoilAddition {
  row: Ingredient;
  amount: number;   // as used (rowAmounts), else the recipe's
  unit: string;
  group: BoilGroup;
  atMin?: number;   // group boil: minutes before the end, within the boil
}

// The additions in the order they go in: by group, in the boil the longest first.
export function boilAdditions(
  recipe: Pick<Recipe, 'ingredients' | 'boil'>, entries: CatalogIngredient[] | null, rowAmounts?: Record<string, number>,
): BoilAddition[] {
  const total = Math.max(recipe.boil.durationMin, 0);
  const out: BoilAddition[] = [];
  for (const group of BOIL_GROUPS) {
    const rows = recipe.ingredients.filter((i) => i.timing === group).map((row): BoilAddition => ({
      row, group, amount: rowAmounts?.[row.id] ?? row.amount, unit: unitOfEntry(row.kind, entryOf(row, entries)),
      ...(group === 'boil' && { atMin: Math.min(Math.max(row.timeMin ?? total, 0), total) }),
    }));
    out.push(...(group === 'boil' ? rows.sort((a, b) => b.atMin! - a.atMin!) : rows));
  }
  return out;
}

const qty = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');
const listOf = (adds: BoilAddition[]) => adds.map((a) => `${qty(a.amount)} ${a.unit} ${a.row.name}`).join(', ');

// The boil timer, started when the kettle is heated: first wort additions and
// the start of the boil wait for "Weiter". Then one step per moment something
// goes in, as long as the time to the next one; it reports itself and the clock
// keeps running, so a late brewer does not shift what follows. The end of the
// boil waits again, then the whirlpool. Hop back, kettle sour and dip are not
// the timer's.
export function boilTimerProgram(brewNumber: number, boil: Recipe['boil'], additions: BoilAddition[]): { name: string; steps: ProgramStep[] } {
  const of = (g: BoilGroup) => additions.filter((a) => a.group === g);
  const steps: ProgramStep[] = [];
  const firstWort = of('firstWort');
  if (firstWort.length > 0) steps.push(act(`Vorderwürze: ${listOf(firstWort)} zugeben`));
  steps.push(act('Aufheizen – Weiter bei Kochbeginn'));

  const total = Math.max(boil.durationMin, 0);
  const inBoil = of('boil');
  const times = total > 0 ? [...new Set([total, ...inBoil.map((a) => a.atMin!).filter((t) => t > 0)])].sort((a, b) => b - a) : [];
  times.forEach((t, i) => {
    const adds = inBoil.filter((a) => a.atMin === t);
    steps.push({
      name: adds.length > 0 ? `Noch ${fmt(t)} min: ${listOf(adds)} zugeben` : `Kochen · ${fmt(t)} min`,
      targets: {}, holdSec: Math.round((t - (times[i + 1] ?? 0)) * 60),
      // The first follows "Weiter": the brewer is at the kettle.
      ...(i > 0 && { notify: true }),
    });
  });
  const atEnd = inBoil.filter((a) => a.atMin === 0);
  steps.push(act(`Kochende: Heizung aus${atEnd.length > 0 ? `, ${listOf(atEnd)} zugeben` : ''}`));

  const whirlpool = of('whirlpool');
  if (whirlpool.length > 0) {
    steps.push(act(boil.whirlpoolTempC < 100
      ? `Auf ${fmtC(boil.whirlpoolTempC)} kühlen, ${listOf(whirlpool)} zugeben` : `Whirlpool: ${listOf(whirlpool)} zugeben`));
  }
  if (boil.whirlpoolMin > 0) {
    steps.push({ name: `Whirlpool · ${fmt(boil.whirlpoolMin)} min`, targets: {}, holdSec: Math.round(boil.whirlpoolMin * 60) });
  }
  return { name: `Sud #${brewNumber} Kochen`, steps };
}

// Where a running boil timer stands: the time left until the brewer is asked
// again (the end of the boil) or, in the whirlpool, until the program ends, and
// the step that follows the current one.
export interface BoilProgress {
  phase: 'boil' | 'whirlpool';
  remainingSec: number;
  next?: { name: string; inSec: number };
}

export function boilProgress(p: Pick<ProgramConfig, 'steps' | 'status' | 'currentStep' | 'stepRemainingSec'>): BoilProgress | undefined {
  const cur = p.steps[p.currentStep];
  if (p.status !== 'running' || !cur || cur.confirm || cur.end === 'sensor') return undefined;
  const inSec = p.stepRemainingSec ?? cur.holdSec;
  let remainingSec = inSec;
  let j = p.currentStep + 1;
  for (; j < p.steps.length && !p.steps[j].confirm; j++) remainingSec += p.steps[j].holdSec;
  const next = p.steps[p.currentStep + 1];
  return {
    phase: j < p.steps.length ? 'boil' : 'whirlpool', remainingSec,
    ...(next && { next: { name: next.name ?? '', inSec } }),
  };
}
