// Water volumes of a recipe (tab "Wasser"), counted back from the knock-out
// volume: the hot wort in the kettle at the end of the boil. What is lost after
// the boil belongs to the bottling volume of the fermentation. Pure, like
// recipeStats.ts.
import { grainAbsorptionOf, stepShort, type Brewhouse, type StepKey } from './brewhouse';
import { DEFAULT_MASH_RATIO, type Recipe } from './recipes';

export type Source = 'Rezept' | 'Sudhaus';

// One loss, named for "Berechnung".
export interface Loss { label: string; l: number }

export interface Water {
  knockOutL: number;          // Ausschlag, the recipe's volume
  evaporationLPerH: number;
  evaporationFrom: Source;
  evaporationL: number;
  preBoilL: number;           // Pfannevoll
  wortLosses: Loss[];         // dead space and lines before the boil
  wortLossL: number;
  grainKg: number;
  absorptionLPerKg: number;
  absorptionFrom: Source;
  absorptionL: number;
  totalL: number;             // water that reaches mash and lauter tun
  canSparge: boolean;         // the brewhouse has the sparge step
  sparge: boolean;            // in effect
  mashRatioLPerKg?: number;   // input with sparge, result without; unset without grain
  strikeL: number;
  spargeL: number;
  strikeFill: Loss[];         // what the strike water needs on top, to fill in
  strikeFillL: number;        // strike water plus that
  spargeFill: Loss[];
  spargeFillL: number;
  mashVolumeL: number;
}

// TODO(verify): volume the grain adds to the mash.
export const GRAIN_DISPLACEMENT_L_PER_KG = 0.67;

export const fmtL = (n: number) => `${n.toFixed(1).replace('.', ',')} l`;

const sum = (losses: Loss[]) => losses.reduce((s, x) => s + x.l, 0);

// Losses of the transfers in `steps`. A pump's line loss counts unless it comes
// back. The source vessel's dead space counts when it drains (pump or gravity;
// ladling or lifting the bag leaves nothing behind), once per vessel in `seen`.
function transferLosses(bh: Brewhouse, steps: StepKey[], seen: Set<string>): Loss[] {
  const out: Loss[] = [];
  for (const t of bh.transfers.filter((x) => steps.includes(x.step))) {
    const from = bh.vessels.find((v) => v.id === t.from);
    if (t.drive !== 'manual' && from && from.deadSpaceL > 0 && !seen.has(from.id)) {
      seen.add(from.id);
      out.push({ label: `Totraum ${from.name}`, l: from.deadSpaceL });
    }
    if (t.drive === 'pump' && !t.recovered && t.lossL > 0) {
      out.push({ label: `Leitung ${stepShort(t.step)}`, l: t.lossL });
    }
  }
  return out;
}

// `bh` is the recipe's brewhouse; without one there is only the note.
export function calcWater(recipe: Recipe, bh: Brewhouse | undefined): { water?: Water; notes: string[] } {
  if (!recipe.brewhouseId) return { notes: ['Kein Sudhaus gewählt.'] };
  if (!bh) return { notes: [`Das Sudhaus „${recipe.brewhouseId}“ gibt es nicht mehr.`] };
  const notes: string[] = [];
  const w = recipe.water ?? {};
  const vesselOf = (step: StepKey) => bh.vessels.find((v) => v.id === bh.steps[step]?.vesselId);

  const boilVessel = vesselOf('boil');
  const evaporationFrom: Source = w.evaporationLPerH != null ? 'Rezept' : 'Sudhaus';
  const evaporationLPerH = w.evaporationLPerH ?? boilVessel?.evaporationLPerH ?? 0;
  if (w.evaporationLPerH == null && boilVessel?.evaporationLPerH == null) {
    notes.push('Der Kochbehälter hat keine Verdampfung, gerechnet wird mit 0 l/h.');
  }
  const evaporationL = evaporationLPerH * recipe.boil.durationMin / 60;
  const preBoilL = recipe.volumeL + evaporationL;

  const wortLosses = transferLosses(bh, ['mash', 'lauter'], new Set());
  const wortLossL = sum(wortLosses);

  const grainKg = recipe.ingredients
    .filter((i) => i.kind === 'fermentable' && i.timing === 'mash')
    .reduce((s, i) => s + i.amount, 0);
  if (grainKg <= 0) notes.push('Keine Schüttung in der Maische.');
  const absorptionFrom: Source = w.grainAbsorptionLPerKg != null ? 'Rezept' : 'Sudhaus';
  const absorptionLPerKg = w.grainAbsorptionLPerKg ?? grainAbsorptionOf(bh);
  const absorptionL = grainKg * absorptionLPerKg;

  const totalL = preBoilL + wortLossL + absorptionL;

  const canSparge = !!bh.steps.sparge;
  const sparge = canSparge && (w.sparge ?? true);
  let mashRatioLPerKg: number | undefined;
  let strikeL: number;
  if (sparge) {
    mashRatioLPerKg = w.mashRatioLPerKg ?? DEFAULT_MASH_RATIO;
    strikeL = mashRatioLPerKg * grainKg;
  } else {
    strikeL = totalL;
    mashRatioLPerKg = grainKg > 0 ? strikeL / grainKg : undefined;
  }
  const spargeL = sparge ? totalL - strikeL : 0;
  if (spargeL < 0) notes.push('Der Hauptguss ist größer als das Gesamtwasser: Das Hauptguss-Verhältnis ist zu hoch.');

  // The source vessel's dead space counts at the first water drawn from it.
  const seen = new Set<string>();
  const strikeFill = transferLosses(bh, ['strike'], seen);
  const spargeFill = sparge ? transferLosses(bh, ['sparge'], seen) : [];

  if (boilVessel && preBoilL > boilVessel.volumeL) {
    notes.push(`Pfannevoll (${fmtL(preBoilL)}) passt nicht in ${boilVessel.name} (${fmtL(boilVessel.volumeL)}).`);
  }
  const mashVessel = vesselOf('mash');
  const mashVolumeL = strikeL + grainKg * GRAIN_DISPLACEMENT_L_PER_KG;
  if (mashVessel && mashVolumeL > mashVessel.volumeL) {
    notes.push(`Die Maische (${fmtL(mashVolumeL)}) passt nicht in ${mashVessel.name} (${fmtL(mashVessel.volumeL)}).`);
  }

  return {
    water: {
      knockOutL: recipe.volumeL, evaporationLPerH, evaporationFrom, evaporationL, preBoilL,
      wortLosses, wortLossL, grainKg, absorptionLPerKg, absorptionFrom, absorptionL, totalL,
      canSparge, sparge, mashRatioLPerKg, strikeL, spargeL,
      strikeFill, strikeFillL: strikeL + sum(strikeFill), spargeFill, spargeFillL: spargeL + sum(spargeFill),
      mashVolumeL,
    },
    notes,
  };
}
