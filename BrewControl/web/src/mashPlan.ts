// Mash plan (tab "Maischen"): strike temperature, mixing temperatures, infusion
// volumes and heating times from heat balances. Pure, like recipeWater.ts.
//
// Heat balance: the mash warms like M = water [kg] + 0.41 × grain [kg] of water.
// The vessel's own heat capacity is left out, as in Palmer.
import { GRAIN_HEAT_RATIO, strikeWaterTempC } from './brewMath';
import { breweryBoilC, heatingOf, type Brewery, type Brewhouse, type Heating, type StepKey } from './brewhouse';
import { chargeIdOf, chargesOf, isMashGrain, type MashStep, type Recipe } from './recipes';
import { fmtL, type Water } from './recipeWater';

export const WATER_J_PER_KG_K = 4186;
// Ice at 0 °C counts as water of this temperature: it takes up its latent heat
// of 334 kJ/kg while melting, then warms from 0 °C.
export const ICE_TEMP_C = -334 / 4.186;
// TODO(verify): share of a heater's power that reaches the mash, for the estimate
// when the brewhouse has no heat rate.
export const HEATER_EFFICIENCY = 0.85;
// TODO(verify): passive cooling of the mash; a rule of thumb, it depends on the vessel.
export const PASSIVE_COOL_K_PER_MIN = 0.2;

export interface Transition {
  kind: 'heat' | 'cool' | 'mix' | 'none';
  min: number;          // 0 when unknown (no heat rate) or instant (mixing)
  text: string;
}

export interface MashRow {
  step: MashStep;
  waterL?: number;      // strike: water put in; infusion, or a rest reached by infusion: water added
  waterTempC?: number;  // that water's temperature (strike: the computed strike temperature)
  ice?: boolean;
  grainKg?: number;     // doughIn
  chargeName?: string;  // doughIn
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
    let massKg = 0;
    let t = tapC;
    let clock = 0;
    let infusionL = 0;
    let unknownRate = false;
    let estimatedRate = false;
    let heatRate: MashPlan['heatRate'];

    const heat = (step: StepKey, from: number, to: number, mass: number): Transition => {
      const rate = rateOf(bh, step, mass);
      if (!rate) { unknownRate = true; return { kind: 'heat', min: 0, text: 'Heizen' }; }
      if (rate.estimated) estimatedRate = true;
      const min = (to - from) / rate.kPerMin;
      return { kind: 'heat', min, text: `Heizen ${Math.round(min)} min` };
    };
    // Water of `waterC` that brings the mash from t to `target`; 0 when it cannot.
    const volumeFor = (target: number, waterC: number) => {
      const v = (massKg * (target - t)) / (waterC - target);
      return Number.isFinite(v) && v >= 0 ? v : undefined;
    };

    for (const [k, s] of steps.entries()) {
      const from = t;
      let row: Omit<MashRow, 'startMin' | 'holdMin' | 'fromC' | 'tempC' | 'step'>;
      const label = `„${s.name || 'ohne Namen'}“`;
      switch (s.kind) {
        case 'strike': {
          const target = steps[1]?.tempC ?? t;
          const grain = grainOf(charges[0].id);
          const strikeC = grain > 0 && strikeWaterL > 0 ? strikeWaterTempC(strikeWaterL, grain, grainC, target) : target;
          if (strikeC > boilC + EPS) notes.push(`Die Hauptguss-Temperatur (${num(strikeC)} °C) liegt über dem Siedepunkt (${num(boilC)} °C).`);
          row = { waterL: strikeWaterL, waterTempC: strikeC, transition: heat(strikeStep, tapC, strikeC, strikeWaterL) };
          massKg = strikeWaterL;
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
          if (massKg + grainMass > 0) t = (massKg * t + grainMass * grainC) / (massKg + grainMass);
          massKg += grainMass;
          row = { grainKg: grain, chargeName: charge.name, transition: { kind: 'mix', min: 0, text: 'Mischen' } };
          if (k === 1) heatRate = byInfusion ? undefined : rateOf(bh, 'mash', massKg);
          break;
        }
        case 'rest': {
          const target = s.tempC ?? t;
          if (target > t + EPS && byInfusion) {
            const v = volumeFor(target, boilC) ?? 0;
            infusionL += v;
            massKg += v;
            t = target;
            row = { waterL: v, waterTempC: boilC, transition: { kind: 'mix', min: 0, text: 'Zubrühen (Aufguss)' } };
          } else if (target > t + EPS) {
            row = { transition: heat('mash', t, target, massKg) };
            t = target;
          } else if (target < t - EPS) {
            const min = (t - target) / PASSIVE_COOL_K_PER_MIN;
            notes.push(`${label}: Abkühlen geschätzt (${num(PASSIVE_COOL_K_PER_MIN)} K/min), kalt zubrühen?`);
            row = { transition: { kind: 'cool', min, text: `Abkühlen ~${Math.round(min)} min` } };
            t = target;
          } else {
            row = { transition: { kind: 'none', min: 0, text: '—' } };
          }
          break;
        }
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
            waterC = v > 0 ? target + (massKg * (target - t)) / v : target;
            if (v <= 0) notes.push(`${label}: ohne Wassermenge.`);
          }
          if (!inf.ice && (waterC > boilC + EPS || waterC < tapC - EPS)) {
            notes.push(`${label}: Das Wasser müsste ${num(waterC)} °C haben, möglich sind ${num(tapC)} °C (Leitungswasser) bis ${num(boilC)} °C (Siedepunkt).`);
          }
          v ??= 0;
          if (massKg + v > 0) t = (massKg * t + v * waterC) / (massKg + v);
          massKg += v;
          infusionL += v;
          row = { waterL: v, waterTempC: waterC, ice: inf.ice, transition: { kind: 'mix', min: 0, text: 'Mischen' } };
          break;
        }
        default:
          notes.push(`${label}: Dekoktion kommt mit Etappe 3d und zählt noch nicht.`);
          row = { transition: { kind: 'none', min: 0, text: '—' } };
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
    heating, heatRate: result.heatRate, notes: result.notes,
  };
}
