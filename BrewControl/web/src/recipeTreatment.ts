// Water treatment of a recipe (card "Aufbereitung" in the tab "Wasser"): source
// water per water, salts and acids per column, and what comes out. Builds on
// the volumes of recipeWater.ts and the chemistry of waterChem.ts. Pure.
import type { Brewery } from './brewhouse';
import type { Auxiliary, CatalogIngredient } from './ingredientCatalog';
import type { Water } from './recipeWater';
import { SCOPE_TIMINGS, type Ingredient, type Recipe, type Timing, type WaterKey } from './recipes';
import {
  VE_WATER, WATER_AGENTS, acidForPh, agentMmol, applyAgents, blend, concentrate, figuresOf, isAcid, stateOf,
  type Dose, type WaterAgent, type WaterFigures, type WaterProfile, type WaterState,
} from './waterChem';

export type ColumnKey = 'strike' | 'mash' | 'sparge' | 'preBoil' | 'knockOut' | 'dilution' | 'total';
export const COLUMN_LABEL: Record<ColumnKey, string> = {
  strike: 'Hauptguss', mash: 'Maische', sparge: 'Nachguss', preBoil: 'Vor dem Kochen', knockOut: 'Ausschlag',
  dilution: 'Verschnitt', total: 'Gesamt',
};

// The column a moment lands in; "Brauwasser" is shared out over strike and sparge.
const COLUMN_OF: Partial<Record<Timing, ColumnKey>> = {
  mainWater: 'strike', mash: 'mash', mashPh: 'mash', sparge: 'sparge', preBoil: 'preBoil', knockOut: 'knockOut',
  dilution: 'dilution',
};
export const TIMING_OF: Record<WaterKey, Timing> = { strike: 'mainWater', sparge: 'sparge', dilution: 'dilution' };

export interface Agent { agent: WaterAgent; strengthPct: number; unit: 'g' | 'ml'; entry: Auxiliary }

// The water agent behind a row, from its catalog entry.
export function agentOf(i: Ingredient, catalog: CatalogIngredient[] | null): Agent | undefined {
  const entry = catalog?.find((c) => c.id === i.ingredientId);
  if (entry?.kind !== 'auxiliary' || !entry.waterAgent) return undefined;
  const agent = WATER_AGENTS[entry.waterAgent];
  return {
    agent, entry, unit: agent.form === 'solid' ? 'g' : 'ml',
    strengthPct: agent.form === 'solid' ? 100 : (i.strengthPct ?? entry.acidStrengthPct ?? 100),
  };
}

// Rows the card shows: auxiliaries at a water moment, unless they point to a
// catalog entry that is no water agent (an enzyme in the mash).
export function isTreatmentRow(i: Ingredient, catalog: CatalogIngredient[] | null): boolean {
  if (i.kind !== 'auxiliary' || !SCOPE_TIMINGS.water.includes(i.timing)) return false;
  return !i.ingredientId || !catalog || agentOf(i, catalog) !== undefined;
}

export interface ColumnDose {
  ingredient: Ingredient;
  amount: number;       // what goes into this column
  share: boolean;       // part of a "Brauwasser" addition
  agent?: Agent;
}

export interface Source { water: WaterProfile; blendWith: WaterProfile; blendPct: number }

export interface Column {
  key: ColumnKey;
  wort: boolean;        // wort or beer: alkalinity and pH no longer follow the water model
  volumeL: number;      // basis of the concentrations
  source?: Source;      // water columns; the mash starts from the strike water
  doses: ColumnDose[];
  start: WaterState;    // before the doses
  state: WaterState;
  before: WaterFigures;
  after: WaterFigures;
}

export function waterById(brewery: Brewery | null, id: string | undefined): WaterProfile | undefined {
  return id === VE_WATER.id ? VE_WATER : brewery?.waters?.find((w) => w.id === id);
}

const dosesOf = (doses: ColumnDose[]): Dose[] => doses.flatMap((d) =>
  d.agent ? [{ agent: d.agent.agent, mmol: agentMmol(d.agent.agent, d.amount, d.agent.strengthPct) }] : []);

// Unset source water: the brewery's default, else its first profile, else VE water.
export function calcTreatment(recipe: Recipe, w: Water, brewery: Brewery | null, catalog: CatalogIngredient[] | null):
  { columns: Column[]; notes: string[] } {
  const notes: string[] = [];
  const rows = recipe.ingredients.filter((i) => isTreatmentRow(i, catalog));
  const unlinked = rows.filter((i) => !agentOf(i, catalog)).length;
  if (unlinked > 0) notes.push(`${unlinked} von ${rows.length} Gaben ohne Wassermittel aus dem Katalog, nicht eingerechnet.`);

  const defaultId = brewery?.defaultWaterId;
  if (!brewery?.waters?.length) notes.push('Noch kein Wasserprofil angelegt (Einstellungen › Brauanlage), gerechnet wird mit VE-Wasser.');
  const sourceOf = (key: WaterKey): Source => {
    const s = recipe.water?.sources?.[key];
    const id = s?.waterId ?? defaultId;
    let water = waterById(brewery, id);
    if (!water) {
      if (id) notes.push(`Das Wasserprofil „${id}“ gibt es nicht mehr, gerechnet wird mit VE-Wasser.`);
      water = (id ? undefined : brewery?.waters?.[0]) ?? VE_WATER;
    }
    return { water, blendWith: waterById(brewery, s?.blendId) ?? VE_WATER, blendPct: s?.blendPct ?? 0 };
  };

  // "Brauwasser" goes by fill volume, so both waters get the same concentration.
  const fillTotal = w.strikeFillL + (w.sparge ? w.spargeFillL : 0);
  const amountIn = (i: Ingredient, key: ColumnKey): ColumnDose | undefined => {
    if (i.timing === 'water' && (key === 'strike' || key === 'sparge')) {
      const vol = key === 'strike' ? w.strikeFillL : w.spargeFillL;
      if (key === 'sparge' && !w.sparge) return undefined;
      return { ingredient: i, amount: fillTotal > 0 ? (i.amount * vol) / fillTotal : 0, share: true, agent: agentOf(i, catalog) };
    }
    return COLUMN_OF[i.timing] === key ? { ingredient: i, amount: i.amount, share: false, agent: agentOf(i, catalog) } : undefined;
  };

  const column = (key: ColumnKey, volumeL: number, start: WaterState, source?: Source, wort = false): Column => {
    const doses = rows.flatMap((i) => amountIn(i, key) ?? []);
    const state = applyAgents(start, volumeL, dosesOf(doses));
    return { key, wort, volumeL, source, doses, start, state, before: figuresOf(start), after: figuresOf(state) };
  };
  const water = (key: WaterKey, volumeL: number) => {
    const s = sourceOf(key);
    return column(key, volumeL, blend(stateOf(s.water), stateOf(s.blendWith), s.blendPct), s);
  };

  const strike = water('strike', w.strikeFillL);
  const mash = column('mash', w.strikeL, strike.state);
  const sparge = w.sparge ? water('sparge', w.spargeFillL) : undefined;
  const d = w.dilution;
  const dilution = d.volumeL > 0 ? water('dilution', d.volumeL) : undefined;

  // The wort carries what mash and sparge water brought, mixed by volume (grain
  // and losses hold back their share alike); the boil concentrates it. A
  // dilution in the kettle is in the knock-out, one in the fermenter only in
  // the total. Malt ions and what precipitates are not counted.
  const spargeShare = sparge && w.spargeL > 0 ? (100 * w.spargeL) / (w.strikeL + w.spargeL) : 0;
  const preBoil = column('preBoil', w.preBoilL, sparge ? blend(mash.state, sparge.state, spargeShare) : mash.state, undefined, true);
  let boiled = concentrate(preBoil.state, d.kettleL > 0 ? w.preBoilL / d.kettleL : 1);
  if (dilution && d.at === 'kettle') boiled = blend(boiled, dilution.state, (100 * d.volumeL) / w.knockOutL);
  const knockOut = column('knockOut', w.knockOutL, boiled, undefined, true);
  const final = dilution && d.at === 'fermenter' ? blend(knockOut.state, dilution.state, (100 * d.volumeL) / d.finalL) : knockOut.state;
  const total = column('total', d.finalL, final, undefined, true);

  // The wort columns show only when something goes in there.
  const columns = [strike, mash, sparge, preBoil.doses.length > 0 && preBoil, knockOut.doses.length > 0 && knockOut, dilution, total]
    .filter((c): c is Column => !!c);
  for (const i of rows) {
    const key = COLUMN_OF[i.timing];
    if (key && !columns.some((c) => c.key === key)) {
      notes.push(`„${i.name || 'Ohne Namen'}“ (${COLUMN_LABEL[key]}) zählt nicht, ${key === 'sparge' ? 'das Rezept hat keinen Nachguss' : 'es ist kein Verschnitt geplant'}.`);
    }
  }
  return { columns, notes: [...new Set(notes)] };
}

// Acid helper: the amount of the column's first acid that reaches `targetPh`,
// or of lactic acid when the column has none yet. Undefined without a known pH.
export function suggestAcid(col: Column, targetPh: number, catalog: CatalogIngredient[] | null):
  { ingredient?: Ingredient; entry?: Auxiliary; amount: number } | undefined {
  const own = col.doses.find((d) => !d.share && d.agent && isAcid(d.agent.agent));
  const agent = own?.agent ?? lacticOf(catalog);
  if (!agent) return undefined;
  const others = col.doses.filter((d) => d !== own);
  const start = applyAgents(col.start, col.volumeL, dosesOf(others));
  const amount = acidForPh(start, col.volumeL, agent.agent, agent.strengthPct, targetPh);
  return amount === undefined ? undefined : { ingredient: own?.ingredient, entry: agent.entry, amount };
}

function lacticOf(catalog: CatalogIngredient[] | null): Agent | undefined {
  const entry = catalog?.find((c) => c.kind === 'auxiliary' && c.waterAgent === 'lactic');
  return entry ? agentOf({ id: '', kind: 'auxiliary', name: '', amount: 0, timing: 'water', ingredientId: entry.id }, catalog) : undefined;
}
