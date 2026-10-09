// Efficiency chain after Troester, "A Closer Look at Efficiency" (NHC 2010,
// braukaiser.com/documents/Troester_NHC_2010_Efficiency.pdf) and his wiki
// article "Understanding Efficiency". The efficiencies relate extract (kg) to
// the laboratory extract of the grain as is (its potential); the
// Sudhausausbeute (Narziss) relates it to the grain mass instead:
//   Konversion × Läutereffizienz = Maischeeffizienz (extract in the kettle)
//   Maischeeffizienz × potential per kg grain = Sudhausausbeute
//   Maischeeffizienz × Würzeanteil = Brewhouse-Efficiency (extract in the fermenter)
// The brewery picks the one recipes enter (the basis), the others follow. Only
// malt and raw grain go through the chain; sugar and extract add all theirs.
// Pure, like recipeStats.ts.
import { DEFAULT_CONVERSION, type Brewery, type Brewhouse } from './brewhouse';
import { calcWater, fermenterShare, type Water } from './recipeWater';
import { DEFAULT_EFFICIENCY, type Recipe } from './recipes';

export type EfficiencyBasis = 'conversion' | 'mash' | 'yield' | 'fermenter';

export const DEFAULT_BASIS: EfficiencyBasis = 'mash';

export const BASIS_LABEL: Record<EfficiencyBasis, string> = {
  conversion: 'Konversion', mash: 'Maischeeffizienz', yield: 'Sudhausausbeute', fermenter: 'Brewhouse-Efficiency',
};

// Input of a recipe that sets none. The Sudhausausbeute is about 0.8 × the
// Maischeeffizienz (grain is ~80 % extract), the losses after the boil take a
// few points more. The Konversion comes from the brewhouse.
const DEFAULT_INPUT: Record<Exclude<EfficiencyBasis, 'conversion'>, number> = {
  mash: DEFAULT_EFFICIENCY, yield: 60, fermenter: 70,
};

export const basisOf = (b: Brewery | null | undefined): EfficiencyBasis => b?.efficiencyBasis ?? DEFAULT_BASIS;

export type InputSource = 'Rezept' | 'Sudhaus' | 'Vorgabe';

// The value the recipe enters for `basis`, and where it comes from.
export function efficiencyInput(recipe: Recipe, bh: Brewhouse | undefined, basis: EfficiencyBasis): { pct: number; from: InputSource } {
  if (basis === 'conversion') {
    if (recipe.conversionPct != null) return { pct: recipe.conversionPct, from: 'Rezept' };
    return bh ? { pct: bh.mashEfficiencyPct, from: 'Sudhaus' } : { pct: DEFAULT_CONVERSION, from: 'Vorgabe' };
  }
  return recipe.efficiencyPct != null
    ? { pct: recipe.efficiencyPct, from: 'Rezept' } : { pct: DEFAULT_INPUT[basis], from: 'Vorgabe' };
}

// ── Lautering ──────────────────────────────────────────────────────────────────

// Wort volume added per kg of extract dissolved (Troester, "Understanding Efficiency").
export const EXTRACT_L_PER_KG = 0.62;

export type LauterMethod = 'full' | 'batch' | 'fly';

export interface Lauter {
  pct: number;
  method: LauterMethod;
  batches: number;     // sparge additions modelled; fly: 2
  fixed: boolean;      // fly sparging with the brewhouse's fixed value
  retainedL: number;   // wort held back after every run-off
  runOffsL: number[];  // first wort, then one per addition
}

// Troester's batch sparge model, with no-sparge as the case without additions:
// each run-off V takes V / (V + R) of the extract still in the tun. R is the
// wort held back: grain absorption and the dead spaces before the boil, plus
// the volume of the dissolved extract (the water tab's absorption is the water
// lost; the wort held back carries extract as well). Sparge additions are equal.
// Fly sparging has no model: it counts as batch sparging with two additions
// unless the brewhouse fixes a value from its own brews.
export function lauterEfficiency(
  w: Pick<Water, 'sparge' | 'strikeL' | 'spargeL' | 'absorptionL' | 'wortLossL'>,
  dissolvedKg: number,
  opts: { method?: 'batch' | 'fly'; batches?: number; fixedPct?: number } = {},
): Lauter {
  const retainedL = w.absorptionL + w.wortLossL + EXTRACT_L_PER_KG * dissolvedKg;
  const method: LauterMethod = w.sparge ? opts.method ?? 'batch' : 'full';
  const batches = method === 'full' ? 0 : method === 'fly' ? 2 : Math.max(1, Math.round(opts.batches ?? 1));
  const runOffsL = [
    Math.max(w.strikeL - w.absorptionL - w.wortLossL, 0),
    ...Array<number>(batches).fill(Math.max(w.spargeL, 0) / batches),
  ];
  if (method === 'fly' && opts.fixedPct !== undefined) {
    return { pct: opts.fixedPct, method, batches, fixed: true, retainedL, runOffsL };
  }
  const left = runOffsL.reduce((rest, v) => (v + retainedL > 0 ? (rest * retainedL) / (v + retainedL) : rest), 1);
  return { pct: (1 - left) * 100, method, batches, fixed: false, retainedL, runOffsL };
}

export function lauterText(l: Lauter): string {
  if (l.method === 'full') return 'Vollguss';
  if (l.method === 'fly') return l.fixed ? 'Fly Sparge, Festwert' : 'Fly Sparge, wie 2 Gaben';
  return `Batch Sparge, ${l.batches} ${l.batches === 1 ? 'Gabe' : 'Gaben'}`;
}

// ── Chain ──────────────────────────────────────────────────────────────────────

// The linked grist as recipeStats.wortExtract sees it.
export interface Grist {
  grainKg: number;         // malt and raw grain
  grainExtractKg: number;  // their potential
  otherExtractKg: number;  // sugar, extract: no losses
}

// A value is unset where it cannot follow: Konversion, Läutereffizienz and
// Brewhouse-Efficiency need a brewhouse, the Sudhausausbeute needs grain.
export interface Efficiency {
  basis: EfficiencyBasis;
  inputPct: number;
  inputFrom: InputSource;
  conversionPct?: number;
  lauter?: Lauter;
  mashPct?: number;
  yieldPct?: number;
  fermenterPct?: number;
  notes: string[];
}

const pct = (n: number | undefined) => (n === undefined ? undefined : n * 100);

export function resolveEfficiency(
  recipe: Recipe, grist: Grist, bh: Brewhouse | undefined, brewery: Brewery | null | undefined,
): Efficiency {
  const basis = basisOf(brewery);
  const notes: string[] = [];
  const { pct: inputPct, from: inputFrom } = efficiencyInput(recipe, bh, basis);
  const input = inputPct / 100;
  const perKg = grist.grainKg > 0 ? grist.grainExtractKg / grist.grainKg : undefined;
  const share = bh ? fermenterShare(recipe, bh) : 1;
  if (basis === 'fermenter' && !bh) notes.push('Ohne Sudhaus gilt die Brewhouse-Efficiency auch in der Pfanne.');

  // Maischeeffizienz; with the Konversion as input it needs the lauter efficiency.
  let mash = basis === 'mash' ? input
    : basis === 'yield' ? (perKg ? input / perKg : undefined)
    : basis === 'fermenter' ? (share > 0 ? input / share : undefined)
    : undefined;

  // The lauter efficiency depends on the extract dissolved in the mash, and the
  // wort volumes (through a dilution led by gravity) on the extract: iterate
  // until it settles, a few rounds.
  let lauter: Lauter | undefined;
  const w = recipe.water;
  for (let i = 0, l = 0.8; bh && i < 20; i++) {
    const eta = basis === 'conversion' ? input * l : mash;
    const water = calcWater(recipe, bh, eta === undefined ? undefined : grist.otherExtractKg + eta * grist.grainExtractKg).water;
    if (!water) break;
    const conversion = basis === 'conversion' ? input : (eta ?? 0) / l;
    lauter = lauterEfficiency(water, conversion * grist.grainExtractKg,
      { method: w?.spargeMethod, batches: w?.spargeBatches, fixedPct: bh.lauterEfficiencyPct });
    const next = lauter.pct / 100;
    if (Math.abs(next - l) < 1e-9) break;
    l = next;
  }

  let conversion: number | undefined;
  if (basis === 'conversion') {
    conversion = input;
    mash = lauter ? input * (lauter.pct / 100) : undefined;
    if (!lauter) notes.push('Mit der Grundlage Konversion braucht die Stammwürze ein Sudhaus (Läutereffizienz).');
  } else if (lauter && mash !== undefined && lauter.pct > 0) {
    conversion = mash / (lauter.pct / 100);
    if (conversion > 1) {
      notes.push(`Die Konversion läge über 100 %: ${BASIS_LABEL[basis]} ${inputPct} % ist für dieses Läutern zu hoch.`);
    }
  }
  if (lauter?.method === 'fly' && !lauter.fixed) {
    notes.push('Fly Sparge ist wie Batch Sparge mit 2 Gaben gerechnet (Annahme). Das Sudhaus kann einen Festwert setzen.');
  }

  return {
    basis, inputPct, inputFrom, notes, lauter,
    conversionPct: pct(conversion),
    mashPct: pct(mash),
    yieldPct: basis === 'yield' ? inputPct : pct(mash !== undefined && perKg ? mash * perKg : undefined),
    fermenterPct: basis === 'fermenter' ? inputPct : pct(bh && mash !== undefined ? mash * share : undefined),
  };
}
