// Programs a brew lays on the device (Sud 5b). They tell the brewer what to do:
// a step that waits for "Weiter" (confirm), or one that reports itself when it
// begins (notify). Their steps switch nothing (targets {}), except in a
// regulated mash, where they set the controller's setpoints. The program keeps
// running with the page closed and through a reboot. Pure.
import { decoctionVesselOf, heatingOf, type Brewhouse, type Device } from './brewhouse';
import type { CatalogIngredient } from './ingredientCatalog';
import { unitOfEntry } from './ingredientSource';
import type { MashRow } from './mashPlan';
import { programIds } from './program';
import type { Decoction, Ingredient, Recipe } from './recipes';
import { entryOf } from './stockLots';
import type { Controller, ProgramConfig, ProgramStep, Snapshot } from './types';

// A temperature counts as reached this close to the target. An assumption.
export const REACHED_MARGIN_K = 0.5;

// The mash is regulated when its heater is linked to a controller; then the
// program sets that controller's setpoints (mashControlOf). Not when it is
// heated by infusion: there the controller keeps the water hot, not the mash.
export function isRegulated(bh: Brewhouse | undefined): boolean {
  const { heater: h, via } = bh ? heatingOf(bh, 'mash') : { heater: undefined, via: undefined };
  return !!h && !h.manual && !!h.controller && via !== 'infusion';
}

// Sensors of the brewhouse's measurements, for steps that end when reached.
export interface TimerSensors { strike?: string; mash?: string }

// What the program drives in a regulated mash.
export interface MashControl {
  controller: string;       // of the mash's heater
  sensor?: string;          // the sensor it regulates on
  strike: boolean;          // the strike water's heater hangs on the same controller
  boilC: number;            // the decoction vessel's setpoint while it boils
  decoction?: { controller: string; sensor?: string };  // the decoction vessel's heater has its own
}

// Undefined when the mash is not regulated or its controller is not in the registry.
export function mashControlOf(bh: Brewhouse | undefined, snap: Snapshot | null, boilC: number): MashControl | undefined {
  if (!bh || !snap || !isRegulated(bh)) return undefined;
  const controllerOf = (d: Device | undefined) => (d && !d.manual ? snap.controllers.find((c) => c.id === d.controller) : undefined);
  // A controller names its sensor by the bare id and reads its first channel.
  const sensorOf = (c: Controller) => {
    const id = c.params?.sensor;
    return id ? snap.sensors.find((s) => s.id === id || s.id.startsWith(`${id}.`))?.id : undefined;
  };
  const mash = controllerOf(heatingOf(bh, 'mash').heater);
  if (!mash) return undefined;
  const kettle = controllerOf(decoctionVesselOf(bh)?.heater);
  return {
    controller: mash.id, sensor: sensorOf(mash), boilC,
    // Without a step of its own the strike water is heated where the mash is.
    strike: controllerOf(heatingOf(bh, bh.steps.strike ? 'strike' : 'mash').heater)?.id === mash.id,
    ...(kettle && kettle.id !== mash.id && { decoction: { controller: kettle.id, sensor: sensorOf(kettle) } }),
  };
}

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
const fmtC = (c: number) => `${fmt(c)} °C`;

const act = (name: string): ProgramStep => ({ name, targets: {}, holdSec: 0, confirm: true });

const DOUGH_IN = 'Einmaischen';  // how a dough-in step's name begins (mashedInAt)

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
      return act(`${DOUGH_IN} ${fmt(row.grainKg ?? 0)} kg${charges > 1 && row.chargeName ? ` (${row.chargeName})` : ''}`);
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

// Whether the row's temperature is reached by its heater, not by a handgrip.
const byHeater = (row: MashRow) => row.step.kind === 'strike' || (row.step.kind !== 'doughIn' && row.step.kind !== 'infusion'
  && !row.decoction && (row.transition.kind === 'heat' || row.transition.kind === 'cool'));

type Targets = ProgramStep['targets'];
// A setpoint, to 0.1 K as the steps' names show it. It switches the controller on.
const on = (controller: string, tempC: number): Targets => ({ [controller]: { v: Math.round(tempC * 10) / 10, enabled: true } });
// A step the controller works through by itself has nothing to report.
const quiet = ({ notify: _, ...step }: ProgramStep): ProgramStep => step;

// A decoction in a regulated mash: pulled by hand, then its own course in the
// decoction vessel, whose controller (if it has one) gets the setpoints. The
// mash left behind is not heated meanwhile, as the plan computes it, unless
// the recipe has it held. A rest whose time counts from the start of heating
// (`rampInRest`) sets its temperature itself, there is no step to heat to it.
function decoctionSteps(row: MashRow, c: MashControl): ProgramStep[] {
  const d: Pick<Decoction, 'rests' | 'boilMin' | 'holdRest'> = row.step.decoction ?? { rests: [], boilMin: 0 };
  const k = c.decoction;
  const ramp = !!row.decoction!.rampInRest;
  const kettle = (tempC: number): Targets => (k ? on(k.controller, tempC) : {});
  const steps = [act(`Dekoktion: ${fmt(row.decoction!.volumeL)} l in ${row.decoction!.vessel} ziehen`)];
  let t = row.fromC;
  for (const r of d.rests) {
    const heated = r.tempC > t;
    if (heated) {
      if (!ramp) steps.push({ ...quiet(reach(`Teilmaische auf ${fmtC(r.tempC)} heizen`, r.tempC, true, k?.sensor)), targets: kettle(r.tempC) });
      t = r.tempC;
    }
    if (r.durationMin > 0) {
      steps.push({
        name: `Teilmaische Rast ${fmtC(t)} · ${fmt(r.durationMin)} min`, targets: heated && ramp ? kettle(t) : {}, holdSec: Math.round(r.durationMin * 60),
        // Reached by a sensor, or to be heated by hand from here on.
        ...(heated && (ramp ? !k : k?.sensor) && { notify: true }),
      });
    }
  }
  // A sensor near the boiling point is no safe end, so the brewer says when it boils.
  steps.push({ ...act('Teilmaische – Weiter bei Kochbeginn'), targets: kettle(c.boilC) });
  if (d.boilMin > 0) steps.push({ name: `Teilmaische kochen · ${fmt(d.boilMin)} min`, targets: {}, holdSec: Math.round(d.boilMin * 60) });
  steps.push(act('Teilmaische zurückgeben'));
  if (!d.holdRest) steps[1] = { ...steps[1], targets: { [c.controller]: { enabled: false }, ...steps[1].targets } };
  return steps;
}

// The mash program, from the plan's rows (calcMash): per row the move to its
// temperature, then its rest.
//
// Heated by hand (no `control`) it is a rest timer that switches nothing; the
// end of the last rest is the program's end ("Programm fertig").
//
// Regulated, the steps set the controller's setpoint: heating and cooling when
// they begin. A step that waits for "Weiter" sets nothing, so the temperature
// before it is held; what the handgrip leads to is set by the step after. At
// the end the last setpoint is held until "Weiter", then the controllers go off.
export function mashTimerProgram(
  brewNumber: number, rows: MashRow[], sensors: TimerSensors, control?: MashControl,
): { name: string; steps: ProgramStep[] } {
  const steps: ProgramStep[] = [];
  const charges = rows.filter((r) => r.step.kind === 'doughIn').length;
  let pending: Targets | undefined;  // regulated: what the next step sets
  const push = (step: ProgramStep) => {
    steps.push(pending ? { ...step, targets: { ...pending, ...step.targets } } : step);
    pending = undefined;
  };
  rows.forEach((row, i) => {
    // A rest whose time counts from the start of the transition has no step
    // for it: the rest sets its temperature, by hand it says that it begins.
    const ramped = !!row.rampInRest;
    let move = ramped ? undefined : moveTo(row, sensors, charges);
    if (control && row.decoction) {
      decoctionSteps(row, control).forEach(push);
      pending = { ...on(control.controller, row.tempC), ...(control.decoction && { [control.decoction.controller]: { enabled: false } }) };
      move = undefined;
    } else if (control && move) {
      const strike = row.step.kind === 'strike';
      if (byHeater(row) && (!strike || control.strike)) {
        // The strike water is held until the brewer is there to mash in.
        move = { ...quiet(move), targets: on(control.controller, row.tempC), ...(strike && { confirm: true }) };
        push(move);
      } else if (control.strike && rows[i - 1]?.step.kind === 'strike') {
        // Follows the "Weiter" of the strike water: the mash's temperature from here on.
        push({ ...move, targets: on(control.controller, row.tempC) });
      } else {
        push(move);
        // Strike water heated by hand: the controller only comes on with the mash.
        if (!strike) pending = on(control.controller, row.tempC);
      }
    } else if (move) {
      push(move);
    }
    const restMin = ramped ? row.step.durationMin ?? 0 : row.holdMin;
    if (restMin > 0) {
      push({
        name: `Rast ${fmtC(row.tempC)} · ${fmt(restMin)} min`, holdSec: Math.round(restMin * 60),
        targets: ramped && control ? on(control.controller, row.tempC) : {},
        // Reached by a sensor: the brewer learns the rest has begun.
        ...((ramped ? !control : move?.end === 'sensor') && { notify: true }),
      });
    }
  });
  if (control) {
    push(act('Maischen beendet – Weiter: Regler aus'));
    steps.push({ name: 'Regler aus', targets: Object.fromEntries(programIds(steps).map((id) => [id, { enabled: false }])), holdSec: 0 });
  }
  return { name: `Sud #${brewNumber} Maischen`, steps };
}

// When the grain went in, by a mash program (epoch ms): the start of the step
// after the first dough-in, as long as the program stands in that step.
export function mashedInAt(p: Pick<ProgramConfig, 'steps' | 'status' | 'currentStep' | 'stepStartedEpoch'>): number | undefined {
  const i = p.steps.findIndex((s) => s.name?.startsWith(DOUGH_IN));
  const active = p.status === 'running' || p.status === 'awaiting' || p.status === 'paused';
  return i >= 0 && active && p.currentStep === i + 1 && p.stepStartedEpoch > 0 ? p.stepStartedEpoch * 1000 : undefined;
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
