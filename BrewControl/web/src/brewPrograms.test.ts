import { describe, expect, it } from 'vitest';
import { REACHED_MARGIN_K, boilAdditions, boilProgress, boilTimerProgram, isRegulated, mashTimerProgram } from './brewPrograms';
import { TEMPLATES } from './brewhouse';
import type { MashRow, Transition } from './mashPlan';
import type { Ingredient, MashStep, MashStepKind } from './recipes';
import type { ProgramStatus } from './types';

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

describe('boil timer', () => {
  const boil = { durationMin: 60, whirlpoolTempC: 80, whirlpoolMin: 15 };
  const hop = (id: string, name: string, amount: number, p: Partial<Ingredient> = {}): Ingredient =>
    ({ id, kind: 'hop', name, amount, timing: 'boil', ...p });
  const program = (ingredients: Ingredient[], b = boil, rowAmounts?: Record<string, number>) =>
    boilTimerProgram(7, b, boilAdditions({ ingredients, boil: b }, null, rowAmounts));

  it('counts the boil in the times between the additions', () => {
    const p = program([hop('a', 'Magnum', 18, { timeMin: 60 }), hop('b', 'Citra', 20, { timeMin: 10 }), hop('c', 'Saaz', 15, { timeMin: 0 })]);
    expect(p.name).toBe('Sud #7 Kochen');
    expect(p.steps.map((s) => s.name)).toEqual([
      'Aufheizen – Weiter bei Kochbeginn',
      'Noch 60 min: 18 g Magnum zugeben',
      'Noch 10 min: 20 g Citra zugeben',
      'Kochende: Heizung aus, 15 g Saaz zugeben',
      'Whirlpool · 15 min',
    ]);
    expect(p.steps.map((s) => s.holdSec)).toEqual([0, 3000, 600, 0, 900]);
    expect(p.steps.map((s) => !!s.confirm)).toEqual([true, false, false, true, false]);
    // The first follows "Weiter"; a later one reports itself and holds nothing up.
    expect(p.steps.map((s) => !!s.notify)).toEqual([false, false, true, false, false]);
    expect(p.steps.every((s) => Object.keys(s.targets).length === 0)).toBe(true);
  });

  it('asks for the first wort hops first and for the whirlpool hops after the boil', () => {
    const p = program([
      hop('w', 'Citra', 40, { timing: 'whirlpool' }), hop('f', 'Tettnanger', 20, { timing: 'firstWort' }), hop('b', 'Citra', 20, { timeMin: 10 }),
    ]);
    expect(p.steps.map((s) => s.name)).toEqual([
      'Vorderwürze: 20 g Tettnanger zugeben',
      'Aufheizen – Weiter bei Kochbeginn',
      'Kochen · 60 min',
      'Noch 10 min: 20 g Citra zugeben',
      'Kochende: Heizung aus',
      'Auf 80 °C kühlen, 40 g Citra zugeben',
      'Whirlpool · 15 min',
    ]);
    expect(p.steps.map((s) => !!s.confirm)).toEqual([true, true, false, false, true, true, false]);
    expect(p.steps[2].holdSec + p.steps[3].holdSec).toBe(3600);
  });

  it('puts additions at the same time into one step', () => {
    const p = program([hop('a', 'Citra', 20, { timeMin: 10 }), hop('b', 'Saaz', 15, { timeMin: 10 }),
      { id: 'm', kind: 'auxiliary', name: 'Irish Moss', amount: 2.5, timing: 'boil', timeMin: 10 }]);
    expect(p.steps[2].name).toBe('Noch 10 min: 20 g Citra, 15 g Saaz, 2,5 g Irish Moss zugeben');
    expect(p.steps.filter((s) => s.name!.startsWith('Noch'))).toHaveLength(1);
  });

  it('takes an addition without a time, or beyond the boil, at its start', () => {
    const p = program([hop('a', 'Magnum', 18), hop('b', 'Perle', 10, { timeMin: 90 }),
      { id: 's', kind: 'fermentable', name: 'Zucker', amount: 0.25, timing: 'boil' }]);
    expect(p.steps[1]).toMatchObject({ name: 'Noch 60 min: 18 g Magnum, 10 g Perle, 0,25 kg Zucker zugeben', holdSec: 3600 });
  });

  it('names the amount actually used', () => {
    expect(program([hop('a', 'Magnum', 18)], boil, { a: 21.5 }).steps[1].name).toBe('Noch 60 min: 21,5 g Magnum zugeben');
  });

  it('ends at the end of the boil without a whirlpool, and leaves hop back and dip to the list', () => {
    const b = { durationMin: 90, whirlpoolTempC: 100, whirlpoolMin: 0 };
    const rows = [hop('h', 'Saaz', 30, { timing: 'hopBack' }), hop('d', 'Mosaic', 30, { timing: 'dip' })];
    expect(program(rows, b).steps.map((s) => s.name)).toEqual(['Aufheizen – Weiter bei Kochbeginn', 'Kochen · 90 min', 'Kochende: Heizung aus']);
    expect(boilAdditions({ ingredients: rows, boil: b }, null).map((a) => a.group)).toEqual(['hopBack', 'dip']);
    expect(program([hop('w', 'Citra', 40, { timing: 'whirlpool' })], b).steps.pop()!.name).toBe('Whirlpool: 40 g Citra zugeben');
  });

  it('lists the additions by group, in the boil the longest first', () => {
    const adds = boilAdditions({ boil, ingredients: [
      hop('b', 'Citra', 20, { timeMin: 10 }), hop('w', 'Citra', 40, { timing: 'whirlpool' }), hop('a', 'Magnum', 18),
      hop('f', 'Tettnanger', 20, { timing: 'firstWort' }), hop('x', 'Stopfhopfen', 50, { timing: 'primary' }),
    ] }, null);
    expect(adds.map((a) => [a.row.id, a.group, a.atMin])).toEqual([
      ['f', 'firstWort', undefined], ['a', 'boil', 60], ['b', 'boil', 10], ['w', 'whirlpool', undefined],
    ]);
  });

  describe('boilProgress', () => {
    const { steps } = program([hop('f', 'Tettnanger', 20, { timing: 'firstWort' }), hop('b', 'Citra', 20, { timeMin: 10 })]);
    const at = (currentStep: number, stepRemainingSec?: number, status: ProgramStatus = 'running') =>
      boilProgress({ steps, status, currentStep, stepRemainingSec });

    it('gives the time to the end of the boil and the next addition', () => {
      expect(at(2, 1200)).toEqual({ phase: 'boil', remainingSec: 1800, next: { name: 'Noch 10 min: 20 g Citra zugeben', inSec: 1200 } });
      expect(at(3, 90)).toEqual({ phase: 'boil', remainingSec: 90, next: { name: 'Kochende: Heizung aus', inSec: 90 } });
    });

    it('counts the whirlpool to the end of the program', () => {
      expect(at(5, 600)).toEqual({ phase: 'whirlpool', remainingSec: 600 });
    });

    it('has nothing to count while the program waits or stands', () => {
      expect(at(1, undefined, 'awaiting')).toBeUndefined();
      expect(at(2, 1200, 'paused')).toBeUndefined();
      expect(at(0, 0, 'idle')).toBeUndefined();
    });
  });
});
