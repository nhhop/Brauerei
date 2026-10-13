// Programs a brew lays on the device (Sud 5b). Their steps switch nothing
// (targets {}); they tell the brewer what to do: a step that waits for "Weiter"
// (confirm), or one that reports itself when it begins (notify). The program
// keeps running with the page closed and through a reboot. Pure.
import { heatingOf, type Brewhouse } from './brewhouse';
import type { MashRow } from './mashPlan';
import type { ProgramStep } from './types';

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
    cond: { ref: `sensor/${sensor}`, op: up ? 'gt' : 'lt', value: tempC + (up ? -REACHED_MARGIN_K : REACHED_MARGIN_K), hyst: 0 },
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
