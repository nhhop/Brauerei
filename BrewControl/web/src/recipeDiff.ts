// Comparison of two versions of a recipe, as sections of rows for the compare
// dialog. Pure. `a` is the left (older) side and `b` the right one: a row only
// in `b` is added, one only in `a` removed. A value counts as changed when its
// displayed text differs, so differences below the rounding stay unmarked.
import type { Brewery, Brewhouse } from './brewhouse';
import type { SugarType } from './brewMath';
import { containerLabel, type Container } from './cellar';
import { BASIS_LABEL, basisOf, efficiencyInput } from './efficiency';
import type { CatalogIngredient } from './ingredientCatalog';
import { DEFAULT_MASH_PH } from './mashPh';
import { calcMash, fmtClock } from './mashPlan';
import { atKnockOut, calcStats, wortExtract, type RecipeStats } from './recipeStats';
import { COLUMN_LABEL, waterById } from './recipeTreatment';
import { calcWater, type Water } from './recipeWater';
import {
  CARBONATION_METHODS, DEFAULT_MASH_RATIO, DEFAULT_SPARGE_TEMP, HOP_FORMS, KINDS, MASH_KIND_LABEL, TIMING_LABEL, chargeIdOf,
  chargesOf, isMashGrain, unitOf, type Charge, type Ingredient, type MashStep, type PhKey, type Recipe, type WaterKey,
} from './recipes';
import { resolveTarget } from './waterSolver';

export type DiffState = 'same' | 'added' | 'removed' | 'changed';
// One value on both sides; unset = the side has none. `delta` is b − a of a number.
export interface DiffLine { label?: string; a?: string; b?: string; delta?: string; changed: boolean }
// A field (one line without label) or a list entry (its fields as lines).
export interface DiffRow { title: string; state: DiffState; computed?: true; lines: DiffLine[] }
export interface DiffGroup { title?: string; rows: DiffRow[] }
export interface DiffSection { id: string; title: string; groups: DiffGroup[] }

// What the recipe's calculations give, as the overview shows it.
export interface Derived { stats: RecipeStats | null; water?: Water; mashMin?: number }

export function deriveRecipe(
  r: Recipe, catalog: CatalogIngredient[] | null, brewhouses: Brewhouse[] | null, brewery: Brewery | null,
): Derived {
  const bh = brewhouses?.find((b) => b.id === r.brewhouseId);
  const hot = atKnockOut(r, bh, catalog, brewery);
  const stats = catalog ? calcStats(hot, catalog, bh, brewery) : null;
  const wort = catalog ? wortExtract(hot, catalog, bh, brewery) : undefined;
  const water = calcWater(hot, bh, wort?.extractKg, brewery, wort?.draw).water;
  const mash = bh && water ? calcMash(r, bh, brewery, water) : undefined;
  return { stats, water, mashMin: mash?.totalMin };
}

// ── Matching ───────────────────────────────────────────────────────────────────

// Pairs the rows of two lists: by id, then (with `keyOf`) the rest by key in
// list order. In the order of `b`; a row only in `a` follows the row that
// precedes it in `a`.
export function matchRows<T extends { id: string }>(a: T[], b: T[], keyOf?: (x: T) => string): [T | undefined, T | undefined][] {
  const partner = new Map<T, T>();
  const used = new Set<T>();
  const pair = (y: T, x: T | undefined) => { if (x) { partner.set(y, x); used.add(x); } };
  for (const y of b) pair(y, a.find((x) => x.id === y.id));
  if (keyOf) {
    for (const y of b) if (!partner.has(y)) pair(y, a.find((x) => !used.has(x) && keyOf(x) === keyOf(y)));
  }
  const out: [T | undefined, T | undefined][] = b.map((y) => [partner.get(y), y]);
  a.forEach((x, i) => {
    if (used.has(x)) return;
    let at = 0;
    for (let j = i - 1; j >= 0 && at === 0; j--) at = out.findIndex((p) => p[0] === a[j]) + 1;
    out.splice(at, 0, [x, undefined]);
  });
  return out;
}

// The paired rows that changed their place: those outside the longest run that
// kept its order, so an inserted or removed row moves none.
function movedRows<T>(pairs: [T | undefined, T | undefined][], a: T[]): Set<T> {
  const both = pairs.filter((p): p is [T, T] => !!p[0] && !!p[1]);
  const at = both.map((p) => a.indexOf(p[0]));
  const len = at.map(() => 1);
  const prev = at.map(() => -1);
  at.forEach((v, i) => {
    for (let j = 0; j < i; j++) if (at[j] < v && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prev[i] = j; }
  });
  const moved = new Set(both.map((p) => p[1]));
  for (let i = len.indexOf(Math.max(...len)); i >= 0; i = prev[i]) moved.delete(both[i][1]);
  return moved;
}

// ── Lines and rows ─────────────────────────────────────────────────────────────

// Inputs drop trailing zeros (up to `digits`), computed values keep them.
function fmt(n: number, digits: number, fixed: boolean): string {
  const s = n.toFixed(digits);
  return (fixed || !s.includes('.') ? s : s.replace(/\.?0+$/, '')).replace('.', ',');
}

function numLine(a: number | undefined, b: number | undefined, unit: string, digits: number, label?: string, fixed = false): DiffLine {
  const text = (n: number | undefined) => (n === undefined ? undefined : `${fmt(n, digits, fixed)} ${unit}`.trim());
  const line: DiffLine = { label, a: text(a), b: text(b), changed: text(a) !== text(b) };
  if (line.changed && a !== undefined && b !== undefined) {
    const d = Number(b.toFixed(digits)) - Number(a.toFixed(digits));
    line.delta = `${d < 0 ? '−' : '+'}${fmt(Math.abs(d), digits, fixed)} ${unit}`.trim();
  }
  return line;
}

function textLine(a: string | undefined, b: string | undefined, label?: string): DiffLine {
  return { label, a: a || undefined, b: b || undefined, changed: (a || '') !== (b || '') };
}

const field = (title: string, line: DiffLine): DiffRow =>
  ({ title, state: line.changed ? 'changed' : 'same', lines: [line] });
const computed = (title: string, line: DiffLine): DiffRow => ({ ...field(title, line), computed: true });

// A list entry; lines without a value on either side are left out.
function entry(title: string, a: unknown, b: unknown, lines: DiffLine[]): DiffRow {
  const shown = lines.filter((l) => l.a !== undefined || l.b !== undefined);
  if (a && b) return { title, state: shown.some((l) => l.changed) ? 'changed' : 'same', lines: shown };
  return { title, state: a ? 'removed' : 'added', lines: shown.map(({ delta: _, ...l }) => ({ ...l, changed: false })) };
}

const positionLine = (a: number, b: number): DiffLine =>
  ({ label: 'Position', a: `${a + 1}.`, b: `${b + 1}.`, changed: true });

const yesNo = (v: boolean | undefined) => (v === undefined ? undefined : v ? 'ja' : 'nein');

// ── Sections ───────────────────────────────────────────────────────────────────

// `containers` names the bottling rows; unset or not loaded = their ids.
export interface DiffContext { brewhouses: Brewhouse[] | null; brewery: Brewery | null; containers?: Container[] | null }

export function diffRecipes(a: Recipe, b: Recipe, da: Derived, db: Derived, ctx: DiffContext): DiffSection[] {
  return [
    { id: 'recipe', title: 'Rezept', groups: recipeGroups(a, b, da, db, ctx) },
    { id: 'ingredients', title: 'Zutaten', groups: ingredientGroups(a, b) },
    { id: 'water', title: 'Wasser', groups: waterGroups(a, b, da, db, ctx.brewery) },
    { id: 'mash', title: 'Maischen', groups: mashGroups(a, b, da, db) },
    { id: 'boil', title: 'Würzekochen', groups: [{ rows: [
      field('Kochdauer', numLine(a.boil.durationMin, b.boil.durationMin, 'min', 0)),
      field('Whirlpool-Temperatur', numLine(a.boil.whirlpoolTempC, b.boil.whirlpoolTempC, '°C', 1)),
      field('Whirlpool-Dauer', numLine(a.boil.whirlpoolMin, b.boil.whirlpoolMin, 'min', 0)),
    ] }] },
    { id: 'fermentation', title: 'Gärung', groups: [{ rows: phaseRows(a, b) }, { rows: bottlingRows(a, b, ctx.containers) }] },
  ].map((s) => ({ ...s, groups: s.groups.filter((g) => g.rows.length > 0) }));
}

function recipeGroups(a: Recipe, b: Recipe, da: Derived, db: Derived, { brewhouses, brewery }: DiffContext): DiffGroup[] {
  const bhOf = (r: Recipe) => brewhouses?.find((x) => x.id === r.brewhouseId);
  const bhName = (r: Recipe) => bhOf(r)?.name ?? (r.brewhouseId ? `${r.brewhouseId} (fehlt)` : undefined);
  const basis = basisOf(brewery);
  const status = (r: Recipe) => (r.status === 'draft' ? 'Entwurf' : 'Fertig');
  const sa = da.stats, sb = db.stats;
  const ea = sa?.efficiency, eb = sb?.efficiency;
  const pct = (title: string, x?: number, y?: number) => computed(title, numLine(x, y, '%', 0, undefined, true));
  const volumeTitle = (r: Recipe) => (r.volumeBasis === 'cold' ? 'Anstellwürze' : 'Ausschlagmenge');
  const volumeBasis = (r: Recipe) => (r.volumeBasis === 'cold' ? 'Anstellwürze (kalt)' : 'Ausschlag (heiß)');
  return [
    { rows: [
      field('Name', textLine(a.name, b.name)),
      field('Stil', textLine(a.style, b.style)),
      field(volumeTitle(a) === volumeTitle(b) ? volumeTitle(b) : 'Menge', numLine(a.volumeL, b.volumeL, 'l', 1)),
      field('Mengenbezug', textLine(volumeBasis(a), volumeBasis(b))),
      field(`${BASIS_LABEL[basis]} (Eingabe)`,
        numLine(efficiencyInput(a, bhOf(a), basis).pct, efficiencyInput(b, bhOf(b), basis).pct, '%', 1)),
      field('Sudhaus', textLine(bhName(a), bhName(b))),
      field('Status', textLine(status(a), status(b))),
      field('Beschreibung', textLine(a.description, b.description)),
    ] },
    { title: 'Kennwerte', rows: [
      computed('Stammwürze', numLine(sa?.ogPlato, sb?.ogPlato, '°P', 1, undefined, true)),
      computed('Restextrakt', numLine(sa?.fgPlato, sb?.fgPlato, '°P', 1, undefined, true)),
      computed('Alkohol', numLine(sa?.abv, sb?.abv, '% vol', 1, undefined, true)),
      computed('Bittere', numLine(sa?.ibu, sb?.ibu, 'IBU', 0, undefined, true)),
      computed('Farbe', numLine(sa?.ebc, sb?.ebc, 'EBC', 0, undefined, true)),
    ] },
    { title: 'Effizienz', rows: [
      pct(BASIS_LABEL.conversion, ea?.conversionPct, eb?.conversionPct),
      pct('Läutereffizienz', ea?.lauter?.pct, eb?.lauter?.pct),
      pct(BASIS_LABEL.mash, ea?.mashPct, eb?.mashPct),
      pct(BASIS_LABEL.yield, ea?.yieldPct, eb?.yieldPct),
      pct(BASIS_LABEL.fermenter, ea?.fermenterPct, eb?.fermenterPct),
    ] },
  ];
}

// Rows the id does not pair: the same ingredient at the same moment.
const ingredientKey = (i: Ingredient) => `${i.kind}|${i.ingredientId ?? `name:${i.name}`}|${i.timing}`;

function ingredientGroups(a: Recipe, b: Recipe): DiffGroup[] {
  const pairs = matchRows(a.ingredients, b.ingredients, ingredientKey);
  // Once a side has more than one charge, a mash grain shows the one it belongs to.
  const split = chargesOf(a).length > 1 || chargesOf(b).length > 1;
  const chargeName = (r: Recipe, i?: Ingredient) => {
    const charges = chargesOf(r);
    if (!i || !isMashGrain(i) || !split) return undefined;
    return charges.find((c) => c.id === chargeIdOf(i, charges))!.name;
  };
  const timing = (r: Recipe, i?: Ingredient) => i && (i.timing === 'boil'
    ? `${TIMING_LABEL.boil} · ${i.timeMin ?? r.boil.durationMin} min` : TIMING_LABEL[i.timing]);
  return KINDS.map((k) => ({
    title: k.label,
    rows: pairs.filter(([x, y]) => (y ?? x)!.kind === k.id).map(([x, y]) => entry((y ?? x)!.name || 'Ohne Namen', x, y, [
      ...(x && y && x.name !== y.name ? [textLine(x.name, y.name, 'Name')] : []),
      numLine(x?.amount, y?.amount, unitOf(k.id), 3, 'Menge'),
      textLine(timing(a, x), timing(b, y), 'Zeitpunkt'),
      numLine(x?.strengthPct, y?.strengthPct, '%', 1, 'Konzentration'),
      textLine(chargeName(a, x), chargeName(b, y), 'Schüttung'),
      textLine(hopForm(x), hopForm(y), 'Form'),
      textLine(dryHop(x), dryHop(y), 'Stopfen'),
    ])),
  }));
}

const WATER_KEYS: WaterKey[] = ['strike', 'sparge', 'dilution'];
const PH_KEYS: PhKey[] = ['strike', 'mash', 'sparge', 'preBoil', 'knockOut', 'dilution'];
const TARGET_IONS = [['ca', 'Ca'], ['mg', 'Mg'], ['na', 'Na'], ['so4', 'SO₄'], ['cl', 'Cl'], ['hco3', 'HCO₃']] as const;

function waterGroups(a: Recipe, b: Recipe, da: Derived, db: Derived, brewery: Brewery | null): DiffGroup[] {
  const wa = a.water ?? {}, wb = b.water ?? {};
  // The sparge in effect needs the brewhouse; without one the setting stands.
  const spargeA = da.water?.sparge ?? wa.sparge ?? true;
  const spargeB = db.water?.sparge ?? wb.sparge ?? true;
  const when = <T,>(on: boolean, v: T) => (on ? v : undefined);
  const method = (m?: 'batch' | 'fly') => (m === 'fly' ? 'Fly Sparge' : 'Batch Sparge');
  const batches = (w: typeof wa, sparge: boolean) => when(sparge && w.spargeMethod !== 'fly', w.spargeBatches ?? 1);

  const source = (r: Recipe, key: WaterKey, on: boolean) => {
    if (!on) return undefined;
    const s = r.water?.sources?.[key];
    const id = s?.waterId ?? brewery?.defaultWaterId;
    const name = waterById(brewery, id)?.name ?? (id ? `${id} (fehlt)` : undefined);
    if (!name || !s?.blendPct) return name;
    return `${name}, ${fmt(s.blendPct, 1, false)} % ${waterById(brewery, s.blendId)?.name ?? 'VE-Wasser'}`;
  };
  const sourceOn = (r: Recipe, sparge: boolean): Record<WaterKey, boolean> =>
    ({ strike: true, sparge, dilution: !!r.water?.dilution });
  const onA = sourceOn(a, spargeA), onB = sourceOn(b, spargeB);

  const dil = (r: Recipe) => r.water?.dilution;
  const dilAt = (r: Recipe) => dil(r) && (dil(r)!.at === 'kettle' ? 'Pfanne bei Kochende' : 'Gärbehälter');
  const dilLead = (r: Recipe) => dil(r) && (dil(r)!.lead === 'gravity' ? 'Stammwürze' : 'Menge');
  const dilVolume = (r: Recipe, d: Derived) => dil(r) && (d.water?.dilution.volumeL ?? when(dil(r)!.lead === 'volume', dil(r)!.volumeL));
  const dilPlato = (r: Recipe) => when(dil(r)?.lead === 'gravity', dil(r)?.plato);

  const ta = resolveTarget(wa.target, brewery), tb = resolveTarget(wb.target, brewery);
  const targetPh = (w: typeof wa, k: PhKey) => w.targetPh?.[k] ?? when(k === 'mash', DEFAULT_MASH_PH);

  return [
    { rows: [
      field('Mit Nachguss', textLine(yesNo(spargeA), yesNo(spargeB))),
      entry('Hauptguss-Verhältnis', 1, 1, [numLine(
        when(spargeA, wa.mashRatioLPerKg ?? DEFAULT_MASH_RATIO), when(spargeB, wb.mashRatioLPerKg ?? DEFAULT_MASH_RATIO), 'l/kg', 2)]),
      entry('Nachguss-Temperatur', 1, 1, [numLine(
        when(spargeA, wa.spargeTempC ?? DEFAULT_SPARGE_TEMP), when(spargeB, wb.spargeTempC ?? DEFAULT_SPARGE_TEMP), '°C', 1)]),
      entry('Läutern', 1, 1, [textLine(when(spargeA, method(wa.spargeMethod)), when(spargeB, method(wb.spargeMethod)))]),
      entry('Gaben', 1, 1, [numLine(batches(wa, spargeA), batches(wb, spargeB), '', 0)]),
      entry('Verdampfung', 1, 1, [numLine(
        da.water?.evaporationLPerH ?? wa.evaporationLPerH, db.water?.evaporationLPerH ?? wb.evaporationLPerH, 'l/h', 2)]),
      entry('Treberverlust', 1, 1, [numLine(
        da.water?.absorptionLPerKg ?? wa.grainAbsorptionLPerKg, db.water?.absorptionLPerKg ?? wb.grainAbsorptionLPerKg, 'l/kg', 2)]),
    ].filter((r) => r.lines.length > 0) },
    { title: 'Ausgangswasser', rows: WATER_KEYS
      .map((k) => entry(COLUMN_LABEL[k], 1, 1, [textLine(source(a, k, onA[k]), source(b, k, onB[k]))]))
      .filter((r) => r.lines.length > 0) },
    { title: 'Verschnitt', rows: dil(a) || dil(b) ? [
      field('Ort', textLine(dilAt(a), dilAt(b))),
      field('Vorgabe', textLine(dilLead(a), dilLead(b))),
      field('Menge', numLine(dilVolume(a, da), dilVolume(b, db), 'l', 1)),
      entry('Stammwürze', 1, 1, [numLine(dilPlato(a), dilPlato(b), '°P', 1)]),
    ].filter((r) => r.lines.length > 0) : [] },
    { title: 'Ziel-pH', rows: PH_KEYS
      .map((k) => entry(COLUMN_LABEL[k], 1, 1, [numLine(targetPh(wa, k), targetPh(wb, k), '', 2)]))
      .filter((r) => r.lines.length > 0) },
    { title: 'Zielprofil', rows: ta || tb ? [
      entry('Profil', 1, 1, [
        textLine(ta?.name ?? '—', tb?.name ?? '—'),
        // Own values are part of the recipe; a picked profile is the brewery's.
        ...(wa.target?.ions || wb.target?.ions
          ? TARGET_IONS.map(([ion, label]) => numLine(wa.target?.ions?.[ion], wb.target?.ions?.[ion], 'mg/l', 1, label)) : []),
      ]),
    ] : [] },
    { title: 'Mengen', rows: [
      computed('Hauptguss', numLine(da.water?.strikeL, db.water?.strikeL, 'l', 1, undefined, true)),
      computed('Nachguss', numLine(
        da.water && when(da.water.sparge, da.water.spargeL), db.water && when(db.water.sparge, db.water.spargeL), 'l', 1, undefined, true)),
      computed('Pfannevoll', numLine(da.water?.preBoilL, db.water?.preBoilL, 'l', 1, undefined, true)),
    ] },
  ];
}

function mashGroups(a: Recipe, b: Recipe, da: Derived, db: Derived): DiffGroup[] {
  const ca = chargesOf(a), cb = chargesOf(b);
  const split = ca.length > 1 || cb.length > 1;
  const grainKg = (r: Recipe, charges: Charge[], c?: Charge) => c && r.ingredients
    .filter((i) => isMashGrain(i) && chargeIdOf(i, charges) === c.id).reduce((sum, i) => sum + i.amount, 0);
  const chargePairs = matchRows(ca, cb);
  const chargesMoved = movedRows(chargePairs, ca);

  const chargeOf = (charges: Charge[], s?: MashStep) =>
    (s?.kind === 'doughIn' && split ? charges.find((c) => c.id === chargeIdOf(s, charges))!.name : undefined);
  const rests = (s?: MashStep) => s?.decoction?.rests.map((r) => `${fmt(r.tempC, 1, false)} °C ${fmt(r.durationMin, 0, false)} min`).join(', ');
  const thickness = (s?: MashStep) => s?.decoction && (s.decoction.thin ? 'dünn' : 'dick');
  const restMash = (s?: MashStep) => s?.decoction && (s.decoction.holdRest ? 'gehalten' : 'unbeheizt');
  const water = (s?: MashStep) => (s?.infusion?.ice ? 'Eis' : undefined);
  // Of volume and temperature, share and temperature, only the one that leads is an input.
  const lead = <T,>(on: boolean | undefined, v: T) => (on ? v : undefined);
  const stepPairs = matchRows(a.mash, b.mash);
  const stepsMoved = movedRows(stepPairs, a.mash);

  const mashMin = (d: Derived) => (d.mashMin === undefined ? undefined : `${fmtClock(d.mashMin)} h`);
  const duration: DiffLine = { a: mashMin(da), b: mashMin(db), changed: mashMin(da) !== mashMin(db) };
  if (duration.changed && da.mashMin !== undefined && db.mashMin !== undefined) {
    const d = Math.round(db.mashMin) - Math.round(da.mashMin);
    duration.delta = `${d < 0 ? '−' : '+'}${Math.abs(d)} min`;
  }

  return [
    { title: 'Teilschüttungen', rows: split ? chargePairs.map(([x, y]) => entry((y ?? x)!.name, x, y, [
      ...(x && y && x.name !== y.name ? [textLine(x.name, y.name, 'Name')] : []),
      numLine(grainKg(a, ca, x), grainKg(b, cb, y), 'kg', 3, 'Malz'),
      ...(y && chargesMoved.has(y) ? [positionLine(ca.indexOf(x!), cb.indexOf(y))] : []),
    ])) : [] },
    { title: 'Maischeplan', rows: stepPairs.map(([x, y]) => entry((y ?? x)!.name || MASH_KIND_LABEL[(y ?? x)!.kind], x, y, [
      ...(x && y && x.name !== y.name ? [textLine(x.name, y.name, 'Name')] : []),
      textLine(x && MASH_KIND_LABEL[x.kind], y && MASH_KIND_LABEL[y.kind], 'Art'),
      numLine(x?.tempC, y?.tempC, '°C', 1, 'Temperatur'),
      numLine(x?.durationMin, y?.durationMin, 'min', 0, 'Dauer'),
      textLine(chargeOf(ca, x), chargeOf(cb, y), 'Schüttung'),
      textLine(water(x), water(y), 'Zubrühen mit'),
      numLine(lead(x?.infusion?.lead === 'volume', x?.infusion?.volumeL), lead(y?.infusion?.lead === 'volume', y?.infusion?.volumeL), 'l', 1, 'Zubrühmenge'),
      numLine(lead(x?.infusion?.lead === 'temp' && !x.infusion.ice, x?.infusion?.waterTempC),
        lead(y?.infusion?.lead === 'temp' && !y.infusion.ice, y?.infusion?.waterTempC), '°C', 1, 'Wassertemperatur'),
      numLine(lead(x?.decoction?.lead === 'share', x?.decoction?.sharePct), lead(y?.decoction?.lead === 'share', y?.decoction?.sharePct), '%', 1, 'Dekoktionsanteil'),
      textLine(thickness(x), thickness(y), 'Dekoktion'),
      textLine(rests(x), rests(y), 'Rasten der Kochmaische'),
      numLine(x?.decoction?.boilMin, y?.decoction?.boilMin, 'min', 0, 'Kochzeit'),
      textLine(restMash(x), restMash(y), 'Restmaische'),
      ...(y && stepsMoved.has(y) ? [positionLine(a.mash.indexOf(x!), b.mash.indexOf(y))] : []),
    ])) },
    { rows: [field('Aufheizzeit zählt zur Rast', textLine(yesNo(!!a.mashRampInRest), yesNo(!!b.mashRampInRest))), computed('Maischdauer', duration)] },
  ];
}

const hopForm = (i?: Ingredient) => i?.form && HOP_FORMS.find((f) => f.value === i.form)?.label;
const dryHop = (i?: Ingredient) => (i?.dryHopDay === undefined && i?.dryHopDays === undefined ? undefined
  : `Tag ${i.dryHopDay ?? '–'}, ${i.dryHopDays ?? '–'} Tage`);

const SUGAR_LABEL: Record<SugarType, string> = { saccharose: 'Saccharose', traubenzucker: 'Traubenzucker', dme: 'DME' };

function bottlingRows(a: Recipe, b: Recipe, containers?: Container[] | null): DiffRow[] {
  const method = (r: Recipe) => CARBONATION_METHODS.find((m) => m.value === r.carbonation?.method)?.label;
  const sugar = (r: Recipe) => (r.carbonation?.method === 'sugar' ? SUGAR_LABEL[r.carbonation.sugarType ?? 'saccharose'] : undefined);
  const name = (id: string) => {
    const c = containers?.find((x) => x.id === id);
    return c ? containerLabel(c) : id;
  };
  const rows = (r: Recipe) => r.bottling?.containers.map((x) => `${x.count ?? 'Rest'} × ${name(x.containerId)}`).join(', ');
  return [
    field('Unter Druck vergären', textLine(yesNo(!!a.pressureFermentation), yesNo(!!b.pressureFermentation))),
    field('Trub', numLine(a.trubLossL, b.trubLossL, 'l', 1)),
    field('Karbonisierung', textLine(method(a), method(b))),
    field('CO₂-Ziel', numLine(a.carbonation?.targetVol, b.carbonation?.targetVol, 'vol', 2)),
    field('Zucker', textLine(sugar(a), sugar(b))),
    field('Gebinde', textLine(rows(a), rows(b))),
  ];
}

function phaseRows(a: Recipe, b: Recipe): DiffRow[] {
  const pairs = matchRows(a.fermentation, b.fermentation);
  const moved = movedRows(pairs, a.fermentation);
  return pairs.map(([x, y]) => entry((y ?? x)!.name || 'Ohne Namen', x, y, [
    ...(x && y && x.name !== y.name ? [textLine(x.name, y.name, 'Name')] : []),
    numLine(x?.tempC, y?.tempC, '°C', 1, 'Temperatur'),
    numLine(x?.duration, y?.duration, 'Tage', 1, 'Dauer'),
    numLine(x?.rampDays, y?.rampDays, 'Tage', 1, 'Rampe'),
    numLine(x?.pressureBar, y?.pressureBar, 'bar', 2, 'Druck'),
    ...(y && moved.has(y) ? [positionLine(a.fermentation.indexOf(x!), b.fermentation.indexOf(y))] : []),
  ]));
}
