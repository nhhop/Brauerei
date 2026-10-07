// Brewing water chemistry: profiles, blending, salts and acids, residual
// alkalinity and the water pH after acid. Pure, like brewMath.ts.
//
// Sources: MMuM Brauwasserrechner (maischemalzundmehr.de) for the agents and
// the lactic acid density; Troester 2009, "The effect of brewing water and
// grist composition on the pH of the mash" (braukaiser.com) for RA = Alk −
// Ca/3.5 − Mg/7 in mEq/l and for chalk acting only half when not dissolved.
// The carbonate equilibrium uses the constants at 25 °C and ignores ionic
// strength and CO₂ escaping, so the water pH is an estimate.

export type Ion = 'ca' | 'mg' | 'na' | 'k' | 'cl' | 'so4' | 'lactate' | 'phosphate';

// mg per mmol
const MOLAR: Record<Ion, number> = {
  ca: 40.078, mg: 24.305, na: 22.99, k: 39.098, cl: 35.453, so4: 96.06, lactate: 89.07, phosphate: 94.97,
};
const CHARGE: Record<Ion, number> = { ca: 2, mg: 2, na: 1, k: 1, cl: 1, so4: 2, lactate: 1, phosphate: 3 };
export const HCO3_MG_PER_MEQ = 61.017;
export const DH_PER_MEQ = 2.8;   // 1 mEq/l = 2.8 °dH

export type Ions = Record<Ion, number>;
const NO_IONS: Ions = { ca: 0, mg: 0, na: 0, k: 0, cl: 0, so4: 0, lactate: 0, phosphate: 0 };

// A water analysis, ions in mg/l. Without `ph` the pH after acid is unknown.
export interface WaterProfile {
  id: string;
  name: string;
  ca: number; mg: number; na: number; k?: number; cl: number; so4: number; hco3: number;
  ph?: number;
  note?: string;
}

// Demineralised water from a mixed-bed deioniser; fixed, never stored.
export const VE_WATER: WaterProfile = { id: 've', name: 'VE-Wasser', ca: 0, mg: 0, na: 0, k: 0, cl: 0, so4: 0, hco3: 0, ph: 7 };

// Input helpers for analyses that give hardness instead of ions.
export const HCO3_PER_KS43 = HCO3_MG_PER_MEQ;   // KS4,3 in mmol/l → HCO₃ mg/l
export const HCO3_PER_DH = 21.8;                 // Karbonathärte °dH → HCO₃ mg/l
export const CA_PER_DH = 7.14;                   // Calciumhärte °dH → Ca mg/l
export const MG_PER_DH = 4.34;                   // Magnesiumhärte °dH → Mg mg/l

// Relative gap between cations and anions (mEq), for the "check the analysis" hint.
export function ionBalance(p: WaterProfile): number {
  const meq = (ion: Ion, mg: number) => (mg / MOLAR[ion]) * CHARGE[ion];
  const cations = meq('ca', p.ca) + meq('mg', p.mg) + meq('na', p.na) + meq('k', p.k ?? 0);
  const anions = meq('cl', p.cl) + meq('so4', p.so4) + p.hco3 / HCO3_MG_PER_MEQ;
  const mean = (cations + anions) / 2;
  return mean > 0 ? Math.abs(cations - anions) / mean : 0;
}

// ── Agents ─────────────────────────────────────────────────────────────────────

export type WaterAgentId =
  | 'gypsum' | 'cacl2' | 'cacl2-solution' | 'epsom' | 'mgcl2' | 'nacl' | 'nahco3' | 'chalk' | 'lime'
  | 'lactic' | 'phosphoric' | 'hydrochloric' | 'sulfuric';

export interface WaterAgent {
  id: WaterAgentId;
  formula: string;
  form: 'solid' | 'liquid';       // solid in g, liquid in ml at a concentration
  molarMass: number;              // g/mol of the active substance (anhydrous for a solution)
  ions: Partial<Record<Ion, number>>;  // mol per mol
  alk?: number;                   // mEq of alkalinity per mmol (bases)
  ct?: number;                    // mmol of carbonate per mmol
  pKa?: number[];                 // acids: the protons they can give
  density?: [number, number][];   // liquids: [% w/w, g/ml] at 20 °C, ascending
  efficacy?: number;              // share that acts; chalk 0.5 (Troester)
}

// Densities: water at 0 %; lactic acid 80 % from MMuM; the others from the CRC
// Handbook table "Concentrative properties of aqueous solutions" (20 °C).
// TODO(verify): the CRC rows and lactic acid 88 % are written from memory.
const WATER_DENSITY = 0.998;
export const WATER_AGENTS: Record<WaterAgentId, WaterAgent> = {
  gypsum: { id: 'gypsum', formula: 'CaSO₄·2H₂O', form: 'solid', molarMass: 172.17, ions: { ca: 1, so4: 1 } },
  cacl2: { id: 'cacl2', formula: 'CaCl₂·2H₂O', form: 'solid', molarMass: 147.01, ions: { ca: 1, cl: 2 } },
  'cacl2-solution': {
    id: 'cacl2-solution', formula: 'CaCl₂', form: 'liquid', molarMass: 110.98, ions: { ca: 1, cl: 2 },
    density: [[0, WATER_DENSITY], [10, 1.0835], [20, 1.1775], [30, 1.2816], [40, 1.3957]],
  },
  epsom: { id: 'epsom', formula: 'MgSO₄·7H₂O', form: 'solid', molarMass: 246.47, ions: { mg: 1, so4: 1 } },
  mgcl2: { id: 'mgcl2', formula: 'MgCl₂·6H₂O', form: 'solid', molarMass: 203.3, ions: { mg: 1, cl: 2 } },
  nacl: { id: 'nacl', formula: 'NaCl', form: 'solid', molarMass: 58.44, ions: { na: 1, cl: 1 } },
  nahco3: { id: 'nahco3', formula: 'NaHCO₃', form: 'solid', molarMass: 84.007, ions: { na: 1 }, alk: 1, ct: 1 },
  chalk: { id: 'chalk', formula: 'CaCO₃', form: 'solid', molarMass: 100.09, ions: { ca: 1 }, alk: 2, ct: 1, efficacy: 0.5 },
  lime: { id: 'lime', formula: 'Ca(OH)₂', form: 'solid', molarMass: 74.09, ions: { ca: 1 }, alk: 2 },
  lactic: {
    id: 'lactic', formula: 'C₃H₆O₃', form: 'liquid', molarMass: 90.08, ions: { lactate: 1 }, pKa: [3.86],
    density: [[0, WATER_DENSITY], [80, 1.206], [88, 1.209]],
  },
  phosphoric: {
    id: 'phosphoric', formula: 'H₃PO₄', form: 'liquid', molarMass: 97.994, ions: { phosphate: 1 }, pKa: [2.15, 7.2, 12.35],
    density: [[0, WATER_DENSITY], [10, 1.0523], [20, 1.1134], [30, 1.1805], [40, 1.2536], [50, 1.335],
      [60, 1.4265], [70, 1.526], [75, 1.579], [80, 1.633], [85, 1.685]],
  },
  hydrochloric: {
    id: 'hydrochloric', formula: 'HCl', form: 'liquid', molarMass: 36.461, ions: { cl: 1 }, pKa: [-6],
    density: [[0, WATER_DENSITY], [10, 1.0474], [20, 1.098], [30, 1.1492], [37, 1.1837]],
  },
  sulfuric: {
    id: 'sulfuric', formula: 'H₂SO₄', form: 'liquid', molarMass: 98.079, ions: { so4: 1 }, pKa: [-3, 1.99],
    density: [[0, WATER_DENSITY], [10, 1.0661], [20, 1.1394], [30, 1.2185], [40, 1.3028], [50, 1.3951],
      [60, 1.4983], [70, 1.6105], [80, 1.7272], [90, 1.8144], [96, 1.8355]],
  },
};

export const isAcid = (a: WaterAgent) => a.pKa !== undefined;

// Piecewise linear, extrapolated from the last two points beyond the table.
export function densityAt(table: [number, number][], pct: number): number {
  let i = 1;
  while (i < table.length - 1 && table[i][0] < pct) i++;
  const [[x0, y0], [x1, y1]] = [table[i - 1], table[i]];
  return y0 + ((y1 - y0) * (pct - x0)) / (x1 - x0);
}

// Amount (g, or ml at `strengthPct`) → mmol of the active substance.
export function agentMmol(agent: WaterAgent, amount: number, strengthPct = 100): number {
  if (agent.form === 'solid') return (amount * 1000) / agent.molarMass;
  return (amount * densityAt(agent.density!, strengthPct) * (strengthPct / 100) * 1000) / agent.molarMass;
}

// Mean number of protons an acid has given off at `ph` (Henderson-Hasselbalch
// over all its pKa).
export function dissociated(pKa: number[], ph: number): number {
  const h = 10 ** -ph;
  let term = 1;
  let sum = 1;
  let weighted = 0;
  pKa.forEach((pk, j) => {
    term *= 10 ** -pk / h;
    sum += term;
    weighted += (j + 1) * term;
  });
  return weighted / sum;
}

// ── Water state ────────────────────────────────────────────────────────────────

// Ions in mg/l; `alk` is the alkalinity before acids, in mEq/l; `ct` the
// carbonate in mmol/l, unset when the profile has no pH. Acids stay separate
// because how much they give off depends on the pH they end up at.
export interface WaterState {
  ions: Ions;
  alk: number;
  ct?: number;
  acids: { pKa: number[]; mmolPerL: number }[];
}

// Carbonic acid at 25 °C
const PK1 = 6.35;
const PK2 = 10.33;
const PKW = 14;

function carbonateShare(ph: number): number {
  const h = 10 ** -ph;
  const k1 = 10 ** -PK1;
  const k2 = 10 ** -PK2;
  const d = h * h + k1 * h + k1 * k2;
  return (k1 * h + 2 * k1 * k2) / d;   // α1 + 2·α2
}
const freeBase = (ph: number) => (10 ** (ph - PKW) - 10 ** -ph) * 1000;  // OH⁻ − H⁺ in mmol/l

export function stateOf(p: WaterProfile): WaterState {
  const alk = p.hco3 / HCO3_MG_PER_MEQ;
  const ions: Ions = { ...NO_IONS, ca: p.ca, mg: p.mg, na: p.na, k: p.k ?? 0, cl: p.cl, so4: p.so4 };
  const ct = p.ph === undefined ? undefined : (alk - freeBase(p.ph)) / carbonateShare(p.ph);
  return { ions, alk, ct, acids: [] };
}

// Ions, alkalinity and carbonate add up by volume; `pctB` of water B.
export function blend(a: WaterState, b: WaterState, pctB: number): WaterState {
  const fb = Math.min(Math.max(pctB, 0), 100) / 100;
  const fa = 1 - fb;
  if (fb === 0) return a;
  if (fa === 0) return b;
  const ions = { ...NO_IONS };
  for (const k of Object.keys(ions) as Ion[]) ions[k] = fa * a.ions[k] + fb * b.ions[k];
  return {
    ions,
    alk: fa * a.alk + fb * b.alk,
    ct: a.ct === undefined || b.ct === undefined ? undefined : fa * a.ct + fb * b.ct,
    acids: [...a.acids.map((x) => ({ ...x, mmolPerL: x.mmolPerL * fa })), ...b.acids.map((x) => ({ ...x, mmolPerL: x.mmolPerL * fb }))],
  };
}

// Everything dissolved by `factor`, as when the boil drives off water.
export function concentrate(w: WaterState, factor: number): WaterState {
  const ions = { ...w.ions };
  for (const k of Object.keys(ions) as Ion[]) ions[k] *= factor;
  return {
    ions, alk: w.alk * factor, ct: w.ct === undefined ? undefined : w.ct * factor,
    acids: w.acids.map((a) => ({ ...a, mmolPerL: a.mmolPerL * factor })),
  };
}

export interface Dose { agent: WaterAgent; mmol: number }

// Adds the doses (mmol each) to `volumeL` of the water.
export function applyAgents(water: WaterState, volumeL: number, doses: Dose[]): WaterState {
  if (volumeL <= 0 || doses.length === 0) return water;
  const ions = { ...water.ions };
  let { alk, ct } = water;
  const acids = [...water.acids];
  for (const { agent, mmol } of doses) {
    const c = (mmol / volumeL) * (agent.efficacy ?? 1);
    for (const [ion, n] of Object.entries(agent.ions) as [Ion, number][]) ions[ion] += n * c * MOLAR[ion];
    alk += (agent.alk ?? 0) * c;
    if (ct !== undefined) ct += (agent.ct ?? 0) * c;
    if (agent.pKa) acids.push({ pKa: agent.pKa, mmolPerL: c });
  }
  return { ions, alk, ct, acids };
}

// Acids count with what they give off at the mash pH, where the alkalinity
// they neutralise matters.
export const RA_REFERENCE_PH = 5.4;

export interface WaterFigures {
  ions: Ions;            // mg/l
  hco3: number;          // mg/l, from the alkalinity left
  alk: number;           // mEq/l after acids
  ra: number;            // mEq/l
  raDh: number;
  so4Cl?: number;
  ph?: number;
}

export function figuresOf(w: WaterState): WaterFigures {
  const alk = w.alk - w.acids.reduce((s, a) => s + a.mmolPerL * dissociated(a.pKa, RA_REFERENCE_PH), 0);
  const ra = alk - w.ions.ca / (MOLAR.ca / 2) / 3.5 - w.ions.mg / (MOLAR.mg / 2) / 7;
  return {
    ions: w.ions,
    hco3: Math.max(alk, 0) * HCO3_MG_PER_MEQ,
    alk, ra, raDh: ra * DH_PER_MEQ,
    so4Cl: w.ions.cl > 0 ? w.ions.so4 / w.ions.cl : undefined,
    ph: waterPh(w),
  };
}

// Charge balance of the carbonate system plus the acids, solved for the pH
// by bisection. The left side grows with the pH, so the root is unique.
export function waterPh(w: WaterState): number | undefined {
  if (w.ct === undefined) return undefined;
  const ct = w.ct;
  const f = (ph: number) => ct * carbonateShare(ph) + freeBase(ph) - w.alk
    + w.acids.reduce((s, a) => s + a.mmolPerL * dissociated(a.pKa, ph), 0);
  let lo = 0;
  let hi = 14;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Amount of an agent that brings the pH to `targetPh`, where `phWith(amount)`
// falls (acid) or rises (base) with the amount; 0 if the agent cannot get
// there, undefined without a known pH.
export function amountForPh(phWith: (amount: number) => number | undefined, targetPh: number): number | undefined {
  const start = phWith(0);
  if (start === undefined) return undefined;
  const dir = Math.sign(phWith(1)! - start);
  if (dir === 0 || (targetPh - start) * dir <= 0) return 0;
  const short = (amount: number) => (phWith(amount)! - targetPh) * dir < 0;
  let hi = 1;
  while (short(hi)) {
    hi *= 2;
    if (hi > 1e5) return undefined;
  }
  let lo = 0;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (short(mid)) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
