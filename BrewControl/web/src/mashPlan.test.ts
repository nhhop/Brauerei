import { describe, expect, it } from 'vitest';
import { TEMPLATES, type Brewery, type Brewhouse } from './brewhouse';
import { GRAIN_HEAT_RATIO, strikeWaterTempC } from './brewMath';
import { calcMash, outlineMash, HEATER_EFFICIENCY, ICE_TEMP_C, THICK_DECOCTION_L_PER_KG, WATER_J_PER_KG_K, type MashRow } from './mashPlan';
import { GRAIN_DISPLACEMENT_L_PER_KG, calcWater } from './recipeWater';
import { addCharge, newRecipe, type Decoction, type Ingredient, type MashStep, type Recipe } from './recipes';

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
  return calcMash(r, bh, b, calcWater(r, bh, undefined, b).water!);
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

describe('calcMash: decoction', () => {
  // Mash kettle heated directly; the Einkocher (1800 W, 27 l) boils the decoction.
  const kettle = template('kettle-lauter');
  const einkocher = kettle.vessels.find((v) => v.name === 'Einkocher')!;
  const withVessel = (bh: Brewhouse, id: string, p: Partial<Brewhouse['vessels'][number]>): Brewhouse =>
    ({ ...bh, vessels: bh.vessels.map((v) => (v.id === id ? { ...v, ...p } : v)) });
  const mashVesselId = kettle.steps.mash!.vesselId;

  // Mashed in at 50 °C for 15 min, then one decoction to 64 °C.
  function decoctionRecipe(bh: Brewhouse, d: Partial<Decoction> = {}, step: Partial<MashStep> = {}): Recipe {
    const r = { ...newRecipe(), volumeL: 20, brewhouseId: bh.id, ingredients: [malt] };
    r.mash = [
      { ...r.mash[0] }, { ...r.mash[1], tempC: 50, durationMin: 15 },
      {
        id: 'dek', kind: 'decoction', name: 'Kochmaische', tempC: 64, durationMin: 30,
        decoction: { lead: 'temp', rests: [{ tempC: 72, durationMin: 15 }], boilMin: 15, ...d }, ...step,
      },
    ];
    return r;
  }
  // Heat equivalent of the mash before the decoction and of the part pulled.
  const massOf = (p: ReturnType<typeof plan>) => p.rows[0].waterL! + GRAIN_HEAT_RATIO * 5;
  const pulledMass = (row: MashRow) => {
    const d = row.decoction!;
    return d.volumeL - GRAIN_DISPLACEMENT_L_PER_KG * d.grainKg + GRAIN_HEAT_RATIO * d.grainKg;
  };

  it('finds the share that closes the heat balance, and back from the share', () => {
    const p = plan(kettle, decoctionRecipe(kettle));
    const row = p.rows[2];
    const d = row.decoction!;
    expect(p.decoction?.vessel.name).toBe('Einkocher');
    expect(row.transition.kind).toBe('decoction');
    expect(row.tempC).toBeCloseTo(64, 3);
    expect(d.restMashC).toBeCloseTo(50, 6);  // no heat loss: the mash left behind holds
    const m = massOf(p);
    const md = pulledMass(row);
    expect(((m - md) * d.restMashC + md * 100) / m).toBeCloseTo(64, 3);
    // Thick: grain at 2.1 l/kg (the mash is thinner).
    expect((d.volumeL - GRAIN_DISPLACEMENT_L_PER_KG * d.grainKg) / d.grainKg).toBeCloseTo(THICK_DECOCTION_L_PER_KG, 6);

    const byShare = plan(kettle, decoctionRecipe(kettle, { lead: 'share', sharePct: d.sharePct }, { tempC: 70 }));
    expect(byShare.rows[2].tempC).toBeCloseTo(64, 3);
  });

  it('a thin decoction without loss and evaporation is Troester\'s formula of the heat equivalent', () => {
    const p = plan(kettle, decoctionRecipe(kettle, { thin: true }));
    const row = p.rows[2];
    expect(row.decoction!.grainKg).toBe(0);
    expect(row.decoction!.volumeL / massOf(p)).toBeCloseTo((64 - 50) / (100 - 50), 3);
  });

  it('a thick decoction needs more volume than a thin one', () => {
    const thick = plan(kettle, decoctionRecipe(kettle)).rows[2].decoction!;
    const thin = plan(kettle, decoctionRecipe(kettle, { thin: true })).rows[2].decoction!;
    expect(thick.volumeL).toBeGreaterThan(thin.volumeL);
  });

  it('times the decoction from the heater power for its own mass', () => {
    const p = plan(kettle, decoctionRecipe(kettle));
    const row = p.rows[2];
    const rate = (1800 * HEATER_EFFICIENCY * 60) / (pulledMass(row) * WATER_J_PER_KG_K);
    const min = (72 - 50) / rate + 15 + (100 - 72) / rate + 15;
    expect(row.transition.min).toBeCloseTo(min, 3);
    // Pulled when the doughIn rest ends, back at the target.
    expect(row.startMin).toBeCloseTo(p.rows[1].startMin + 15 + min, 3);
    expect(row.decoction!.curve.map((c) => c.tempC)).toEqual([50, 72, 72, 100, 100]);
    expect(row.decoction!.curve[0].min).toBeCloseTo(p.rows[1].startMin + 15, 6);
    expect(row.decoction!.curve[4].min).toBeCloseTo(row.startMin, 6);
    expect(p.totalMin).toBeCloseTo(row.startMin + 30, 6);
    expect(p.notes.join()).toContain('Heizzeiten der Teilmaische geschätzt aus der Heizleistung von Einkocher');
  });

  it('falls back to the heat rate of the vessel\'s step, for a full vessel', () => {
    const heater = kettle.devices.find((d) => d.name === 'Einkocher')!;
    const bh: Brewhouse = {
      ...kettle,
      devices: kettle.devices.map((d) => (d.id === heater.id ? { ...d, powerW: undefined } : d)),
      steps: { ...kettle.steps, sparge: { ...kettle.steps.sparge!, heatRateKPerMin: 2 } },
    };
    const row = plan(bh, decoctionRecipe(bh)).rows[2];
    expect(row.transition.min).toBeCloseTo((100 - 50) / 2 + 15 + 15, 6);
    expect(plan(bh, decoctionRecipe(bh)).notes.join()).toContain('die für die volle Füllung gilt');
  });

  it('a heat loss of the mash vessel cools the mash left behind and grows the share', () => {
    const lossy = withVessel(kettle, mashVesselId, { heatLossKPerH: 6 });
    const base = plan(kettle, decoctionRecipe(kettle)).rows[2];
    const p = plan(lossy, decoctionRecipe(lossy));
    const row = p.rows[2];
    expect(row.decoction!.restMashC).toBeCloseTo(50 - (6 * row.transition.min) / 60, 6);
    expect(row.decoction!.sharePct).toBeGreaterThan(base.decoction!.sharePct);
    expect(row.tempC).toBeCloseTo(64, 3);
  });

  it('evaporates at the decoction vessel\'s rate and takes the water off the mash', () => {
    const none = plan(kettle, decoctionRecipe(kettle));
    expect(none.rows[2].decoction!.evaporatedL).toBe(0);
    expect(none.notes.join()).toContain('Einkocher hat keine Verdampfung, gerechnet wird mit 0 l/h.');
    const bh = withVessel(kettle, einkocher.id, { evaporationLPerH: 2 });
    const p = plan(bh, decoctionRecipe(bh));
    const row = p.rows[2];
    expect(row.decoction!.evaporatedL).toBeCloseTo(0.5, 6);
    expect(p.notes.join()).not.toContain('keine Verdampfung');
    const m = massOf(p);
    const md = pulledMass(row);
    expect(((m - md) * 50 + (md - 0.5) * 100) / (m - 0.5)).toBeCloseTo(64, 3);
  });

  it('notes a target it cannot reach and one it would have to lower', () => {
    const hot = plan(kettle, decoctionRecipe(kettle, { thin: true }, { tempC: 99 }));
    expect(hot.notes.join()).toContain('lassen sich auch mit der ganzen Maische nicht erreichen');
    const low = plan(kettle, decoctionRecipe(kettle, {}, { tempC: 45 }));
    expect(low.notes.join()).toContain('eine Dekoktion hebt nur');
    expect(low.rows[2].decoction!.sharePct).toBe(0);
  });

  it('notes a decoction larger than its vessel', () => {
    const small = withVessel(kettle, einkocher.id, { volumeL: 3 });
    expect(plan(small, decoctionRecipe(small)).notes.join()).toContain('passt nicht in Einkocher');
  });

  it('counts a decoction as a rest where the brewhouse has no decoction vessel', () => {
    const pot = template('pot');
    const p = plan(pot, decoctionRecipe(pot));
    expect(p.decoction).toBeUndefined();
    expect(p.rows[2].transition.kind).toBe('heat');
    expect(p.rows[2].tempC).toBeCloseTo(64, 6);
    expect(p.notes.join()).toContain('keinen zweiten beheizten Behälter');
  });
});

describe('calcMash: boiling rest', () => {
  it('boils the mash at the boiling point of the altitude and evaporates at the mash vessel\'s rate', () => {
    const pot = template('pot');  // heated directly, 3 l/h
    const p = plan(pot, recipeFor(pot, [{ tempC: 72 }, { tempC: 100, durationMin: 15 }]), { ...brewery, altitudeM: 500 });
    const row = p.rows[3];
    expect(row.tempC).toBeCloseTo(p.boilC, 6);
    expect(p.boilC).toBeCloseTo(98.3, 1);
    expect(row.transition.text).toMatch(/^Heizen \d+ min · Kochen$/);
    expect(row.evaporatedL).toBeCloseTo(0.75, 6);
    expect(p.notes.join()).not.toContain('direkt beheizt');
  });

  it('notes that only a directly heated mash vessel can boil', () => {
    const herms = template('herms3');
    const p = plan(herms, recipeFor(herms, [{ tempC: 100, durationMin: 15 }]));
    expect(p.notes.join()).toContain('Kochen im Maischbehälter geht nur, wenn er direkt beheizt ist.');
  });
});

describe('outlineMash (no brewhouse)', () => {
  // The fixed steps plus `rest`, mashed in at 63 °C for 30 min, no brewhouse.
  const outline = (rest: Partial<MashStep>[], p: Partial<Recipe> = {}, b: Brewery | null = brewery) => {
    const r = { ...newRecipe(), ingredients: [malt], ...p };
    r.mash = [
      { ...r.mash[0] }, { ...r.mash[1], tempC: 63, durationMin: 30 },
      ...rest.map((s, i) => ({ id: `s${i}`, kind: 'rest' as const, name: `Schritt ${i}`, durationMin: 10, ...s })),
    ];
    return outlineMash(r, b);
  };

  it('starts at mashing in and jumps from hold to hold', () => {
    const rows = outline([{ tempC: 72, durationMin: 20 }, { kind: 'infusion', tempC: 78, durationMin: 5, infusion: { lead: 'temp' } }]);
    expect(rows.map((r) => [r.step.kind, r.fromC, r.tempC, r.startMin, r.holdMin])).toEqual([
      ['doughIn', 63, 63, 0, 30], ['rest', 63, 72, 30, 20], ['infusion', 72, 78, 50, 5],
    ]);
    expect(rows.every((r) => r.transition.min === 0)).toBe(true);
    expect(rows[0]).toMatchObject({ grainKg: 5, chargeName: 'Schüttung 1' });
  });

  it('a further charge and a rest without a target keep the temperature', () => {
    const base = { ...newRecipe(), ingredients: [malt] };
    const charges = addCharge(base, { fromId: 'c1', pct: 40 });
    const rows = outline([{ tempC: 45 }, { kind: 'doughIn', chargeId: charges.charges![1].id, tempC: 99 }, { tempC: undefined }], charges);
    expect(rows.map((r) => r.tempC)).toEqual([63, 45, 45, 45]);
    expect(rows[2]).toMatchObject({ grainKg: 2, chargeName: 'Schüttung 2' });
  });

  it('a boiling rest stops at the boiling point of the altitude, a decoction jumps to its target', () => {
    const rows = outline([
      { tempC: 100, durationMin: 15 },
      { kind: 'decoction', tempC: 70, decoction: { lead: 'temp', rests: [], boilMin: 15 } },
    ], {}, { ...brewery, altitudeM: 500 });
    expect(rows[1].tempC).toBeCloseTo(98.3, 1);
    expect(rows[2].tempC).toBe(70);
    expect(rows[2].decoction).toBeUndefined();
  });
});
