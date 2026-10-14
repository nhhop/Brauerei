// Brew day (Sud 5b): the targets of a brew's measurements from the recipe chain
// of the tabs (recipeStats → recipeWater → mashPlan → recipeTreatment) on the
// brew's frozen copies, the efficiencies counted back from what was measured,
// and how far a value is off. Pure, like recipeStats.ts.
import { platoFromExtract, pressureAtAltitudeHpa } from './brewMath';
import { MEASUREMENTS, breweryBoilC, type Brewery, type Brewhouse, type MeasureKey } from './brewhouse';
import type { Brew, MeasureId } from './brews';
import type { Efficiency, Grist } from './efficiency';
import { platoToSg } from './gravityUnits';
import type { CatalogIngredient } from './ingredientCatalog';
import { DEFAULT_MASH_PH, mashPh } from './mashPh';
import { calcMash, type MashPlan } from './mashPlan';
import { atKnockOut, wortExtract } from './recipeStats';
import { calcTreatment, suggestAgent, type Column } from './recipeTreatment';
import { calcWater, type Water } from './recipeWater';
import { DEFAULT_SPARGE_TEMP, type Recipe } from './recipes';
import { WATER_AGENTS, isAcid } from './waterChem';

// What a brew computes with: its copies once started, today's objects before.
export interface BrewInputs {
  bh?: Brewhouse;
  brewery: Brewery | null;
  entries: CatalogIngredient[] | null;  // null = the catalog did not load (yet)
}

export function brewInputs(
  brew: Brew, live: { brewhouses: Brewhouse[] | null; brewery: Brewery | null; entries: CatalogIngredient[] | null },
): BrewInputs {
  if (brew.frozen) return { bh: brew.frozen.brewhouse, brewery: brew.frozen.brewery, entries: brew.frozen.entries };
  return { bh: live.brewhouses?.find((b) => b.id === brew.brewhouseId), brewery: live.brewery, entries: live.entries };
}

// What the efficiencies are counted back with, from the same grist as the targets.
export interface EfficiencyContext {
  grist: Grist;
  boilOtherKg: number;   // other extract added in the kettle, missing before the boil
  shrink: number;        // cooling shrink, fraction: kettle volumes are hot, gravities cold
  mashWaterKg: number;   // water in the mash: strike, infusions, less what boiled off
}

export interface BrewTargets {
  values: Partial<Record<MeasureId, number>>;
  boilC: number;
  water?: Water;
  mash?: MashPlan;
  columns: Column[];
  efficiency?: Efficiency;
  ctx?: EfficiencyContext;
  dilutionInKettle: boolean;  // the knock-out target is before it
  notes: string[];
}

// Troester's mash gravity test: the first wort holds the dissolved extract in
// the mash water, °P = 100 · D / (D + W). The grain's own moisture is left out.
// TODO(verify): against Troester, "Understanding Efficiency" (braukaiser.com).
export const firstWortPlato = (dissolvedKg: number, waterKg: number) =>
  dissolvedKg + waterKg > 0 ? (100 * dissolvedKg) / (dissolvedKg + waterKg) : 0;
const dissolvedOf = (plato: number, waterKg: number) => (waterKg * plato) / (100 - plato);

// Extract (kg) in a cold volume of wort at `plato`, the inverse of platoFromExtract.
const extractIn = (volumeL: number, plato: number) => volumeL * platoToSg(plato) * (plato / 100);

export function brewTargets(recipe: Recipe, { bh, brewery, entries }: BrewInputs): BrewTargets {
  // The brew may use another brewhouse than the recipe names; a cold volume
  // gives its knock-out with that brewhouse.
  const r = atKnockOut(bh ? { ...recipe, brewhouseId: bh.id } : recipe, bh, entries, brewery);
  const wort = entries ? wortExtract(r, entries, bh, brewery) : undefined;
  const { water, notes } = calcWater(r, bh, wort?.extractKg, brewery, wort?.draw);
  const values: BrewTargets['values'] = {};
  const out: BrewTargets = {
    values, boilC: breweryBoilC(brewery), water, columns: [], efficiency: wort?.efficiency, dilutionInKettle: false, notes,
  };
  if (!water || !bh) return out;

  const mash = calcMash(r, bh, brewery, water);
  const { columns } = calcTreatment(r, water, brewery, entries);
  const col = (k: Column['key']) => columns.find((c) => c.key === k);
  Object.assign(out, { mash, columns });

  values.strikeVolume = water.strikeFillL;
  values.strikeTemp = mash.rows.find((x) => x.step.kind === 'strike')?.waterTempC;
  values.strikePh = col('strike')?.after.ph;
  if (water.sparge) {
    values.spargeVolume = water.spargeFillL;
    values.spargeTemp = r.water?.spargeTempC ?? DEFAULT_SPARGE_TEMP;
    values.spargePh = col('sparge')?.after.ph;
  }
  // Measured after dough-in, before the addition after the pH measurement.
  values.mashPh = col('mash')?.ph?.before;
  values.mashPhAcid = r.water?.targetPh?.mash ?? DEFAULT_MASH_PH;
  values.preBoilVolume = water.preBoilL;
  // The wort has a model pH only where something goes in.
  values.preBoilPh = col('preBoil')?.ph?.after;
  values.postBoilPh = col('knockOut')?.ph?.after;
  values.airPressure = pressureAtAltitudeHpa(brewery?.altitudeM ?? 0);
  // Measured at the end of the boil, before a dilution in the kettle.
  const d = water.dilution;
  values.postBoilVolume = d.kettleL;
  values.postBoilGravity = d.kettlePlato;
  out.dilutionInKettle = d.at === 'kettle' && d.volumeL > 0;

  if (!wort) return out;
  const { grist, boilOtherKg, efficiency } = wort;
  const shrink = bh.coolingShrinkPct / 100;
  out.ctx = { grist, boilOtherKg, shrink, mashWaterKg: water.strikeL - water.mashEvaporationL };
  if (wort.extractKg !== undefined) {
    // Sugar for the kettle is not in yet.
    values.preBoilGravity = platoFromExtract(wort.extractKg - boilOtherKg, water.preBoilL * (1 - shrink));
  }
  if (efficiency.conversionPct !== undefined && grist.grainExtractKg > 0) {
    const mashOtherKg = grist.otherExtractKg - boilOtherKg;
    values.firstWortGravity = firstWortPlato((efficiency.conversionPct / 100) * grist.grainExtractKg + mashOtherKg, out.ctx.mashWaterKg);
  }
  return out;
}

// The acid (or base) that brings the measured mash pH to the target: the
// recipe's helper (suggestAgent) on the mash column, its pH anchored to the
// measurement. The model troester's and the water's response to acid stay; the
// grist's pH is the measured one, so it works under the model kolbach too.
export interface AcidSuggestion {
  amount: number;
  unit: 'g' | 'ml';
  name: string;
  base: boolean;
  rowId?: string;     // the recipe row it goes to; unset = one the recipe does not have
  entryId?: string;
}

export function mashAcidSuggestion(t: BrewTargets, measuredPh: number, entries: CatalogIngredient[] | null):
  AcidSuggestion | undefined {
  const col = t.columns.find((c) => c.key === 'mash');
  const ratio = t.water?.mashRatioLPerKg;
  const targetPh = t.values.mashPhAcid;
  if (!col || ratio === undefined || targetPh === undefined) return undefined;
  const diPh = measuredPh - mashPh(0, ratio, col.mid ?? col.start);
  const s = suggestAgent({ ...col, basis: { kind: 'mash', diPh, ratio } }, targetPh, entries);
  const agentId = s?.entry?.waterAgent;
  if (!s || !agentId) return undefined;
  const agent = WATER_AGENTS[agentId];
  return {
    amount: s.amount, unit: agent.form === 'solid' ? 'g' : 'ml', name: s.ingredient?.name || s.entry!.name,
    base: !isAcid(agent), rowId: s.ingredient?.id, entryId: s.entry!.id,
  };
}

export interface MeasuredEfficiency {
  from?: 'preBoil' | 'postBoil';  // which pair of volume and gravity counted
  mashPct?: number;
  yieldPct?: number;
  conversionPct?: number;
  lauterPct?: number;
}

// The efficiency chain (efficiency.ts) backwards: the extract measured in the
// kettle less what sugar and extract brought, over the grain's potential.
// Pfannevoll and the gravity before the boil count first, else the knock-out.
export function measuredEfficiency(m: Partial<Record<MeasureId, number>>, ctx: EfficiencyContext): MeasuredEfficiency {
  const { grist, boilOtherKg, shrink, mashWaterKg } = ctx;
  const potential = grist.grainExtractKg;
  const out: MeasuredEfficiency = {};
  if (potential <= 0) return out;
  const mashOtherKg = grist.otherExtractKg - boilOtherKg;

  const pre = m.preBoilVolume !== undefined && m.preBoilGravity !== undefined;
  const post = m.postBoilVolume !== undefined && m.postBoilGravity !== undefined;
  if (pre || post) {
    const [v, p, other] = pre
      ? [m.preBoilVolume!, m.preBoilGravity!, mashOtherKg]
      : [m.postBoilVolume!, m.postBoilGravity!, grist.otherExtractKg];
    out.from = pre ? 'preBoil' : 'postBoil';
    out.mashPct = ((extractIn(v * (1 - shrink), p) - other) / potential) * 100;
    if (grist.grainKg > 0) out.yieldPct = (out.mashPct * potential) / grist.grainKg;
  }
  const fw = m.firstWortGravity;
  if (fw !== undefined && fw > 0 && fw < 100) {
    out.conversionPct = ((dissolvedOf(fw, mashWaterKg) - mashOtherKg) / potential) * 100;
  }
  if (out.mashPct !== undefined && out.conversionPct !== undefined && out.conversionPct > 0) {
    out.lauterPct = (out.mashPct / out.conversionPct) * 100;
  }
  return out;
}

export const measuredValues = (brew: Pick<Brew, 'measurements'>): Partial<Record<MeasureId, number>> =>
  Object.fromEntries(Object.entries(brew.measurements ?? {}).map(([k, x]) => [k, x!.v]));

// The brew with its results for the list (brews.ts): the gravity after the
// boil as target and as measured, and the measured efficiencies. With a
// dilution that gravity is the one before it. A value that does not follow is
// removed.
export function withResults(brew: Brew, t: BrewTargets): Brew {
  const m = measuredValues(brew);
  const e = t.ctx ? measuredEfficiency(m, t.ctx) : {};
  const round = (n: number | undefined) => (n === undefined || !Number.isFinite(n) ? undefined : Math.round(n * 100) / 100);
  const out: Brew = {
    ...brew, ogPlato: round(t.values.postBoilGravity), ogActual: round(m.postBoilGravity),
    mashEffPct: round(e.mashPct), yieldPct: round(e.yieldPct),
  };
  for (const k of ['ogPlato', 'ogActual', 'mashEffPct', 'yieldPct'] as const) if (out[k] === undefined) delete out[k];
  return out;
}

// ── Deviation ──────────────────────────────────────────────────────────────────

// Assumed tolerances of the brew day (Plan 5b): beyond them a value is marked.
// Volumes in percent of the target, efficiencies in points.
export const TOLERANCE: Record<string, number> = { '°P': 0.2, l: 2.5, pH: 0.1, '°C': 1, '%': 2 };

export const unitOfMeasure = (key: MeasureId): string =>
  key === 'mashPhAcid' ? 'pH' : key === 'speiseVolume' || key === 'dipWortVolume' ? 'l'
    : MEASUREMENTS.find((x) => x.key === (key as MeasureKey))?.unit ?? '';

const signed = (n: number, digits: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits).replace('.', ',')}`;

// Unset without both values or for a unit without a tolerance.
export function deviation(key: MeasureId | 'efficiency', soll: number | undefined, ist: number | undefined):
  { text: string; level: 'ok' | 'warn' } | undefined {
  if (soll === undefined || ist === undefined) return undefined;
  const unit = key === 'efficiency' ? '%' : unitOfMeasure(key);
  const tol = TOLERANCE[unit];
  if (tol === undefined) return undefined;
  const diff = ist - soll;
  if (unit === 'l') {
    const pct = soll > 0 ? (diff / soll) * 100 : 0;
    return { text: `${signed(diff, 1)} l (${signed(pct, 1)} %)`, level: Math.abs(pct) > tol + 1e-9 ? 'warn' : 'ok' };
  }
  const text = unit === '%' ? `${signed(diff, 1)} Pkt.` : unit === 'pH' ? signed(diff, 2)
    : unit === '°C' ? `${signed(diff, 1)} K` : `${signed(diff, 1)} ${unit}`;
  return { text, level: Math.abs(diff) > tol + 1e-9 ? 'warn' : 'ok' };
}
