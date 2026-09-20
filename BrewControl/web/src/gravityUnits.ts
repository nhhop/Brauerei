// Shared gravity-unit conversion kernel — every brewing calculator that
// accepts a wort/beer concentration goes through this file, so the °Plato ⇄
// SG ⇄ Brix conversion lives in exactly one place.

export type GravityUnit = 'plato' | 'sg' | 'brix';

// Plato⇄SG conversion — exact algebraic inverses of each other, derived from
// the standard extract/density quadratic (Plato table "SL20/20"). Verified
// against "Stammwürzeermittlung nach Novotný linear..." (Weiß, O., V02,
// 2024), which cites Novotný, P. (2017), Zymurgy 40(4).
export function platoToSg(plato: number): number {
  return (668 - Math.sqrt(668 * 668 - 820 * (463 + plato))) / 410;
}

export function sgToPlato(sg: number): number {
  return 668 * sg - 205 * sg * sg - 463;
}

// Brix and °Plato are both sucrose-equivalent mass-percent scales; within
// brewing-relevant concentrations they differ by well under 0.05° and are
// treated as numerically identical here.
export function brixToPlato(brix: number): number {
  return brix;
}
export function platoToBrix(plato: number): number {
  return plato;
}

export function convertGravity(value: number, from: GravityUnit, to: GravityUnit): number {
  if (from === to) return value;
  const plato = from === 'plato' ? value : from === 'brix' ? brixToPlato(value) : sgToPlato(value);
  if (to === 'plato') return plato;
  if (to === 'brix') return platoToBrix(plato);
  return platoToSg(plato);
}
