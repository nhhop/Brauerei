import { describe, expect, it } from 'vitest';
import { TEMPLATES, type Brewery, type Brewhouse } from './brewhouse';
import { GRAIN_HEAT_RATIO, strikeWaterTempC } from './brewMath';
import { calcMash, HEATER_EFFICIENCY, ICE_TEMP_C, WATER_J_PER_KG_K } from './mashPlan';
import { calcWater } from './recipeWater';
import { addCharge, newRecipe, type Ingredient, type MashStep, type Recipe } from './recipes';

const template = (key: string) => TEMPLATES.find((t) => t.key === key)!.build();
const brewery: Brewery = { grainTempC: 18, tapWaterTempC: 12 };

const malt: Ingredient = { id: 'm', kind: 'fermentable', name: 'Pilsner', amount: 5, timing: 'mash' };

// 20 l knock-out, 5 kg malt; the plan after the two fixed steps is `rest`.
function recipeFor(bh: Brewhouse, rest: Partial<MashStep>[] = [], p: Partial<Recipe> = {}): Recipe {
  const r = { ...newRecipe(), volumeL: 20, brewhouseId: bh.id, ingredients: [malt], ...p };
  r.mash = [
    { ...r.mash[0] }, { ...r.mash[1], tempC: 63, durationMin: 30 },
    ...rest.map((s, i) => ({ id: `s${i}`, kind: 'rest' as const, name: `Schritt ${i}`, durationMin: 10, ...s })),
  ];
  return r;
}

function plan(bh: Brewhouse, r: Recipe, b: Brewery = brewery) {
  return calcMash(r, bh, b, calcWater(r, bh).water!);
}

describe('calcMash', () => {
  const kettle = template('kettle-lauter');  // mash kettle heated directly, 3500 W, no heat rate

  it('heats the strike water to the strike temperature of the first doughIn', () => {
    const r = recipeFor(kettle);
    const p = plan(kettle, r);
    const strikeL = calcWater(r, kettle).water!.strikeL;
    expect(p.rows[0].waterL).toBeCloseTo(strikeL, 6);
    expect(p.rows[0].tempC).toBeCloseTo(strikeWaterTempC(strikeL, 5, 18, 63), 6);
    expect(p.rows[1].tempC).toBeCloseTo(63, 6);
    expect(p.rows[1].transition.kind).toBe('mix');
  });

  it('mixes a second charge in at the grain temperature', () => {
    const base = recipeFor(kettle, [{ kind: 'rest', tempC: 45 }]);
    const r = { ...base, ...addCharge(base, { fromId: 'c1', pct: 50 }) };
    const p = plan(kettle, r);
    const w0 = p.rows[0].waterL!;
    // The strike temperature only knows the first charge.
    expect(p.rows[0].tempC).toBeCloseTo(strikeWaterTempC(w0, 2.5, 18, 63), 6);
    const m = w0 + GRAIN_HEAT_RATIO * 2.5;
    const grain = GRAIN_HEAT_RATIO * 2.5;
    expect(p.rows[3].grainKg).toBeCloseTo(2.5, 6);
    expect(p.rows[3].tempC).toBeCloseTo((m * 45 + grain * 18) / (m + grain), 6);
    expect(p.notes.join()).not.toContain('fehlt im Plan');
  });

  it('solves an infusion both ways: volume gives the water temperature and back', () => {
    const byVolume = plan(kettle, recipeFor(kettle, [
      { kind: 'infusion', tempC: 70, infusion: { lead: 'volume', volumeL: 4 } },
    ]));
    const waterC = byVolume.rows[2].waterTempC!;
    expect(byVolume.rows[2].tempC).toBeCloseTo(70, 6);
    const byTemp = plan(kettle, recipeFor(kettle, [
      { kind: 'infusion', tempC: 70, infusion: { lead: 'temp', waterTempC: waterC } },
    ]));
    expect(byTemp.rows[2].waterL).toBeCloseTo(4, 6);
    // The infusion is part of the strike water.
    expect(byTemp.rows[0].waterL! + 4).toBeCloseTo(byTemp.strikeL, 6);
  });

  it('cools with ice through its latent heat', () => {
    const p = plan(kettle, recipeFor(kettle, [{ kind: 'infusion', tempC: 55, infusion: { lead: 'temp', ice: true } }]));
    const r = p.rows[2];
    const m = p.rows[0].waterL! + GRAIN_HEAT_RATIO * 5;
    expect(r.waterTempC).toBeCloseTo(ICE_TEMP_C, 6);
    expect(r.waterL).toBeCloseTo((m * (63 - 55)) / (55 - ICE_TEMP_C), 6);
    expect(r.tempC).toBeCloseTo(55, 6);
  });

  it('bounds the infusion water at the boiling point of the altitude', () => {
    // The volume that needs 99 °C water: fine at sea level, too hot at 500 m.
    const volumeL = plan(kettle, recipeFor(kettle, [{ kind: 'infusion', tempC: 66, infusion: { lead: 'temp', waterTempC: 99 } }]))
      .rows[2].waterL;
    const r = recipeFor(kettle, [{ kind: 'infusion', tempC: 66, infusion: { lead: 'volume', volumeL } }]);
    const at0 = plan(kettle, r);
    expect(at0.rows[2].waterTempC).toBeCloseTo(99, 6);
    expect(at0.notes.join()).not.toContain('Siedepunkt');
    const at500 = plan(kettle, r, { ...brewery, altitudeM: 500 });
    expect(at500.boilC).toBeCloseTo(98.3, 1);
    expect(at500.notes.join()).toContain('(Siedepunkt)');
    // Led by temperature, the water defaults to boiling.
    const boiling = plan(kettle, recipeFor(kettle, [{ kind: 'infusion', tempC: 66, infusion: { lead: 'temp' } }]),
      { ...brewery, altitudeM: 500 });
    expect(boiling.rows[2].waterTempC).toBeCloseTo(at500.boilC, 6);
  });

  it('takes the heating time from the heat rate, else from the heater power', () => {
    const r = recipeFor(kettle, [{ tempC: 72 }]);
    const estimated = plan(kettle, r);
    const m = estimated.rows[0].waterL! + GRAIN_HEAT_RATIO * 5;
    const rate = (3500 * HEATER_EFFICIENCY * 60) / (m * WATER_J_PER_KG_K);
    expect(estimated.rows[2].transition.min).toBeCloseTo(9 / rate, 6);
    expect(estimated.heatRate).toEqual({ kPerMin: rate, estimated: true });
    expect(estimated.notes.join()).toContain('geschätzt aus der Heizleistung');

    const withRate: Brewhouse = { ...kettle, steps: { ...kettle.steps, mash: { ...kettle.steps.mash!, heatRateKPerMin: 1 } } };
    const p = plan(withRate, r);
    expect(p.rows[2].transition).toEqual({ kind: 'heat', min: 9, text: 'Heizen 9 min' });
    // Start: heating the strike water, 30 min rest, 9 min heating.
    expect(p.rows[2].startMin).toBeCloseTo(p.rows[0].startMin + 30 + 9, 6);
    expect(p.totalMin).toBeCloseTo(p.rows[2].startMin + 10, 6);
  });

  it('estimates passive cooling and suggests a cold infusion', () => {
    const p = plan(kettle, recipeFor(kettle, [{ tempC: 59 }]));
    expect(p.rows[2].transition).toMatchObject({ kind: 'cool', min: 20 });
    expect(p.notes.join()).toContain('kalt zubrühen?');
  });

  it('reaches a warmer rest by boiling water in an infusion brewhouse', () => {
    const hltHeater = kettle.devices.find((d) => d.name === 'Einkocher')!;
    const tun = kettle.vessels.find((v) => v.name === 'Läuterbottich')!;
    const infusion: Brewhouse = { ...kettle, steps: { ...kettle.steps, mash: { vesselId: tun.id, heaterId: hltHeater.id } } };
    const p = plan(infusion, recipeFor(infusion, [{ tempC: 72 }]));
    const m = p.rows[0].waterL! + GRAIN_HEAT_RATIO * 5;
    expect(p.rows[2].transition.kind).toBe('mix');
    expect(p.rows[2].waterTempC).toBeCloseTo(100, 6);
    expect(p.rows[2].waterL).toBeCloseTo((m * 9) / (100 - 72), 6);
    expect(p.rows[0].waterL! + p.rows[2].waterL!).toBeCloseTo(p.strikeL, 6);
    expect(p.heatRate).toBeUndefined();
  });

  it('notes infusions larger than the strike water and adds them on top', () => {
    const p = plan(kettle, recipeFor(kettle, [{ kind: 'infusion', tempC: 50, infusion: { lead: 'volume', volumeL: 40 } }]));
    expect(p.notes[0]).toContain('größer als der Hauptguss');
    expect(p.rows[0].waterL).toBeCloseTo(p.strikeL, 6);
  });
});
