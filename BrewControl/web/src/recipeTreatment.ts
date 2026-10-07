// Water treatment of a recipe (card "Aufbereitung" in the tab "Wasser"): source
// water per water, salts and acids per column, what comes out and the pH of mash
// and wort. Builds on the volumes of recipeWater.ts, the chemistry of waterChem.ts
// and the pH models of mashPh.ts. Pure.
import type { Brewery } from './brewhouse';
import type { Auxiliary, CatalogIngredient } from './ingredientCatalog';
import {
  BOIL_PH_DROP, DEFAULT_PH_MODEL, MALT_BUFFER, distilledWaterPh, gristOf, mashPh, raRangeForColor,
  type GristPart, type PhModel,
} from './mashPh';
import { beerEbc, wortExtract } from './recipeStats';
import type { Water } from './recipeWater';
import { SCOPE_TIMINGS, type Ingredient, type PhKey, type Recipe, type Timing, type WaterKey } from './recipes';
import {
  VE_WATER, WATER_AGENTS, agentMmol, amountForPh, applyAgents, blend, concentrate, figuresOf, isAcid, stateOf, waterPh,
  type Dose, type WaterAgent, type WaterAgentId, type WaterFigures, type WaterProfile, type WaterState,
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
// The moment the helper gives its acid or base; in the mash after the pH measurement.
export const TIMING_OF: Record<PhKey, Timing> = {
  strike: 'mainWater', sparge: 'sparge', dilution: 'dilution', mash: 'mashPh', preBoil: 'preBoil', knockOut: 'knockOut',
};

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

// What the pH model needs to judge a column's state: the mash its grist, the
// wort its pH before the column's doses and the malt's buffer.
export type PhBasis =
  | { kind: 'mash'; diPh: number; ratio: number }
  | { kind: 'wort'; startPh: number; bufferMeq: number };

export interface Column {
  key: ColumnKey;
  wort: boolean;        // wort or beer: alkalinity and pH no longer follow the water model
  volumeL: number;      // basis of the concentrations
  source?: Source;      // water columns; the mash starts from the strike water
  doses: ColumnDose[];
  start: WaterState;    // before the doses
  mid?: WaterState;     // mash: after "Maische", before "Maische nach pH-Messung"
  state: WaterState;
  before: WaterFigures;
  after: WaterFigures;
  basis?: PhBasis;      // mash and wort under the model troester
  // The model's pH; `before` is the mash before "Maische nach pH-Messung", the
  // wort before its doses.
  ph?: { before: number; after: number };
  raTarget?: [number, number];  // mash under the model kolbach: Palmer's range for the beer colour, mEq/l
}

// The grist as the model troester sees it.
export interface Grist { parts: GristPart[]; diPh: number; ratio: number; bufferMeq: number }

export function waterById(brewery: Brewery | null, id: string | undefined): WaterProfile | undefined {
  return id === VE_WATER.id ? VE_WATER : brewery?.waters?.find((w) => w.id === id);
}

const dosesOf = (doses: ColumnDose[]): Dose[] => doses.flatMap((d) =>
  d.agent ? [{ agent: d.agent.agent, mmol: agentMmol(d.agent.agent, d.amount, d.agent.strengthPct) }] : []);

// pH of `state` in the column: a water by the carbonate balance, mash and wort
// by the model; the wort moves by the residual alkalinity of its doses.
export function phOf(col: Column, state: WaterState): number | undefined {
  const b = col.basis;
  if (!b) return col.wort || col.key === 'mash' ? undefined : waterPh(state);
  if (b.kind === 'mash') return mashPh(b.diPh, b.ratio, state);
  return b.startPh + ((figuresOf(state).ra - figuresOf(col.start).ra) * col.volumeL) / b.bufferMeq;
}

// Unset source water: the brewery's default, else its first profile, else VE water.
export function calcTreatment(recipe: Recipe, w: Water, brewery: Brewery | null, catalog: CatalogIngredient[] | null):
  { columns: Column[]; notes: string[]; model: PhModel; grist?: Grist } {
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

  const column = (key: ColumnKey, volumeL: number, start: WaterState, source?: Source, wort = false, basis?: PhBasis): Column => {
    const doses = rows.flatMap((i) => amountIn(i, key) ?? []);
    const state = applyAgents(start, volumeL, dosesOf(doses));
    const mid = key === 'mash' ? applyAgents(start, volumeL, dosesOf(doses.filter((d) => d.ingredient.timing === 'mash'))) : undefined;
    const c: Column = { key, wort, volumeL, source, doses, start, mid, state, before: figuresOf(start), after: figuresOf(state), basis };
    if (basis) c.ph = { before: phOf(c, mid ?? start)!, after: phOf(c, state)! };
    return c;
  };
  const water = (key: WaterKey, volumeL: number) => {
    const s = sourceOf(key);
    return column(key, volumeL, blend(stateOf(s.water), stateOf(s.blendWith), s.blendPct), s);
  };

  // The model troester needs the grist in the strike water's mash thickness.
  const model = brewery?.phModel ?? DEFAULT_PH_MODEL;
  let grist: Grist | undefined;
  if (model === 'troester') {
    const { parts, notes: gristNotes } = gristOf(recipe, catalog);
    notes.push(...gristNotes);
    const ratio = w.mashRatioLPerKg;
    const diPh = ratio === undefined ? undefined : distilledWaterPh(parts, ratio);
    if (diPh === undefined) notes.push('Für die pH-Schätzung fehlen verknüpfte Malze in der Maische.');
    else grist = { parts, diPh, ratio: ratio!, bufferMeq: MALT_BUFFER * parts.reduce((s, p) => s + p.kg, 0) };
  }
  // The wort starts from the pH before it; what flows in moves it by its
  // residual alkalinity (mEq) on the malt's buffer.
  const wortBasis = (ph: number | undefined, inflowMeq = 0): PhBasis | undefined =>
    grist && ph !== undefined ? { kind: 'wort', startPh: ph + inflowMeq / grist.bufferMeq, bufferMeq: grist.bufferMeq } : undefined;

  const strike = water('strike', w.strikeFillL);
  const mash = column('mash', w.strikeL, strike.state, undefined, false,
    grist && { kind: 'mash', diPh: grist.diPh, ratio: grist.ratio });
  const sparge = w.sparge ? water('sparge', w.spargeFillL) : undefined;
  const d = w.dilution;
  const dilution = d.volumeL > 0 ? water('dilution', d.volumeL) : undefined;

  // The wort carries what mash and sparge water brought, mixed by volume (grain
  // and losses hold back their share alike); the boil concentrates it. A
  // dilution in the kettle is in the knock-out, one in the fermenter only in
  // the total. Malt ions and what precipitates are not counted.
  const spargeShare = sparge && w.spargeL > 0 ? (100 * w.spargeL) / (w.strikeL + w.spargeL) : 0;
  const preBoil = column('preBoil', w.preBoilL, sparge ? blend(mash.state, sparge.state, spargeShare) : mash.state, undefined, true,
    wortBasis(mash.ph?.after, sparge ? sparge.after.ra * w.spargeL : 0));
  let boiled = concentrate(preBoil.state, d.kettleL > 0 ? w.preBoilL / d.kettleL : 1);
  const inKettle = dilution && d.at === 'kettle';
  if (inKettle) boiled = blend(boiled, dilution.state, (100 * d.volumeL) / w.knockOutL);
  const knockOut = column('knockOut', w.knockOutL, boiled, undefined, true,
    wortBasis(preBoil.ph && preBoil.ph.after - BOIL_PH_DROP, inKettle ? dilution.after.ra * d.volumeL : 0));
  const inFermenter = dilution && d.at === 'fermenter';
  const final = inFermenter ? blend(knockOut.state, dilution.state, (100 * d.volumeL) / d.finalL) : knockOut.state;
  const total = column('total', d.finalL, final, undefined, true,
    wortBasis(knockOut.ph?.after, inFermenter ? dilution.after.ra * d.volumeL : 0));

  if (model === 'kolbach') {
    const colors = catalog ? wortExtract(recipe, catalog).colors : [];
    if (colors.length > 0) mash.raTarget = raRangeForColor(beerEbc(colors, recipe.volumeL, d));
    else notes.push('Für den RA-Zielbereich fehlt die Bierfarbe (Vergärbares verknüpfen).');
  }

  // The wort columns show only when something goes in there.
  const columns = [strike, mash, sparge, preBoil.doses.length > 0 && preBoil, knockOut.doses.length > 0 && knockOut, dilution, total]
    .filter((c): c is Column => !!c);
  for (const i of rows) {
    const key = COLUMN_OF[i.timing];
    if (key && !columns.some((c) => c.key === key)) {
      notes.push(`„${i.name || 'Ohne Namen'}“ (${COLUMN_LABEL[key]}) zählt nicht, ${key === 'sparge' ? 'das Rezept hat keinen Nachguss' : 'es ist kein Verschnitt geplant'}.`);
    }
  }
  return { columns, notes: [...new Set(notes)], model, grist };
}

const isBase = (a: WaterAgent) => (a.alk ?? 0) > 0;

// Helper for a column's target pH: the amount of the column's first acid (or
// base, below the target) that reaches it, or of lactic acid (baking soda) when
// there is none yet. Water columns only take acid; in the mash it is the
// addition after the pH measurement. Undefined without a pH.
export function suggestAgent(col: Column, targetPh: number, catalog: CatalogIngredient[] | null):
  { ingredient?: Ingredient; entry?: Auxiliary; amount: number } | undefined {
  const adjusts = (d: ColumnDose) => !d.share && !!d.agent && (isAcid(d.agent.agent) || isBase(d.agent.agent))
    && (col.key !== 'mash' || d.ingredient.timing === 'mashPh');
  const without = phOf(col, applyAgents(col.start, col.volumeL, dosesOf(col.doses.filter((d) => !adjusts(d)))));
  if (without === undefined) return undefined;
  const acid = !col.basis || without > targetPh;
  const own = col.doses.find((d) => adjusts(d) && (acid ? isAcid(d.agent!.agent) : isBase(d.agent!.agent)));
  const agent = own?.agent ?? catalogAgent(catalog, acid ? 'lactic' : 'nahco3');
  if (!agent) return undefined;
  const others = applyAgents(col.start, col.volumeL, dosesOf(col.doses.filter((d) => d !== own)));
  const amount = amountForPh((a) => phOf(col, applyAgents(others, col.volumeL, [
    { agent: agent.agent, mmol: agentMmol(agent.agent, a, agent.strengthPct) },
  ])), targetPh);
  return amount === undefined ? undefined : { ingredient: own?.ingredient, entry: agent.entry, amount };
}

function catalogAgent(catalog: CatalogIngredient[] | null, id: WaterAgentId): Agent | undefined {
  const entry = catalog?.find((c) => c.kind === 'auxiliary' && c.waterAgent === id);
  return entry ? agentOf({ id: '', kind: 'auxiliary', name: '', amount: 0, timing: 'water', ingredientId: entry.id }, catalog) : undefined;
}
