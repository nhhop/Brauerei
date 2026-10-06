import { describe, expect, it } from 'vitest';
import { DEFAULT_GRAIN_ABSORPTION, TEMPLATES, type Brewhouse } from './brewhouse';
import { calcWater } from './recipeWater';
import { newRecipe, type Ingredient, type Recipe } from './recipes';

const template = (key: string) => TEMPLATES.find((t) => t.key === key)!.build();

// 20 l knock-out, 60 min boil, 5 kg malt in the mash (plus sugar in the kettle,
// which is no grain).
function recipeFor(bh: Brewhouse, p: Partial<Recipe> = {}): Recipe {
  const malt: Ingredient = { id: 'm', kind: 'fermentable', name: 'Pilsner', amount: 5, timing: 'mash' };
  const sugar: Ingredient = { id: 's', kind: 'fermentable', name: 'Zucker', amount: 1, timing: 'boil' };
  return { ...newRecipe(), volumeL: 20, brewhouseId: bh.id, ingredients: [malt, sugar], ...p };
}

const round = (n: number | undefined) => (n === undefined ? n : Math.round(n * 100) / 100);

function calc(bh: Brewhouse, p: Partial<Recipe> = {}) {
  const { water, notes } = calcWater(recipeFor(bh, p), bh);
  const w = water!;
  return {
    notes,
    w,
    figures: {
      evaporation: round(w.evaporationL), preBoil: round(w.preBoilL), wortLoss: round(w.wortLossL),
      absorption: round(w.absorptionL), total: round(w.totalL), sparge: w.sparge, ratio: round(w.mashRatioLPerKg),
      strike: round(w.strikeL), spargeL: round(w.spargeL), strikeFill: round(w.strikeFillL), spargeFill: round(w.spargeFillL),
    },
  };
}

describe('calcWater per template', () => {
  it('one pot: no wort losses, full volume forced', () => {
    const { figures, w, notes } = calc(template('pot'));
    expect(figures).toEqual({
      evaporation: 3, preBoil: 23, wortLoss: 0, absorption: 3, total: 26, sparge: false, ratio: 5.2,
      strike: 26, spargeL: 0, strikeFill: 26, spargeFill: 0,
    });
    expect(w.canSparge).toBe(false);
    expect(notes).toEqual([]);
  });

  it('kettle + lauter tun: lautering by gravity, only the dead space counts', () => {
    const { figures, w, notes } = calc(template('kettle-lauter'));
    expect(figures).toEqual({
      evaporation: 3, preBoil: 23, wortLoss: 1, absorption: 4.8, total: 28.8, sparge: true, ratio: 3.5,
      strike: 17.5, spargeL: 11.3, strikeFill: 17.5, spargeFill: 11.8,
    });
    expect(w.wortLosses).toEqual([{ label: 'Totraum Läuterbottich', l: 1 }]);
    expect(w.spargeFill).toEqual([{ label: 'Totraum Einkocher', l: 0.5 }]);
    expect(notes).toEqual([]);
  });

  it('3-vessel HERMS: dead space plus line; the HLT dead space counts once', () => {
    const { figures, w, notes } = calc(template('herms3'));
    expect(figures).toEqual({
      evaporation: 4, preBoil: 24, wortLoss: 2, absorption: 4.8, total: 30.8, sparge: true, ratio: 3.5,
      strike: 17.5, spargeL: 13.3, strikeFill: 20, spargeFill: 13.8,
    });
    expect(w.wortLosses).toEqual([
      { label: 'Totraum Maisch-/Läuterbottich', l: 1.5 }, { label: 'Leitung Läutern', l: 0.5 },
    ]);
    expect(w.strikeFill).toEqual([{ label: 'Totraum HLT', l: 2 }, { label: 'Leitung Hauptguss', l: 0.5 }]);
    expect(w.spargeFill).toEqual([{ label: 'Leitung Nachguss', l: 0.5 }]);
    expect(notes).toEqual([]);
  });
});

describe('calcWater', () => {
  it('without a brewhouse gives only the note', () => {
    expect(calcWater({ ...newRecipe() }, undefined)).toEqual({ notes: ['Kein Sudhaus gewählt.'] });
    expect(calcWater({ ...newRecipe(), brewhouseId: 'weg' }, undefined))
      .toEqual({ notes: ['Das Sudhaus „weg“ gibt es nicht mehr.'] });
  });

  it('takes the recipe overrides before the brewhouse values', () => {
    const bh = template('herms3');
    const base = calc(bh).w;
    expect([base.evaporationFrom, base.absorptionFrom]).toEqual(['Sudhaus', 'Sudhaus']);
    const { w } = calc(bh, { water: { evaporationLPerH: 2, grainAbsorptionLPerKg: 1 } });
    expect([w.evaporationL, w.evaporationFrom, w.absorptionL, w.absorptionFrom]).toEqual([2, 'Rezept', 5, 'Rezept']);
  });

  it('falls back to the default grain absorption without a value at the lauter vessel', () => {
    const bh = template('herms3');
    const { w } = calc({ ...bh, vessels: bh.vessels.map((v) => ({ ...v, grainAbsorptionLPerKg: undefined })) });
    expect(w.absorptionLPerKg).toBe(DEFAULT_GRAIN_ABSORPTION);
  });

  it('leaves out a line loss that comes back', () => {
    const bh = template('herms3');
    const { w } = calc({ ...bh, transfers: bh.transfers.map((t) => ({ ...t, recovered: true })) });
    expect(w.wortLosses).toEqual([{ label: 'Totraum Maisch-/Läuterbottich', l: 1.5 }]);
    expect(w.strikeFill).toEqual([{ label: 'Totraum HLT', l: 2 }]);
  });

  it('puts all water into the strike without sparge', () => {
    const { figures } = calc(template('herms3'), { water: { sparge: false, mashRatioLPerKg: 3 } });
    expect([figures.strike, figures.spargeL, figures.ratio, figures.strikeFill, figures.spargeFill])
      .toEqual([30.8, 0, 6.16, 33.3, 0]);
  });

  it('notes a negative sparge when the ratio is too high', () => {
    const { figures, notes } = calc(template('herms3'), { water: { mashRatioLPerKg: 7 } });
    expect(figures.spargeL).toBe(-4.2);
    expect(notes).toEqual(['Der Hauptguss ist größer als das Gesamtwasser: Das Hauptguss-Verhältnis ist zu hoch.']);
  });

  it('notes missing evaporation, missing grain and vessels that are too small', () => {
    const bh = template('pot');
    const noEvap = { ...bh, vessels: bh.vessels.map((v) => ({ ...v, evaporationLPerH: undefined })) };
    expect(calc(noEvap, { ingredients: [] }).notes).toEqual([
      'Der Kochbehälter hat keine Verdampfung, gerechnet wird mit 0 l/h.',
      'Keine Schüttung in der Maische.',
    ]);
    // 60 l + 3 l evaporation in a 50 l pot; mash 63 l + 6 kg · (0.6 + 0.75) l/kg.
    const malt: Ingredient = { id: 'm', kind: 'fermentable', name: 'Pilsner', amount: 6, timing: 'mash' };
    expect(calc(bh, { volumeL: 60, ingredients: [malt] }).notes).toEqual([
      'Pfannevoll (63,0 l) passt nicht in Topf (50,0 l).',
      'Die Maische (71,1 l) passt nicht in Topf (50,0 l).',
    ]);
  });
});
