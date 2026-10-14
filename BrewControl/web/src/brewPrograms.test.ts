import { describe, expect, it } from 'vitest';
import {
  REACHED_MARGIN_K, boilAdditions, boilProgress, boilTimerProgram, isRegulated, mashControlOf, mashTimerProgram, mashedInAt, type MashControl,
} from './brewPrograms';
import { TEMPLATES, type Brewhouse } from './brewhouse';
import type { MashRow, Transition } from './mashPlan';
import type { Ingredient, MashStep, MashStepKind } from './recipes';
import type { ProgramStatus, ProgramStep, Snapshot } from './types';

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

  it('rounds the threshold of a computed temperature to 0.1 K', () => {
    const p = mashTimerProgram(1, [mashRow('strike', 23.26841, 0)], { strike: 'hlt' });
    expect(p.steps[0].cond?.value).toBe(22.8);
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

describe('regulated mash program', () => {
  const control: MashControl = { controller: 'mash', sensor: 'pot', strike: true, boilC: 100 };
  const sensors = { strike: 'pot', mash: 'pot' };
  const set = (v: number) => ({ mash: { v, enabled: true } });
  const targets = (steps: ProgramStep[]) => steps.map((s) => s.targets);

  it('sets the setpoints, waits for the sensor and switches off after "Weiter"', () => {
    const p = mashTimerProgram(7, rows, sensors, control);
    expect(p.name).toBe('Sud #7 Maischen');
    expect(p.steps.map((s) => s.name)).toEqual([
      'Hauptguss auf 70,5 °C heizen',
      'Einmaischen 5 kg',
      'Rast 63 °C · 30 min',
      'Aufheizen auf 72 °C',
      'Rast 72 °C · 20 min',
      'Aufheizen auf 78 °C',
      'Maischen beendet – Weiter: Regler aus',
      'Regler aus',
    ]);
    expect(targets(p.steps)).toEqual([set(70.5), set(63), {}, set(72), {}, set(78), {}, { mash: { enabled: false } }]);
    expect(p.steps.map((s) => !!s.confirm)).toEqual([true, true, false, false, false, false, true, false]);
    expect(p.steps.map((s) => s.holdSec)).toEqual([0, 0, 1800, 0, 1200, 0, 0, 0]);
    const [strike, , , heat72, rest72] = p.steps;
    // The strike water is held at its temperature until the brewer is there.
    expect(strike).toMatchObject({ end: 'sensor', cond: { ref: 'sensor/pot', op: 'gt', value: 70 } });
    expect(heat72).toMatchObject({ end: 'sensor', cond: { ref: 'sensor/pot', op: 'gt', value: 72 - REACHED_MARGIN_K } });
    // Only the rests report themselves: there is nothing to do while the controller heats.
    expect(p.steps.map((s) => !!s.notify)).toEqual([false, false, false, false, true, false, false, false]);
    expect(rest72.notify).toBe(true);
  });

  it('leaves strike water heated by hand alone and switches on after mashing in', () => {
    const p = mashTimerProgram(7, rows, { mash: 'pot' }, { ...control, strike: false });
    expect(targets(p.steps).slice(0, 4)).toEqual([{}, {}, set(63), set(72)]);
    expect(p.steps[0]).toMatchObject({ name: 'Hauptguss auf 70,5 °C heizen', confirm: true });
  });

  it('holds the temperature while a handgrip waits and sets the new one after it', () => {
    const p = mashTimerProgram(1, [
      rows[1],
      mashRow('infusion', 72, 15, { waterL: 4, waterTempC: 95 }),
      mashRow('infusion', 50, 0, { waterL: 1.5, ice: true }),
      mashRow('rest', 50, 10, { transition: tr('none') }),
    ], sensors, control);
    expect(p.steps.map((s) => s.name).slice(0, 6)).toEqual([
      'Einmaischen 5 kg', 'Rast 63 °C · 30 min', 'Zubrühen 4 l mit 95 °C', 'Rast 72 °C · 15 min', '1,5 kg Eis zugeben', 'Rast 50 °C · 10 min',
    ]);
    expect(targets(p.steps).slice(0, 6)).toEqual([{}, set(63), {}, set(72), {}, set(50)]);
  });

  it('sets what a handgrip without a rest leads to with the step after it', () => {
    const p = mashTimerProgram(1, [mashRow('doughIn', 63, 0, { grainKg: 5 })], sensors, control);
    expect(p.steps.map((s) => s.name)).toEqual(['Einmaischen 5 kg', 'Maischen beendet – Weiter: Regler aus', 'Regler aus']);
    expect(targets(p.steps)).toEqual([{}, set(63), { mash: { enabled: false } }]);
  });

  it('sets a lower setpoint when cooling begins', () => {
    const p = mashTimerProgram(1, [mashRow('rest', 45, 10, { transition: tr('cool') })], sensors, control);
    expect(p.steps[0]).toMatchObject({ name: 'Abkühlen auf 45 °C', targets: set(45), cond: { op: 'lt', value: 45 + REACHED_MARGIN_K } });
  });

  it('lets a rest that counts its heating set the temperature and run its whole time', () => {
    // 20 min from the start of heating, 14 of them at 72 °C.
    const ramped = mashRow('rest', 72, 14, { rampInRest: true, step: { id: 'r', kind: 'rest', name: '', tempC: 72, durationMin: 20 } });
    const names = ['Einmaischen 5 kg', 'Rast 63 °C · 30 min', 'Rast 72 °C · 20 min'];
    const p = mashTimerProgram(1, [rows[1], ramped], sensors, control);
    expect(p.steps.map((s) => s.name).slice(0, 3)).toEqual(names);
    expect(p.steps[2]).toMatchObject({ targets: set(72), holdSec: 1200 });
    expect(p.steps[2].notify).toBeUndefined();
    // By hand the rest says that it begins, so the brewer heats.
    const hand = mashTimerProgram(1, [rows[1], ramped], { mash: 'pot' });
    expect(hand.steps.map((s) => s.name)).toEqual(names);
    expect(hand.steps[2]).toMatchObject({ targets: {}, holdSec: 1200, notify: true });
  });

  it('waits for "Weiter" where no sensor ends the heating', () => {
    const p = mashTimerProgram(1, [rows[2]], {}, control);
    expect(p.steps[0]).toMatchObject({ name: 'Aufheizen auf 72 °C', targets: set(72), confirm: true });
    expect(p.steps[0].end).toBeUndefined();
  });

  describe('decoction', () => {
    const decoction = mashRow('decoction', 64, 20, {
      fromC: 50, transition: tr('decoction'),
      step: { id: 'd', kind: 'decoction', name: '', decoction: { lead: 'temp', rests: [{ tempC: 72, durationMin: 10 }], boilMin: 15 } },
      decoction: { sharePct: 30, volumeL: 8.4, grainKg: 2, vessel: 'Einkocher', evaporatedL: 0, restMashC: 50, curve: [] },
    });
    const names = [
      'Dekoktion: 8,4 l in Einkocher ziehen',
      'Teilmaische auf 72 °C heizen',
      'Teilmaische Rast 72 °C · 10 min',
      'Teilmaische – Weiter bei Kochbeginn',
      'Teilmaische kochen · 15 min',
      'Teilmaische zurückgeben',
      'Rast 64 °C · 20 min',
      'Maischen beendet – Weiter: Regler aus',
      'Regler aus',
    ];

    it('drives the decoction vessel by its own controller and leaves the mash unheated', () => {
      const p = mashTimerProgram(1, [decoction], sensors, { ...control, decoction: { controller: 'kettle', sensor: 'kettle.temp' } });
      const kettle = (v: number) => ({ kettle: { v, enabled: true } });
      expect(p.steps.map((s) => s.name)).toEqual(names);
      expect(targets(p.steps)).toEqual([
        {}, { mash: { enabled: false }, ...kettle(72) }, {}, kettle(100), {}, {},
        { ...set(64), kettle: { enabled: false } }, {}, { mash: { enabled: false }, kettle: { enabled: false } },
      ]);
      expect(p.steps.map((s) => !!s.confirm)).toEqual([true, false, false, true, false, true, false, true, false]);
      expect(p.steps[1]).toMatchObject({ end: 'sensor', cond: { ref: 'sensor/kettle.temp', op: 'gt', value: 71.5 } });
      expect(p.steps.map((s) => !!s.notify)).toEqual([false, false, true, false, false, false, false, false, false]);
      expect(p.steps.map((s) => s.holdSec)).toEqual([0, 0, 600, 0, 900, 0, 1200, 0, 0]);
    });

    it('asks for every move in a decoction vessel heated by hand', () => {
      const p = mashTimerProgram(1, [decoction], sensors, control);
      expect(p.steps.map((s) => s.name)).toEqual(names);
      expect(targets(p.steps)).toEqual([{}, { mash: { enabled: false } }, {}, {}, {}, {}, set(64), {}, { mash: { enabled: false } }]);
      expect(p.steps.map((s) => !!s.confirm)).toEqual([true, true, false, true, false, true, false, true, false]);
    });

    it('skips heating to a rest the decoction already has, and a boil without a time', () => {
      const cold = { ...decoction, step: { ...decoction.step, decoction: { lead: 'temp' as const, rests: [{ tempC: 50, durationMin: 5 }], boilMin: 0 } } };
      expect(mashTimerProgram(1, [cold], sensors, control).steps.map((s) => s.name).slice(0, 4)).toEqual([
        'Dekoktion: 8,4 l in Einkocher ziehen', 'Teilmaische Rast 50 °C · 5 min', 'Teilmaische – Weiter bei Kochbeginn', 'Teilmaische zurückgeben',
      ]);
    });

    it('leaves the mash controller on when the recipe has the mash left behind held', () => {
      const held = { ...decoction, step: { ...decoction.step, decoction: { ...decoction.step.decoction!, holdRest: true } } };
      const p = mashTimerProgram(1, [held], sensors, control);
      expect(p.steps.map((s) => s.name)).toEqual(names);
      expect(targets(p.steps)).toEqual([{}, {}, {}, {}, {}, {}, set(64), {}, { mash: { enabled: false } }]);
    });

    it('has no step to heat to a rest of the decoction that counts its heating', () => {
      const ramped = { ...decoction, decoction: { ...decoction.decoction!, rampInRest: true } };
      const p = mashTimerProgram(1, [ramped], sensors, { ...control, decoction: { controller: 'kettle', sensor: 'kettle.temp' } });
      expect(p.steps.map((s) => s.name).slice(0, 3)).toEqual([
        'Dekoktion: 8,4 l in Einkocher ziehen', 'Teilmaische Rast 72 °C · 10 min', 'Teilmaische – Weiter bei Kochbeginn',
      ]);
      expect(p.steps[1].targets).toEqual({ mash: { enabled: false }, kettle: { v: 72, enabled: true } });
      expect(p.steps[1].notify).toBeUndefined();
      // Heated by hand, the rest says that it begins.
      expect(mashTimerProgram(1, [ramped], sensors, control).steps[1]).toMatchObject({ targets: { mash: { enabled: false } }, notify: true });
    });

    it('stays one handgrip in the rest timer', () => {
      expect(mashTimerProgram(1, [decoction], {}).steps.map((s) => s.name)).toEqual([
        'Dekoktion: 8,4 l ziehen, kochen, zurück auf 64 °C', 'Rast 64 °C · 20 min',
      ]);
    });
  });
});

describe('mashControlOf', () => {
  const template = (key: string) => TEMPLATES.find((t) => t.key === key)!.build();
  const link = (bh: Brewhouse, name: string, controller: string) =>
    ({ ...bh, devices: bh.devices.map((d) => (d.name === name ? { ...d, manual: false, controller } : d)) });
  const snap = (controllers: [string, string][], sensors: string[]) => ({
    sensors: sensors.map((id) => ({ id })), actuators: [],
    controllers: controllers.map(([id, sensor]) => ({ id, setpoint: 0, enabled: false, params: { sensor } })),
  }) as unknown as Snapshot;

  it('takes the controller of the mash heater with the sensor it regulates on', () => {
    const pot = link(template('pot'), 'Heizung', 'mash');
    expect(mashControlOf(pot, snap([['mash', 'pot']], ['pot']), 99)).toEqual({ controller: 'mash', sensor: 'pot', strike: true, boilC: 99 });
    // A controller names a sensor with channels by its bare id and reads the first.
    expect(mashControlOf(pot, snap([['mash', 'bme']], ['bme.temp', 'bme.hum']), 99)?.sensor).toBe('bme.temp');
    expect(mashControlOf(pot, snap([['mash', 'gone']], ['pot']), 99)?.sensor).toBeUndefined();
  });

  it('is nothing without the controller in the registry, or without regulation', () => {
    const pot = link(template('pot'), 'Heizung', 'mash');
    expect(mashControlOf(pot, snap([], ['pot']), 99)).toBeUndefined();
    expect(mashControlOf(pot, null, 99)).toBeUndefined();
    expect(mashControlOf(template('pot'), snap([['mash', 'pot']], ['pot']), 99)).toBeUndefined();
    expect(mashControlOf(undefined, snap([], []), 99)).toBeUndefined();
  });

  it('knows whether the strike water hangs on the same controller', () => {
    // HERMS: the HLT's heater heats the strike water and, through the coil, the mash.
    const herms = link(template('herms3'), 'Heizstab HLT', 'hlt');
    const s = snap([['hlt', 'hlt.temp'], ['boil', 'boil.temp']], ['hlt.temp', 'boil.temp']);
    expect(mashControlOf(herms, s, 99)).toMatchObject({ controller: 'hlt', strike: true });
    const other = { ...herms, steps: { ...herms.steps, strike: { ...herms.steps.strike!, heaterId: herms.devices[1].id } } };
    expect(mashControlOf(other, s, 99)?.strike).toBe(false);
    expect(mashControlOf(link(other, 'Heizstab Würzepfanne', 'boil'), s, 99)?.strike).toBe(false);
  });

  it('takes the decoction vessel\'s own controller', () => {
    const bh = link(template('kettle-lauter'), 'Heizung', 'mash');
    const s = snap([['mash', 'pot'], ['hlt', 'hlt.temp']], ['pot', 'hlt.temp']);
    expect(mashControlOf(bh, s, 99)?.decoction).toBeUndefined();
    expect(mashControlOf(link(bh, 'Einkocher', 'hlt'), s, 99)?.decoction).toEqual({ controller: 'hlt', sensor: 'hlt.temp' });
    expect(mashControlOf(link(bh, 'Einkocher', 'mash'), s, 99)?.decoction).toBeUndefined();
    expect(mashControlOf(link(bh, 'Einkocher', 'gone'), s, 99)?.decoction).toBeUndefined();
  });
});

describe('mashedInAt', () => {
  const { steps } = mashTimerProgram(7, rows, {});
  const at = (currentStep: number, status: ProgramStatus = 'running', stepStartedEpoch = 1_791_930_000) =>
    mashedInAt({ steps, status, currentStep, stepStartedEpoch });

  it('is the start of the step after the first dough-in', () => {
    expect(at(2)).toBe(1_791_930_000_000);
    expect(at(2, 'paused')).toBe(1_791_930_000_000);
  });

  it('is unknown before, later, and while the program does not run', () => {
    expect(at(1, 'awaiting')).toBeUndefined();
    expect(at(3)).toBeUndefined();
    expect(at(2, 'done')).toBeUndefined();
    expect(at(2, 'running', 0)).toBeUndefined();
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

  it('is not when the mash is heated by infusion: the controller keeps the water hot', () => {
    const bh = withHeater(false, 'hlt');
    const infusion = { ...bh, devices: bh.devices.filter((d) => d.kind !== 'coil'), steps: { ...bh.steps, mash: { ...bh.steps.mash!, pumpId: undefined } } };
    expect(isRegulated(infusion)).toBe(false);
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
