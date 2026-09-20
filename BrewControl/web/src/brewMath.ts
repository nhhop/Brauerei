// Brewing-process calculator formulas (measuring, mixing, efficiency,
// carbonation). Pure functions, no UI/framework dependencies, so both the
// Rechner page and the future recipe-development feature can reuse them.
//
// Formulas marked TODO(verify) use commonly published homebrewing constants
// that have not been cross-checked against a primary source yet — see
// PLAN.md "Bugs & bekannte Einschränkungen" for the list.

import { platoToSg, sgToPlato } from './gravityUnits';

// ── Volumen ──────────────────────────────────────────────────────────────

export function cylinderVolumeL(diameterCm: number, fillHeightCm: number): number {
  const r = diameterCm / 2;
  return (Math.PI * r * r * fillHeightCm) / 1000;
}

// Inverted truncated cone (Kegelstumpf): narrow end (diameterBottomCm) at the
// bottom, wide end (diameterTopCm) at the top, total cone height heightCm.
// Returns the liquid volume for the given fill height measured from the
// bottom. Exact closed-form integral of the linearly-interpolated radius —
// degenerates to the cylinder formula when both diameters are equal, and to
// the standard frustum volume V=(πh/3)(R²+Rr+r²) at full fill.
export function frustumVolumeL(diameterBottomCm: number, diameterTopCm: number, heightCm: number, fillHeightCm: number): number {
  const h = Math.min(Math.max(fillHeightCm, 0), heightCm);
  const a = diameterBottomCm / 2;
  const slope = (diameterTopCm / 2 - a) / heightCm;
  const volumeCm3 = Math.PI * (a * a * h + a * slope * h * h + (slope * slope * h * h * h) / 3);
  return volumeCm3 / 1000;
}

// ── Mischen ──────────────────────────────────────────────────────────────

// Gravity-point ("GU") mixing approximation — (SG-1)*1000 is treated as
// additive by volume. Standard homebrewing simplification, accurate for
// typical wort/beer gravities.
function gravityPoints(sg: number): number {
  return (sg - 1) * 1000;
}
function fromGravityPoints(points: number): number {
  return 1 + points / 1000;
}

// Volume of blending liquid (gravity blendSg, default plain water = 1.000)
// needed to dilute volumeL of wort at gravity currentSg down to targetSg.
export function dilutionVolumeL(volumeL: number, currentSg: number, targetSg: number, blendSg: number): number {
  const p1 = gravityPoints(currentSg);
  const pt = gravityPoints(targetSg);
  const pb = gravityPoints(blendSg);
  return (volumeL * (p1 - pt)) / (pt - pb);
}

// Boil-down: final volume after boiling volumeL at currentSg down to targetSg
// (removing pure water only), and the boil time needed at a given
// evaporation rate (L/h).
export function boilDownResult(volumeL: number, currentSg: number, targetSg: number, evaporationRateLPerH: number): { finalVolumeL: number; removedVolumeL: number; boilTimeH: number } {
  const finalVolumeL = (volumeL * gravityPoints(currentSg)) / gravityPoints(targetSg);
  const removedVolumeL = volumeL - finalVolumeL;
  return { finalVolumeL, removedVolumeL, boilTimeH: removedVolumeL / evaporationRateLPerH };
}

// Generic volume-weighted mix of two liquids (Mischkreuz) — same formula for
// gravity (as SG) or temperature.
export function blendWeighted(v1: number, q1: number, v2: number, q2: number): number {
  return (v1 * q1 + v2 * q2) / (v1 + v2);
}

export function blendGravitySg(v1L: number, sg1: number, v2L: number, sg2: number): number {
  return fromGravityPoints(blendWeighted(v1L, gravityPoints(sg1), v2L, gravityPoints(sg2)));
}

// Strike water temperature (Einmaischtemperatur) — Palmer-style formula,
// metric variant (R = water in L per grain in kg). The 0.41 specific-heat
// ratio constant is the commonly published metric value.
// TODO(verify): cross-check 0.41 against a primary source.
export function strikeWaterTempC(waterL: number, grainKg: number, grainTempC: number, targetMashTempC: number): number {
  const ratio = waterL / grainKg;
  return (0.41 / ratio) * (targetMashTempC - grainTempC) + targetMashTempC;
}

// ── Effizienz ────────────────────────────────────────────────────────────

// Shared extract-efficiency formula, applied at different brew-day
// checkpoints (post-lauter = Maischeeffizienz, post-boil = Sudhausausbeute,
// into-fermenter = Brewhouse-Efficiency). potentialPercent is the grain's
// theoretical extract yield at 100% efficiency (kg extract / kg grain × 100).
export function extractEfficiencyPercent(grainKg: number, potentialPercent: number, volumeL: number, gravityPlato: number): number {
  const sg = platoToSg(gravityPlato);
  const actualExtractKg = volumeL * sg * (gravityPlato / 100);
  const theoreticalExtractKg = grainKg * (potentialPercent / 100);
  return (actualExtractKg / theoreticalExtractKg) * 100;
}

// ── Karbonisierung ───────────────────────────────────────────────────────

export type SugarType = 'saccharose' | 'traubenzucker' | 'dme';

// CO2 grams released per gram of sugar, from fermentation stoichiometry
// (C6H12O6 → 2 C2H5OH + 2 CO2; sucrose inverts to two fermentable hexoses).
// DME is not pure sugar — its fermentable-equivalent yield is approximated
// as a multiple of the dextrose figure.
// TODO(verify): DME multiplier (1.4) is a commonly cited rule of thumb.
const CO2_YIELD_G_PER_G: Record<SugarType, number> = {
  saccharose: (4 * 44.01) / 342.3, // inverts to 2 hexoses, 2 CO2 each
  traubenzucker: (2 * 44.01) / 180.16,
  dme: ((2 * 44.01) / 180.16) / 1.4,
};

// CO2 density at 0°C/1atm (definition of "1 volume of CO2" per liter of beer).
const CO2_G_PER_L_PER_VOLUME = 44.01 / 22.414;

// Residual (already-dissolved) CO2 at a given temperature — standard cubic
// fit (formula defined in °F internally).
// TODO(verify): cross-check against a primary source.
export function residualCo2Volumes(tempC: number): number {
  const f = (tempC * 9) / 5 + 32;
  return 3.0378 - 0.050062 * f + 0.00026555 * f * f;
}

export function primingSugarGrams(volumeL: number, targetVolumes: number, tempC: number, sugarType: SugarType): number {
  const neededVolumes = Math.max(0, targetVolumes - residualCo2Volumes(tempC));
  const co2Grams = neededVolumes * volumeL * CO2_G_PER_L_PER_VOLUME;
  return co2Grams / CO2_YIELD_G_PER_G[sugarType];
}

// Speise (unfermented wort) amount needed for the same CO2 target, given the
// Speise's own gravity and an assumed attenuation (fraction of its extract
// that will actually ferment out).
export function speiseVolumeL(volumeL: number, targetVolumes: number, tempC: number, speiseGravityPlato: number, attenuationFraction: number): number {
  const neededVolumes = Math.max(0, targetVolumes - residualCo2Volumes(tempC));
  const co2Grams = neededVolumes * volumeL * CO2_G_PER_L_PER_VOLUME;
  const fermentableExtractNeededG = co2Grams / CO2_YIELD_G_PER_G.traubenzucker;
  const speiseSg = platoToSg(speiseGravityPlato);
  const extractPerLiterG = 1000 * speiseSg * (speiseGravityPlato / 100) * attenuationFraction;
  return fermentableExtractNeededG / extractPerLiterG;
}

// Recommended racking (Grünschlauchen) gravity — practice is to rack at a
// fraction of the expected total attenuation rather than a predicted time,
// since fermentation speed varies too much to predict reliably.
export function recommendedRackingGravityPlato(ogPlato: number, expectedFgPlato: number, fraction = 0.85): number {
  return ogPlato - fraction * (ogPlato - expectedFgPlato);
}

// ── Messen ───────────────────────────────────────────────────────────────

// Hydrometer temperature correction — standard cubic correction polynomial
// (formula defined in °F internally).
export function hydrometerCorrectedSg(measuredSg: number, measuredTempC: number, calibrationTempC: number): number {
  const ct = (t: number) => {
    const f = (t * 9) / 5 + 32;
    return 1.00130346 - 0.000134722124 * f + 0.00000204052596 * f * f - 0.00000000232820948 * f * f * f;
  };
  return measuredSg * (ct(measuredTempC) / ct(calibrationTempC));
}

// Novotný (2017) linear correlation between original extract (Bwc, °Plato),
// a BCF-corrected current refractometer reading (Bgc, °Brix) and the SG a
// hydrometer would currently show: SG = 1 + 0.006276*Bgc - 0.002349*Bwc.
// Source: "Stammwürzeermittlung nach Novotný linear..." (Weiß, O., V02,
// 2024), itself citing Novotný, P. (2017), Zymurgy 40(4), 49–54, and
// Ascher, T., BrauCampus Graz (2021) "Alkoholmessung mit dem Refraktometer".
// bcf is the device-dependent Brix-Korrekturfaktor (typically ~1.03).
function correctBrix(rawBrix: number, bcf: number): number {
  return rawBrix / bcf;
}

// Estimate the current apparent extract (what a hydrometer would show now,
// °Plato) from a raw refractometer reading plus the known original extract —
// for when no hydrometer reading is available.
export function apparentExtractFromRefractometer(originalExtractPlato: number, rawBrix: number, bcf = 1.03): number {
  const bgc = correctBrix(rawBrix, bcf);
  const sgNow = 1 + 0.006276 * bgc - 0.002349 * originalExtractPlato;
  return sgToPlato(sgNow);
}

// Reconstruct the original extract (Bwc, °Plato) from a refractometer
// reading plus a hydrometer reading taken now — for when the OG was never
// measured. Algebraic inverse of the Novotný relation above.
export function originalExtractFromDualMeasurement(apparentExtractNowPlato: number, rawBrix: number, bcf = 1.03): number {
  const bgc = correctBrix(rawBrix, bcf);
  const sgNow = platoToSg(apparentExtractNowPlato);
  return (sgNow - 1 - 0.006276 * bgc) / -0.002349;
}

// Over-range measurement ("Würze durch die Decke"): back-calculate the true
// concentration of an undiluted sample from a diluted reading. Mass-based
// dilution — exact extract-mass balance, no empirical constants.
export function overrangeConcentration(undilutedMassG: number, addedWaterMassG: number, dilutedConcentration: number): number {
  return (dilutedConcentration * (undilutedMassG + addedWaterMassG)) / undilutedMassG;
}

// ── Alkohol / Endvergärungsgrad ──────────────────────────────────────────
//
// Balling attenuation formulas, applied downstream of the original extract
// (from either input directly, or reconstructed via
// originalExtractFromDualMeasurement above). Same source as the Novotný
// correction, additionally citing Balling, C.J.N. (1845), Die Gährungschemie,
// Bd. 1, and a mass-loss factor (0.4228) sourced from Weiß, O. (2024),
// https://hobbybrauer.de/forum/viewtopic.php?p=532056#p532056.

export interface BeerAnalysis {
  apparentAttenuationPercent: number; // Vs
  realAttenuationPercent: number;
  abwPercent: number; // Alc. %w/w
  abvPercent: number; // Alc. %v/v
  realExtractPercent: number; // Ew, %w/w
}

export function ballingBeerAnalysis(originalExtractPlato: number, apparentExtractPlato: number): BeerAnalysis {
  const fermentedApparent = originalExtractPlato - apparentExtractPlato; // vEs
  const fermentedReal = fermentedApparent * 0.8192; // vEw
  const beerMassPer100gWort = 100 - fermentedApparent * 0.4228; // Ballingschwund
  const abw = ((fermentedReal * 0.4839) / beerMassPer100gWort) * 100;
  const realExtractPercent = ((originalExtractPlato - fermentedReal) / beerMassPer100gWort) * 100;
  const abv = (abw / 0.789) * (261.1 / (261.53 - apparentExtractPlato));
  return {
    apparentAttenuationPercent: (fermentedApparent / originalExtractPlato) * 100,
    realAttenuationPercent: ((originalExtractPlato - realExtractPercent) / originalExtractPlato) * 100,
    abwPercent: abw,
    abvPercent: abv,
    realExtractPercent,
  };
}
