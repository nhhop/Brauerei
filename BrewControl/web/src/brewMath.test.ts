import { describe, it, expect } from 'vitest';
import {
  cylinderVolumeL, frustumVolumeL, dilutionVolumeL, boilDownResult, blendGravitySg,
  strikeWaterTempC, extractEfficiencyPercent, primingSugarGrams, hydrometerCorrectedSg,
  overrangeConcentration, apparentExtractFromRefractometer, originalExtractFromDualMeasurement,
  ballingBeerAnalysis,
} from './brewMath';
import { platoToSg } from './gravityUnits';

describe('cylinderVolumeL', () => {
  it('matches V = pi r^2 h for a 40cm diameter, 30cm fill', () => {
    // r=20cm, h=30cm -> pi*400*30 cm^3 = 37699 cm^3 = 37.7 L
    expect(cylinderVolumeL(40, 30)).toBeCloseTo(37.7, 1);
  });
});

describe('frustumVolumeL', () => {
  it('matches the cylinder formula when both diameters are equal', () => {
    expect(frustumVolumeL(40, 40, 30, 30)).toBeCloseTo(cylinderVolumeL(40, 30), 6);
  });
  it('matches the standard full-frustum formula V=(pi*h/3)(R^2+Rr+r^2) at full fill', () => {
    const R = 25, r = 10, h = 40; // cm
    const expectedCm3 = ((Math.PI * h) / 3) * (R * R + R * r + r * r);
    expect(frustumVolumeL(r * 2, R * 2, h, h)).toBeCloseTo(expectedCm3 / 1000, 6);
  });
  it('clamps fill height to the vessel height', () => {
    expect(frustumVolumeL(10, 30, 40, 100)).toBeCloseTo(frustumVolumeL(10, 30, 40, 40), 9);
  });
});

describe('dilutionVolumeL', () => {
  it('dilutes 20L at 1.060 down to 1.048 with plain water', () => {
    const add = dilutionVolumeL(20, 1.06, 1.048, 1.0);
    // 20*60 = (20+add)*48 -> add = 20*(60-48)/48
    expect(add).toBeCloseTo((20 * (60 - 48)) / 48, 6);
  });
});

describe('boilDownResult', () => {
  it('is the inverse of dilution (mass-balance round trip)', () => {
    const { finalVolumeL } = boilDownResult(25, 1.040, 1.050, 3);
    expect(finalVolumeL).toBeCloseTo((25 * 40) / 50, 6);
  });
});

describe('blendGravitySg', () => {
  it('equal volumes of 1.040 and 1.060 blend to 1.050', () => {
    expect(blendGravitySg(10, 1.04, 10, 1.06)).toBeCloseTo(1.05, 6);
  });
});

describe('strikeWaterTempC', () => {
  it('returns the target mash temp when grain is already at target temp', () => {
    expect(strikeWaterTempC(20, 5, 66, 66)).toBeCloseTo(66, 6);
  });
  it('requires hotter strike water when grain is colder than the target', () => {
    expect(strikeWaterTempC(20, 5, 20, 66)).toBeGreaterThan(66);
  });
});

describe('extractEfficiencyPercent', () => {
  it('is 100% when actual extract exactly matches the theoretical maximum', () => {
    const grainKg = 5;
    const potentialPercent = 80;
    const theoreticalExtractKg = grainKg * (potentialPercent / 100);
    // pick a volume/gravity pair whose extract mass equals theoreticalExtractKg
    const volumeL = 20;
    const gravityPlato = 10;
    const sg = platoToSg(gravityPlato);
    const actualKg = volumeL * sg * (gravityPlato / 100);
    const scaledGrainKg = actualKg / (potentialPercent / 100);
    expect(extractEfficiencyPercent(scaledGrainKg, potentialPercent, volumeL, gravityPlato)).toBeCloseTo(100, 6);
  });
});

describe('primingSugarGrams', () => {
  it('is zero when the target is already met by residual CO2', () => {
    expect(primingSugarGrams(20, 0.5, 20, 'saccharose')).toBe(0);
  });
  it('requires more traubenzucker mass than saccharose for the same CO2 target', () => {
    const s = primingSugarGrams(20, 2.5, 18, 'saccharose');
    const t = primingSugarGrams(20, 2.5, 18, 'traubenzucker');
    expect(t).toBeGreaterThan(s);
  });
});

describe('hydrometerCorrectedSg', () => {
  it('returns the measured value unchanged when at calibration temperature', () => {
    expect(hydrometerCorrectedSg(1.050, 20, 20)).toBeCloseTo(1.050, 6);
  });
});

describe('overrangeConcentration', () => {
  it('reconstructs the true concentration from a diluted reading', () => {
    // 100g wort diluted with 100g water reads 15 Brix -> true concentration 30
    expect(overrangeConcentration(100, 100, 15)).toBeCloseTo(30, 6);
  });
});

// Reference values below are the worked example from "Stammwürzeermittlung
// nach Novotný linear..." (Weiß, O., V02, 2024): Es=3 %w/w, Bg=6.4 °Bx,
// BCF=1.03 — reproduced exactly (see PLAN.md / SESSION.md for the source).
describe('originalExtractFromDualMeasurement', () => {
  it('matches the worked reference example (Es=3, Bg=6.4, BCF=1.03 -> Bwc=11.6046)', () => {
    const bwc = originalExtractFromDualMeasurement(3, 6.4, 1.03);
    expect(bwc).toBeCloseTo(11.60456905954398, 6);
  });
});

describe('apparentExtractFromRefractometer', () => {
  it('is the algebraic inverse of originalExtractFromDualMeasurement', () => {
    const bwc = originalExtractFromDualMeasurement(3, 6.4, 1.03);
    const es = apparentExtractFromRefractometer(bwc, 6.4, 1.03);
    expect(es).toBeCloseTo(3, 6);
  });
});

describe('ballingBeerAnalysis', () => {
  it('matches the worked reference example (Bwc=11.6046, Es=3)', () => {
    const bwc = 11.60456905954398;
    const analysis = ballingBeerAnalysis(bwc, 3);
    expect(analysis.abwPercent).toBeCloseTo(3.5397202326062924, 6);
    expect(analysis.abvPercent).toBeCloseTo(4.530935299904413, 6);
    expect(analysis.realExtractPercent).toBeCloseTo(4.727700383717004, 6);
    expect(analysis.apparentAttenuationPercent).toBeCloseTo(74.14811369033389, 6);
  });
  it('attenuation is 0% when FG equals OG', () => {
    const { apparentAttenuationPercent } = ballingBeerAnalysis(12, 12);
    expect(apparentAttenuationPercent).toBeCloseTo(0, 6);
  });
});
