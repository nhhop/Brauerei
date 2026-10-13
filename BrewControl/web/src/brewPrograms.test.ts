import { describe, expect, it } from 'vitest';
import { REACHED_MARGIN_K, isRegulated, mashTimerProgram } from './brewPrograms';
import { TEMPLATES } from './brewhouse';
import type { MashRow, Transition } from './mashPlan';
import type { MashStep, MashStepKind } from './recipes';

const tr = (kind: Transition['kind']): Transition => ({ kind, min: 0, text: '' });
const mashRow = (kind: MashStepKind, tempC: number, holdMin: number, p: Partial<MashRow> = {}): MashRow => ({
  step: { id: `${kind}-${tempC}`, kind, name: '' } as MashStep,
  fromC: 0, tempC, startMin: 0, holdMin, transition: tr(kind === 'rest' ? 'heat' : kind === 'strike' ? 'heat' : 'mix'), ...p,
});

// Strike, dough-in at 63 °C for 30 min, rest at 72 °C for 20 min, mash out without a hold.
const rows = [
  mashRow('strike', 70.5, 0, { waterL: 15 }),
  mashRow('doughIn', 63, 30, { grainKg: 5 }),
  mashRow('rest', 72, 20),
  mashRow('rest', 78, 0),
];

describe('mashTimerProgram', () => {
  it('waits for "Weiter" at every move by hand, then holds each rest', () => {
    const p = mashTimerProgram(7, rows, {});
    expect(p.name).toBe('Sud #7 Maischen');
    expect(p.steps.map((s) => s.name)).toEqual([
      'Hauptguss auf 70,5 °C heizen',
      'Einmaischen 5 kg',
      'Rast 63 °C · 30 min',
      'Aufheizen auf 72 °C',
      'Rast 72 °C · 20 min',
      'Aufheizen auf 78 °C',
    ]);
    expect(p.steps.map((s) => s.holdSec)).toEqual([0, 0, 1800, 0, 1200, 0]);
    expect(p.steps.map((s) => !!s.confirm)).toEqual([true, true, false, true, false, true]);
    expect(p.steps.every((s) => Object.keys(s.targets).length === 0 && !s.notify)).toBe(true);
  });

  it('ends heating by a sensor and reports heating and rest', () => {
    const p = mashTimerProgram(7, rows, { strike: 'hlt.temp', mash: 'mash.temp' });
    const [strike, doughIn, rest63, heat72, rest72] = p.steps;
    expect(strike).toMatchObject({ end: 'sensor', notify: true, cond: { ref: 'sensor/hlt.temp', op: 'gt', value: 70.5 - REACHED_MARGIN_K } });
    expect(strike.confirm).toBeUndefined();
    expect(doughIn.confirm).toBe(true);                    // grain goes in by hand
    expect(rest63.notify).toBeUndefined();                 // follows "Weiter"
    expect(heat72).toMatchObject({ end: 'sensor', notify: true, cond: { ref: 'sensor/mash.temp', value: 72 - REACHED_MARGIN_K } });
    expect(rest72.notify).toBe(true);
  });

  it('names the charge only when there are several', () => {
    const two = [rows[1], mashRow('doughIn', 50, 0, { grainKg: 2, chargeName: 'Schüttung 2' })];
    expect(mashTimerProgram(1, [{ ...rows[1], chargeName: 'Schüttung 1' }], {}).steps[0].name).toBe('Einmaischen 5 kg');
    const steps = mashTimerProgram(1, two, {}).steps;
    expect(steps[steps.length - 1].name).toBe('Einmaischen 2 kg (Schüttung 2)');
  });

  it('cools down to a lower rest', () => {
    const p = mashTimerProgram(1, [mashRow('rest', 45, 10, { transition: tr('cool') })], { mash: 'm' });
    expect(p.steps[0]).toMatchObject({ name: 'Abkühlen auf 45 °C', cond: { op: 'lt', value: 45 + REACHED_MARGIN_K } });
  });

  it('names infusions and skips a rest without a change of temperature', () => {
    const p = mashTimerProgram(1, [
      mashRow('infusion', 66, 15, { waterL: 4.25, waterTempC: 95 }),
      mashRow('infusion', 50, 0, { waterL: 1.5, ice: true }),
      mashRow('rest', 50, 10, { transition: tr('none') }),
    ], {});
    expect(p.steps.map((s) => s.name)).toEqual([
      'Zubrühen 4,3 l mit 95 °C', 'Rast 66 °C · 15 min', '1,5 kg Eis zugeben', 'Rast 50 °C · 10 min',
    ]);
  });
});

describe('isRegulated', () => {
  const herms = TEMPLATES.find((t) => t.key === 'herms3')!.build();
  const heaterId = herms.steps.mash!.heaterId!;
  const withHeater = (manual: boolean, controller?: string) =>
    ({ ...herms, devices: herms.devices.map((d) => (d.id === heaterId ? { ...d, manual, controller } : d)) });

  it('needs a heater linked to a controller', () => {
    expect(isRegulated(withHeater(true))).toBe(false);
    expect(isRegulated(withHeater(false, 'hlt'))).toBe(true);
    expect(isRegulated(withHeater(false))).toBe(false);
    expect(isRegulated(undefined)).toBe(false);
  });
});
