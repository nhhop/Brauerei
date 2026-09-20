import { describe, it, expect } from 'vitest';
import { platoToSg, sgToPlato, convertGravity } from './gravityUnits';

describe('platoToSg', () => {
  it('0°P is SG 1.000', () => {
    expect(platoToSg(0)).toBeCloseTo(1.0, 6);
  });
  it('12°P is close to SG 1.048', () => {
    expect(platoToSg(12)).toBeCloseTo(1.048, 2);
  });
  it('matches the worked reference example (Es=3 -> SG=1.0117373721335001)', () => {
    // From "Stammwürzeermittlung nach Novotný linear..." (Weiß, O., V02, 2024).
    expect(platoToSg(3)).toBeCloseTo(1.0117373721335001, 9);
  });
});

describe('sgToPlato / platoToSg round-trip', () => {
  it('round-trips exactly — the two formulas are algebraic inverses', () => {
    const original = 12.5;
    const roundTripped = sgToPlato(platoToSg(original));
    expect(roundTripped).toBeCloseTo(original, 6);
  });
});

describe('convertGravity', () => {
  it('is a no-op when from === to', () => {
    expect(convertGravity(1.050, 'sg', 'sg')).toBe(1.050);
  });
  it('plato -> sg -> plato round-trips exactly', () => {
    const sg = convertGravity(12, 'plato', 'sg');
    const backToPlato = convertGravity(sg, 'sg', 'plato');
    expect(backToPlato).toBeCloseTo(12, 6);
  });
  it('brix is treated as plato', () => {
    expect(convertGravity(12, 'brix', 'plato')).toBe(12);
  });
});
