// Mash plan (tab "Maischen"): strike temperature, mixing temperatures, infusion
// volumes and heating times from heat balances. Pure, like recipeWater.ts.
//
// Heat balance: the mash warms like M = water [kg] + 0.41 × grain [kg] of water.
// The vessel's own heat capacity is left out, as in Palmer.
import { GRAIN_HEAT_RATIO, strikeWaterTempC } from './brewMath';
import {
  breweryBoilC, decoctionVesselOf, heatingOf, type Brewery, type Brewhouse, type DecoctionVessel, type Heating, type StepKey,
} from './brewhouse';
import { chargeIdOf, chargesOf, isMashGrain, type Decoction, type MashStep, type Recipe } from './recipes';
import { GRAIN_DISPLACEMENT_L_PER_KG, fmtL, isBoilRest, type Water } from './recipeWater';

export const WATER_J_PER_KG_K = 4186;
// Ice at 0 °C counts as water of this temperature: it takes up its latent heat
// of 334 kJ/kg while melting, then warms from 0 °C.
export const ICE_TEMP_C = -334 / 4.186;
// TODO(verify): share of a heater's power that reaches the mash, for the estimate
// when the brewhouse has no heat rate.
export const HEATER_EFFICIENCY = 0.85;
// TODO(verify): passive cooling of the mash; a rule of thumb, it depends on the vessel.
export const PASSIVE_COOL_K_PER_MIN = 0.2;
// TODO(verify): water per kg grain of a thick decoction, about 1 qt/lb
// (BrewUnited, "Decoction Mashing"); a mash thinner than this gives it up.
export const THICK_DECOCTION_L_PER_KG = 2.1;

export interface Transition {
  kind: 'heat' | 'cool' | 'mix' | 'decoction' | 'none';
  min: number;          // 0 when unknown (no heat rate) or instant (mixing)
  text: string;
}

// The part of the mash a decoction pulls, and its course in the decoction vessel.
export interface DecoctionRow {
  sharePct: number;     // of the mash volume
  volumeL: number;      // pulled, grain displacement included
  grainKg: number;
  vessel: string;
  evaporatedL: number;
  restMashC: number;    // the mash left behind, when the decoction comes back
  curve: { min: number; tempC: number }[];  // from pulling it to putting it back; minutes as startMin
}

export interface MashRow {
  step: MashStep;
  waterL?: number;      // strike: water put in; infusion, or a rest reached by infusion: water added
  waterTempC?: number;  // that water's temperature (strike: the computed strike temperature)
  ice?: boolean;
  grainKg?: number;     // doughIn
  chargeName?: string;  // doughIn
  evaporatedL?: number; // a rest that boils the mash
  decoction?: DecoctionRow;
  fromC: number;        // before the transition (strike: tap water)
  tempC: number;        // reached
  transition: Transition;
  startMin: number;     // when tempC is reached, minutes from heating the strike water
  holdMin: number;
}

export interface MashPlan {
  rows: MashRow[];
  totalMin: number;
  boilC: number;
  strikeL: number;      // the strike water of the water tab: strike row plus all infusions
  infusionL: number;
  heating: Heating;
  heatRate?: { kPerMin: number; estimated: boolean };  // mash step, after the first doughIn
  decoction?: DecoctionVessel;  // unset = the brewhouse cannot decoct
  notes: string[];
}

const num = (n: number) => n.toFixed(1).replace('.', ',');

// Minutes as h:mm.
export function fmtClock(min: number): string {
  const m = Math.round(min);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}
const EPS = 0.05;

// Heat rate of a step: the brewhouse's value, else estimated from the heater's
// power for `massKg` of water equivalent.
function rateOf(bh: Brewhouse, step: StepKey, massKg: number): { kPerMin: number; estimated: boolean } | undefined {
  const cfg = bh.steps[step];
  if (cfg?.heatRateKPerMin) return { kPerMin: cfg.heatRateKPerMin, estimated: false };
  const powerW = heatingOf(bh, step).heater?.powerW;
  if (!powerW || massKg <= 0) return undefined;
  return { kPerMin: (powerW * HEATER_EFFICIENCY * 60) / (massKg * WATER_J_PER_KG_K), estimated: true };
}

// `water` is calcWater's result for the same recipe and brewhouse.
export function calcMash(recipe: Recipe, bh: Brewhouse, brewery: Brewery | null, water: Water): MashPlan {
  const grainC = brewery?.grainTempC ?? 18;
  const tapC = brewery?.tapWaterTempC ?? 12;
  const boilC = breweryBoilC(brewery);
  const heating = heatingOf(bh, 'mash');
  const byInfusion = heating.via === 'infusion';
  const strikeStep: StepKey = bh.steps.strike ? 'strike' : 'mash';
  const decoction = decoctionVesselOf(bh);
  const mashVessel = bh.vessels.find((v) => v.id === bh.steps.mash?.vesselId);
  const lossKPerMin = (mashVessel?.heatLossKPerH ?? 0) / 60;
  const charges = chargesOf(recipe);
  const grainOf = (chargeId: string) => recipe.ingredients
    .filter((i) => isMashGrain(i) && chargeIdOf(i, charges) === chargeId)
    .reduce((s, i) => s + i.amount, 0);
  const steps = recipe.mash;
  const strikeL = water.strikeL;

  // One pass through the plan with `strikeWaterL` put in first.
  function walk(strikeWaterL: number) {
    const notes: string[] = [];
    const rows: MashRow[] = [];
    const mashed = new Set<string>();
    // Water and grain in the mash; it warms like `mass()` kg of water.
    let waterKg = 0;
    let grainKg = 0;
    const mass = () => waterKg + GRAIN_HEAT_RATIO * grainKg;
    let t = tapC;
    let clock = 0;
    let infusionL = 0;
    let unknownRate = false;
    let estimatedRate = false;
    let heatRate: MashPlan['heatRate'];
    const decoctionRate = new Set<'power' | 'step' | 'none'>();
    const noEvaporation = new Set<string>();
    const asRest: string[] = [];  // decoctions without a decoction vessel

    const heat = (step: StepKey, from: number, to: number, m: number): Transition => {
      const rate = rateOf(bh, step, m);
      if (!rate) { unknownRate = true; return { kind: 'heat', min: 0, text: 'Heizen' }; }
      if (rate.estimated) estimatedRate = true;
      const min = (to - from) / rate.kPerMin;
      return { kind: 'heat', min, text: `Heizen ${Math.round(min)} min` };
    };
    // Water of `waterC` that brings the mash from t to `target`; 0 when it cannot.
    const volumeFor = (target: number, waterC: number) => {
      const v = (mass() * (target - t)) / (waterC - target);
      return Number.isFinite(v) && v >= 0 ? v : undefined;
    };
    // Evaporation of a vessel that boils `min`; a missing value counts as 0 l/h.
    const evaporationOf = (v: { name: string; evaporationLPerH?: number } | undefined, min: number) => {
      if (min > 0 && v && v.evaporationLPerH == null) noEvaporation.add(v.name);
      return ((v?.evaporationLPerH ?? 0) * min) / 60;
    };

    type Part = Omit<MashRow, 'startMin' | 'holdMin' | 'fromC' | 'tempC' | 'step'>;

    // Rest: heat, cool passively, or reach a warmer one by infusion in an
    // infusion brewhouse. At the boiling point it boils the mash in its vessel.
    function rest(s: MashStep, label: string): Part {
      const boiling = isBoilRest(s, boilC);
      const target = boiling ? boilC : s.tempC ?? t;
      if (boiling && !heating.direct) notes.push(`${label}: Kochen im Maischbehälter geht nur, wenn er direkt beheizt ist.`);
      let part: Part;
      if (target > t + EPS && byInfusion && !boiling) {
        const v = volumeFor(target, boilC) ?? 0;
        infusionL += v;
        waterKg += v;
        t = target;
        part = { waterL: v, waterTempC: boilC, transition: { kind: 'mix', min: 0, text: 'Zubrühen (Aufguss)' } };
      } else if (target > t + EPS) {
        const tr = heat('mash', t, target, mass());
        part = { transition: boiling ? { ...tr, text: `${tr.text} · Kochen` } : tr };
        t = target;
      } else if (target < t - EPS) {
        const min = (t - target) / PASSIVE_COOL_K_PER_MIN;
        notes.push(`${label}: Abkühlen geschätzt (${num(PASSIVE_COOL_K_PER_MIN)} K/min), kalt zubrühen?`);
        part = { transition: { kind: 'cool', min, text: `Abkühlen ~${Math.round(min)} min` } };
        t = target;
      } else {
        part = { transition: { kind: 'none', min: 0, text: boiling ? 'Kochen' : '—' } };
      }
      if (boiling) {
        const e = Math.min(evaporationOf(mashVessel, s.durationMin ?? 0), waterKg);
        waterKg -= e;
        part.evaporatedL = e;
      }
      return part;
    }

    // Decoction: a share of the mash volume is pulled (thick: grain with up to
    // THICK_DECOCTION_L_PER_KG of water, then liquid; thin: liquid only), rests
    // and boils in the decoction vessel, loses its evaporation and comes back.
    // The mash left behind rests unheated meanwhile and loses the mash vessel's
    // heat loss. Back in: T = (M_r·T_r + (M_d − E)·T_boil) / (M_r + M_d − E).
    // A thin decoction without loss and evaporation is Troester's
    // s = (T_target − T_start) / (T_boil − T_start) of the heat equivalent.
    function decoct(s: MashStep, label: string, d: Decoction, dv: DecoctionVessel): Part {
      const start = t;
      const volumeL = waterKg + GRAIN_DISPLACEMENT_L_PER_KG * grainKg;
      const run = (share: number) => {
        const pulledL = share * volumeL;
        let gd = 0;
        let wd = Math.min(pulledL, waterKg);
        if (!d.thin && grainKg > 0) {
          const ratio = Math.min(waterKg / grainKg, THICK_DECOCTION_L_PER_KG);
          const allGrainL = grainKg * (ratio + GRAIN_DISPLACEMENT_L_PER_KG);
          gd = pulledL <= allGrainL ? pulledL / (ratio + GRAIN_DISPLACEMENT_L_PER_KG) : grainKg;
          wd = pulledL <= allGrainL ? ratio * gd : ratio * grainKg + pulledL - allGrainL;
        }
        const md = wd + GRAIN_HEAT_RATIO * gd;
        // The heater's power heats only the decoction; the heat rate of the
        // vessel's step holds for a full vessel and is the fallback.
        const powerW = dv.heater.powerW;
        const rate = powerW && md > 0 ? { kPerMin: (powerW * HEATER_EFFICIENCY * 60) / (md * WATER_J_PER_KG_K), from: 'power' as const }
          : dv.stepRateKPerMin ? { kPerMin: dv.stepRateKPerMin, from: 'step' as const } : undefined;
        let temp = start;
        let min = 0;
        const curve = [{ min: 0, tempC: start }];
        const heatTo = (to: number) => {
          if (to <= temp + EPS) return;
          min += rate ? (to - temp) / rate.kPerMin : 0;
          temp = to;
          curve.push({ min, tempC: temp });
        };
        for (const r of d.rests) {
          heatTo(r.tempC);
          if (r.durationMin > 0) {
            min += r.durationMin;
            curve.push({ min, tempC: temp });
          }
        }
        heatTo(boilC);
        if (d.boilMin > 0) {
          min += d.boilMin;
          curve.push({ min, tempC: temp });
        }
        const evaporatedL = Math.min(((dv.vessel.evaporationLPerH ?? 0) * d.boilMin) / 60, wd);
        const restMashC = start - lossKPerMin * min;
        const mr = mass() - md;
        const back = md - evaporatedL;
        const tempC = mr + back > 0 ? (mr * restMashC + back * temp) / (mr + back) : temp;
        return { pulledL, gd, min, curve, evaporatedL, restMashC, tempC, rate: rate?.from ?? ('none' as const) };
      };

      let share: number;
      if (d.lead === 'share') {
        share = Math.min(Math.max((d.sharePct ?? 0) / 100, 0), 1);
      } else {
        const target = s.tempC ?? start;
        if (target <= start + EPS) {
          notes.push(`${label}: Das Ziel liegt nicht über der Maische (${num(start)} °C), eine Dekoktion hebt nur.`);
          share = 0;
        } else if (run(1).tempC < target - EPS) {
          notes.push(`${label}: ${num(target)} °C lassen sich auch mit der ganzen Maische nicht erreichen.`);
          share = 1;
        } else {
          let lo = 0;
          let hi = 1;
          for (let i = 0; i < 50; i++) {
            const mid = (lo + hi) / 2;
            if (run(mid).tempC < target) lo = mid; else hi = mid;
          }
          share = (lo + hi) / 2;
        }
      }
      const r = run(share);
      decoctionRate.add(r.rate);
      if (d.boilMin > 0 && dv.vessel.evaporationLPerH == null) noEvaporation.add(dv.vessel.name);
      if (r.pulledL > dv.vessel.volumeL) {
        notes.push(`${label}: Die Teilmaische (${fmtL(r.pulledL)}) passt nicht in ${dv.vessel.name} (${fmtL(dv.vessel.volumeL)}).`);
      }
      waterKg -= r.evaporatedL;
      t = r.tempC;
      return {
        transition: { kind: 'decoction', min: r.min, text: `Dekoktion ${Math.round(r.min)} min` },
        decoction: {
          sharePct: share * 100, volumeL: r.pulledL, grainKg: r.gd, vessel: dv.vessel.name, evaporatedL: r.evaporatedL,
          restMashC: r.restMashC, curve: r.curve.map((p) => ({ min: clock + p.min, tempC: p.tempC })),
        },
      };
    }

    for (const [k, s] of steps.entries()) {
      const from = t;
      let row: Part;
      const label = `„${s.name || 'ohne Namen'}“`;
      switch (s.kind) {
        case 'strike': {
          const target = steps[1]?.tempC ?? t;
          const grain = grainOf(charges[0].id);
          const strikeC = grain > 0 && strikeWaterL > 0 ? strikeWaterTempC(strikeWaterL, grain, grainC, target) : target;
          if (strikeC > boilC + EPS) notes.push(`Die Hauptguss-Temperatur (${num(strikeC)} °C) liegt über dem Siedepunkt (${num(boilC)} °C).`);
          row = { waterL: strikeWaterL, waterTempC: strikeC, transition: heat(strikeStep, tapC, strikeC, strikeWaterL) };
          waterKg = strikeWaterL;
          t = strikeC;
          break;
        }
        case 'doughIn': {
          const charge = charges.find((c) => c.id === chargeIdOf(s, charges))!;
          let grain = grainOf(charge.id);
          if (mashed.has(charge.id)) {
            notes.push(`${label}: ${charge.name} ist schon eingemaischt, hier zählt sie nicht.`);
            grain = 0;
          }
          mashed.add(charge.id);
          const grainMass = GRAIN_HEAT_RATIO * grain;
          if (mass() + grainMass > 0) t = (mass() * t + grainMass * grainC) / (mass() + grainMass);
          grainKg += grain;
          row = { grainKg: grain, chargeName: charge.name, transition: { kind: 'mix', min: 0, text: 'Mischen' } };
          if (k === 1) heatRate = byInfusion ? undefined : rateOf(bh, 'mash', mass());
          break;
        }
        case 'rest':
          row = rest(s, label);
          break;
        case 'infusion': {
          const inf = s.infusion ?? { lead: 'volume' };
          const target = s.tempC ?? t;
          let v: number | undefined;
          let waterC: number;
          if (inf.ice || inf.lead === 'temp') {
            waterC = inf.ice ? ICE_TEMP_C : inf.waterTempC ?? boilC;
            v = volumeFor(target, waterC);
            if (v === undefined) {
              notes.push(`${label}: Mit ${inf.ice ? 'Eis' : `${num(waterC)} °C`} lässt sich ${num(target)} °C nicht erreichen.`);
            }
          } else {
            v = inf.volumeL ?? 0;
            waterC = v > 0 ? target + (mass() * (target - t)) / v : target;
            if (v <= 0) notes.push(`${label}: ohne Wassermenge.`);
          }
          if (!inf.ice && (waterC > boilC + EPS || waterC < tapC - EPS)) {
            notes.push(`${label}: Das Wasser müsste ${num(waterC)} °C haben, möglich sind ${num(tapC)} °C (Leitungswasser) bis ${num(boilC)} °C (Siedepunkt).`);
          }
          v ??= 0;
          if (mass() + v > 0) t = (mass() * t + v * waterC) / (mass() + v);
          waterKg += v;
          infusionL += v;
          row = { waterL: v, waterTempC: waterC, ice: inf.ice, transition: { kind: 'mix', min: 0, text: 'Mischen' } };
          break;
        }
        case 'decoction':
          if (decoction) {
            row = decoct(s, label, s.decoction ?? { lead: 'temp', rests: [], boilMin: 0 }, decoction);
          } else {
            asRest.push(label);
            row = rest(s, label);
          }
          break;
      }
      const holdMin = s.kind === 'strike' ? 0 : s.durationMin ?? 0;
      const startMin = clock + row.transition.min;
      rows.push({ ...row, step: s, fromC: from, tempC: t, startMin, holdMin });
      clock = startMin + holdMin;
    }

    for (const c of charges) {
      if (!mashed.has(c.id)) notes.push(`${c.name} hat keinen Schritt Einmaischen und fehlt im Plan.`);
    }
    if (unknownRate) notes.push('Das Sudhaus hat weder Heizrate noch Heizleistung, die Heizzeiten fehlen.');
    if (estimatedRate) {
      notes.push(`Heizzeiten geschätzt aus der Heizleistung (Wirkungsgrad ${Math.round(HEATER_EFFICIENCY * 100)} %), genauer mit einer Heizrate im Sudhaus.`);
    }
    if (decoction) {
      const name = decoction.vessel.name;
      if (decoctionRate.has('power')) {
        notes.push(`Heizzeiten der Teilmaische geschätzt aus der Heizleistung von ${name} (Wirkungsgrad ${Math.round(HEATER_EFFICIENCY * 100)} %).`);
      }
      if (decoctionRate.has('step')) {
        notes.push(`Heizzeiten der Teilmaische aus der Heizrate von ${name}, die für die volle Füllung gilt; mit einer Heizleistung rechnet der Plan genauer.`);
      }
      if (decoctionRate.has('none')) notes.push(`${name} hat weder Heizleistung noch Heizrate, die Heizzeiten der Teilmaische fehlen.`);
    }
    if (asRest.length > 0) {
      notes.push(`Das Sudhaus hat keinen zweiten beheizten Behälter für eine Teilmaische, ${asRest.join(', ')} ${asRest.length === 1 ? 'zählt' : 'zählen'} wie eine Rast.`);
    }
    for (const name of noEvaporation) notes.push(`${name} hat keine Verdampfung, gerechnet wird mit 0 l/h.`);
    return { rows, infusionL, notes, heatRate, totalMin: clock };
  }

  // The strike row gets what the infusions leave of the strike water; the
  // infusions led by temperature grow with the mash, so solve by bisection.
  const excess = (w: number) => w + walk(w).infusionL - strikeL;
  let strikeWaterL = strikeL;
  const overflow = excess(0) >= 0;
  if (!overflow) {
    let lo = 0;
    let hi = strikeL;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (excess(mid) < 0) lo = mid; else hi = mid;
    }
    strikeWaterL = (lo + hi) / 2;
  }
  const result = walk(strikeWaterL);
  if (overflow) {
    result.notes.unshift(`Die Zubrühmengen (${fmtL(result.infusionL)}) sind größer als der Hauptguss (${fmtL(strikeL)}). `
      + 'Gerechnet wird mit dem ganzen Hauptguss zum Einmaischen, das Zubrühwasser kommt hinzu.');
  }
  return {
    rows: result.rows, totalMin: result.totalMin, boilC, strikeL, infusionL: result.infusionL,
    heating, heatRate: result.heatRate, decoction, notes: result.notes,
  };
}

// The plan without a brewhouse, for the temperature curve only: no strike
// water (its temperature needs the volumes), every step jumps to its target
// and holds it. A step without a target keeps the temperature before it: a
// further charge (its mixing temperature needs the volumes) or a rest without
// one. A boiling rest stops at the brewery's boiling point.
export function outlineMash(recipe: Recipe, brewery: Brewery | null): MashRow[] {
  const boilC = breweryBoilC(brewery);
  const charges = chargesOf(recipe);
  const grainOf = (chargeId: string) => recipe.ingredients
    .filter((i) => isMashGrain(i) && chargeIdOf(i, charges) === chargeId)
    .reduce((s, i) => s + i.amount, 0);
  const rows: MashRow[] = [];
  let t: number | undefined;
  let clock = 0;
  for (const [k, s] of recipe.mash.entries()) {
    if (s.kind === 'strike') continue;
    const from = t;
    if (isBoilRest(s, boilC)) t = boilC;
    else if (s.kind !== 'doughIn' || k === 1) t = s.tempC ?? t;
    if (t === undefined) continue;
    const charge = s.kind === 'doughIn' ? charges.find((c) => c.id === chargeIdOf(s, charges))! : undefined;
    const holdMin = s.durationMin ?? 0;
    rows.push({
      step: s, fromC: from ?? t, tempC: t, startMin: clock, holdMin,
      transition: { kind: 'none', min: 0, text: '—' },
      ...(charge ? { grainKg: grainOf(charge.id), chargeName: charge.name } : {}),
    });
    clock += holdMin;
  }
  return rows;
}
