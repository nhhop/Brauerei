// Water volumes of a recipe (tab "Wasser"), counted back from the knock-out
// volume: the hot wort in the kettle at the end of the boil. What is lost after
// the boil belongs to the bottling volume of the fermentation. Pure, like
// recipeStats.ts.
import { platoFromExtract, volumeFromExtract } from './brewMath';
import { grainAbsorptionOf, stepShort, type Brewhouse, type StepKey } from './brewhouse';
import { platoToSg } from './gravityUnits';
import { DEFAULT_MASH_RATIO, type Dilution, type Recipe } from './recipes';

export type Source = 'Rezept' | 'Sudhaus';

// One loss, named for "Berechnung".
export interface Loss { label: string; l: number }

export interface Water {
  knockOutL: number;          // Ausschlag, the recipe's volume
  dilution: DilutionResult;
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
  fitDilutionL?: number;      // dilution in the kettle that makes the pre-boil volume fit
}

// Volume the grain adds to the mash (Braumagazin), for the mash volume only.
export const GRAIN_DISPLACEMENT_L_PER_KG = 0.75;

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

// Planned dilution (high gravity), resolved: the volume follows from the
// gravity or the other way round, whichever `lead` names.
export interface DilutionResult {
  at: Dilution['at'];
  volumeL: number;        // V_d, 0 without dilution
  kettleL: number;        // knock-out before a dilution in the kettle
  kettlePlato?: number;   // gravity at the end of the boil
  restL?: number;         // fermenter: wort that arrives before the dilution
  finalL: number;         // after the dilution: knock-out (kettle) or rest + V_d (fermenter)
  finalPlato?: number;    // original gravity after the dilution
  factor: number;         // share of wort in the final volume, (final − V_d) / final
  notes: string[];
}

// Wort that reaches the fermenter: knock-out less chill shrinkage, the kettle's
// dead space at the outlet and the transfers from the whirlpool on. Hop
// absorption and trub come with the fermentation tab.
function restVolumeL(recipe: Recipe, bh: Brewhouse): number {
  const losses = transferLosses(bh, ['whirlpool', 'hopback', 'chill'], new Set());
  return recipe.volumeL * (1 - bh.coolingShrinkPct / 100) - sum(losses);
}

// `extractKg` is the extract of the grist (recipeStats.wortExtract); without it
// no gravity, and a dilution led by gravity counts as 0 l.
export function resolveDilution(recipe: Recipe, extractKg: number | undefined, bh: Brewhouse | undefined): DilutionResult {
  const d = recipe.water?.dilution;
  const knockOutL = recipe.volumeL;
  const notes: string[] = [];
  const knockOutPlato = extractKg !== undefined && knockOutL > 0 ? platoFromExtract(extractKg, knockOutL) : undefined;
  const byGravity = d?.lead === 'gravity' && d.plato !== undefined && d.plato > 0;
  if (byGravity && knockOutPlato === undefined) notes.push('Die Verschnittmenge braucht die Stammwürze (Vergärbares verknüpfen).');
  const at = d?.at ?? 'kettle';

  if (at === 'kettle') {
    let volumeL = !byGravity ? (d?.volumeL ?? 0) : extractKg === undefined ? 0 : knockOutL - volumeFromExtract(extractKg, d.plato!);
    if (volumeL < 0 || volumeL >= knockOutL) {
      notes.push(volumeL < 0
        ? 'Die Pfannen-Stammwürze liegt unter der Stammwürze, gerechnet wird ohne Verschnitt.'
        : 'Der Verschnitt ist so groß wie die Ausschlagmenge, gerechnet wird ohne Verschnitt.');
      volumeL = 0;
    }
    const kettleL = knockOutL - volumeL;
    return {
      at, volumeL, kettleL, finalL: knockOutL, finalPlato: knockOutPlato, notes,
      kettlePlato: extractKg !== undefined && kettleL > 0 ? platoFromExtract(extractKg, kettleL) : undefined,
      factor: knockOutL > 0 ? kettleL / knockOutL : 1,
    };
  }

  if (!bh) notes.push('Ohne Sudhaus kommt die ganze Ausschlagmenge in den Gärbehälter.');
  const restL = Math.max(bh ? restVolumeL(recipe, bh) : knockOutL, 0);
  // Mass balance: the rest has restL · SG kg of wort, the water 1 kg/l.
  const wortKg = knockOutPlato === undefined ? undefined : restL * platoToSg(knockOutPlato);
  let volumeL = !byGravity ? (d?.volumeL ?? 0) : wortKg === undefined ? 0 : wortKg * (knockOutPlato! / d.plato! - 1);
  if (volumeL < 0) {
    notes.push('Die Anstell-Stammwürze liegt über der Stammwürze, gerechnet wird ohne Verschnitt.');
    volumeL = 0;
  }
  const finalL = restL + volumeL;
  return {
    at, volumeL, kettleL: knockOutL, kettlePlato: knockOutPlato, restL, finalL, notes,
    finalPlato: wortKg === undefined ? undefined : (knockOutPlato! * wortKg) / (wortKg + volumeL),
    factor: finalL > 0 ? restL / finalL : 1,
  };
}

// `bh` is the recipe's brewhouse; without one there is only the note.
// `extractKg` (recipeStats.wortExtract) only matters for a dilution led by gravity.
export function calcWater(recipe: Recipe, bh: Brewhouse | undefined, extractKg?: number): { water?: Water; notes: string[] } {
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
  const dilution = resolveDilution(recipe, extractKg, bh);
  notes.push(...dilution.notes);
  const preBoilL = dilution.kettleL + evaporationL;

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

  let fitDilutionL: number | undefined;
  if (boilVessel && preBoilL > boilVessel.volumeL) {
    notes.push(`Pfannevoll (${fmtL(preBoilL)}) passt nicht in ${boilVessel.name} (${fmtL(boilVessel.volumeL)}).`);
    const needed = (dilution.at === 'kettle' ? dilution.volumeL : 0) + preBoilL - boilVessel.volumeL;
    if (needed < recipe.volumeL) fitDilutionL = needed;
  }
  const mashVessel = vesselOf('mash');
  const mashVolumeL = strikeL + grainKg * GRAIN_DISPLACEMENT_L_PER_KG;
  if (mashVessel && mashVolumeL > mashVessel.volumeL) {
    notes.push(`Die Maische (${fmtL(mashVolumeL)}) passt nicht in ${mashVessel.name} (${fmtL(mashVessel.volumeL)}).`);
  }

  return {
    water: {
      knockOutL: recipe.volumeL, dilution, evaporationLPerH, evaporationFrom, evaporationL, preBoilL,
      wortLosses, wortLossL, grainKg, absorptionLPerKg, absorptionFrom, absorptionL, totalL,
      canSparge, sparge, mashRatioLPerKg, strikeL, spargeL,
      strikeFill, strikeFillL: strikeL + sum(strikeFill), spargeFill, spargeFillL: spargeL + sum(spargeFill),
      mashVolumeL, fitDilutionL,
    },
    notes,
  };
}
