import { describe, expect, it } from 'vitest';
import {
  HCO3_PER_KS43, VE_WATER, WATER_AGENTS, agentMmol, amountForPh, applyAgents, blend, densityAt, dissociated,
  figuresOf, ionBalance, stateOf, waterPh, type WaterProfile,
} from './waterChem';

// The user's tap water (WW Wittkoppenberg, 03.03.2026), HCO₃ from KS4,3 = 3.73 mmol/l.
const tap: WaterProfile = {
  id: 'tap', name: 'Leitungswasser', ca: 96.7, mg: 6.29, na: 32.4, k: 2.18, cl: 77, so4: 36,
  hco3: 3.73 * HCO3_PER_KS43, ph: 7.4,
};
const lactic = WATER_AGENTS.lactic;

describe('waterChem', () => {
  it('gives the RA of the tap water', () => {
    const f = figuresOf(stateOf(tap));
    expect(f.ra).toBeCloseTo(2.28, 2);
    expect(f.raDh).toBeCloseTo(6.4, 1);
    expect(f.so4Cl).toBeCloseTo(36 / 77, 6);
    expect(f.ph).toBeCloseTo(7.4, 6);
  });

  it('checks the ion balance of an analysis', () => {
    expect(ionBalance(tap)).toBeLessThan(0.1);
    expect(ionBalance({ ...tap, so4: 300 })).toBeGreaterThan(0.1);
  });

  it('halves RA and ions with 50 % VE water', () => {
    const half = figuresOf(blend(stateOf(tap), stateOf(VE_WATER), 50));
    expect(half.ra).toBeCloseTo(figuresOf(stateOf(tap)).ra / 2, 9);
    expect(half.ions.ca).toBeCloseTo(tap.ca / 2, 9);
    expect(half.ph).toBeGreaterThan(7);
  });

  it('leaves VE water at pH 7 and without ions', () => {
    const f = figuresOf(stateOf(VE_WATER));
    expect(f.ph).toBeCloseTo(7, 6);
    expect(f.ra).toBe(0);
  });

  it('counts lactic acid like the MMuM formula (80 %, 1.206 g/ml, 90.08 g/mol)', () => {
    expect(agentMmol(lactic, 1, 80)).toBeCloseTo((1.206 * 0.8 * 1000) / 90.08, 9);
    // 1 ml in 10 l lowers the alkalinity by what it gives off at mash pH.
    const before = figuresOf(stateOf(tap));
    const after = figuresOf(applyAgents(stateOf(tap), 10, [{ agent: lactic, mmol: agentMmol(lactic, 1, 80) }]));
    expect(before.alk - after.alk).toBeCloseTo(((1.206 * 0.8 * 1000) / 90.08 / 10) * dissociated([3.86], 5.4), 9);
    expect(after.ions.lactate).toBeGreaterThan(0);
  });

  it('adds the ions of a salt', () => {
    // 1 g gypsum in 10 l: 5.81 mmol → 23.3 mg/l Ca and 55.8 mg/l SO₄
    const f = figuresOf(applyAgents(stateOf(VE_WATER), 10, [{ agent: WATER_AGENTS.gypsum, mmol: agentMmol(WATER_AGENTS.gypsum, 1) }]));
    expect(f.ions.ca).toBeCloseTo(23.28, 1);
    expect(f.ions.so4).toBeCloseTo(55.79, 1);
    expect(f.ra).toBeLessThan(0);
  });

  it('lets undissolved chalk act half', () => {
    const f = figuresOf(applyAgents(stateOf(VE_WATER), 10, [{ agent: WATER_AGENTS.chalk, mmol: 10 }]));
    expect(f.alk).toBeCloseTo(1, 9);    // 10 mmol · 2 mEq · 0.5 / 10 l
  });

  it('lowers the pH monotonically with more acid', () => {
    const phs = [0, 1, 2, 4, 8].map((ml) =>
      waterPh(applyAgents(stateOf(tap), 20, [{ agent: lactic, mmol: agentMmol(lactic, ml, 80) }]))!);
    for (let i = 1; i < phs.length; i++) expect(phs[i]).toBeLessThan(phs[i - 1]);
  });

  it('finds the acid or base for a target pH, and nothing in the wrong direction', () => {
    const withAgent = (p: WaterProfile, agent: typeof lactic, pct = 100) => (amount: number) =>
      waterPh(applyAgents(stateOf(p), 15, [{ agent, mmol: agentMmol(agent, amount, pct) }]));
    const ml = amountForPh(withAgent(tap, lactic, 80), 5.8)!;
    expect(ml).toBeGreaterThan(0);
    expect(withAgent(tap, lactic, 80)(ml)).toBeCloseTo(5.8, 3);
    expect(amountForPh(withAgent(tap, lactic, 80), 7.8)).toBe(0);
    expect(amountForPh(withAgent({ ...tap, ph: undefined }, lactic, 80), 5.8)).toBeUndefined();
    const g = amountForPh(withAgent(tap, WATER_AGENTS.nahco3), 7.8)!;
    expect(withAgent(tap, WATER_AGENTS.nahco3)(g)).toBeCloseTo(7.8, 3);
  });

  it('interpolates densities and dissociation', () => {
    expect(densityAt(WATER_AGENTS.phosphoric.density!, 75)).toBe(1.579);
    expect(densityAt(WATER_AGENTS.hydrochloric.density!, 15)).toBeCloseTo((1.0474 + 1.098) / 2, 9);
    expect(dissociated([-3, 1.99], 5.4)).toBeCloseTo(2, 3);
    expect(dissociated([3.86], 3.86)).toBeCloseTo(0.5, 9);
  });
});
