import { Plus, Trash2 } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import {
  HOP_FORMS, KINDS, TIMING_LABEL, allowedTimings, defaultTiming, isDryHop, uid,
  type HopForm, type Ingredient, type IngredientKind, type Scope,
} from '../../recipes';
import type { CatalogIngredient, Level, Range } from '../../ingredientCatalog';
import { fieldsOf, getField } from '../../ingredientFields';
import type { IngredientFigures, RowFigures } from '../../ingredientRows';
import { unitOfEntry, useCatalog } from '../../ingredientSource';
import { entryOf, lotFormOf } from '../../stockLots';
import { agentOf } from '../../recipeTreatment';
import { rangeValue } from '../../recipeStats';
import { badge, inp } from '../../ui';
import { Section } from './CalcTable';
import { NumInput, OptNum } from './fields';
import { IngredientPicker } from './IngredientPicker';

// The ingredient tables of the canvas mockup (rezept-sud-editor.md › Zutaten):
// one grid per kind of row, the same column order everywhere. `kind`: tab
// "Zutaten", one table per kind with a column for the moment; `process`: the
// process tabs, rows grouped by moment with the kind as a column; `mash`: like
// `process`, without the kind column. Below the grid's width the rows wrap.
export type Mode = 'kind' | 'process' | 'mash';
export type Layout = 'v' | 'h' | 's';
const layoutOf = (k: IngredientKind): Layout => (k === 'fermentable' ? 'v' : k === 'hop' ? 'h' : 's');

// Literal strings, so Tailwind finds them. Columns: name, [kind], master data,
// [moment], amount, narrow column, two results, action.
const COLS: Record<Mode, Record<Layout, string>> = {
  kind: {
    v: '@[67rem]:grid-cols-[10.625rem_6.875rem_3.5rem_3.5rem_minmax(0,1fr)_13.125rem_6rem_5.5rem_3.25rem_2.75rem_2rem]',
    h: '@[67rem]:grid-cols-[10.625rem_6.875rem_4.75rem_6.625rem_minmax(0,1fr)_13.125rem_6rem_5.5rem_3.25rem_2.75rem_2rem]',
    s: '@[67rem]:grid-cols-[10.625rem_6.875rem_minmax(0,1fr)_13.125rem_6rem_5.5rem_3.25rem_2.75rem_2rem]',
  },
  process: {
    v: '@[67rem]:grid-cols-[10.625rem_8.125rem_6.875rem_3.5rem_3.5rem_minmax(0,1fr)_6rem_5.5rem_3.25rem_2.75rem_4rem]',
    h: '@[67rem]:grid-cols-[10.625rem_8.125rem_6.875rem_4.75rem_6.625rem_minmax(0,1fr)_6rem_5.5rem_3.25rem_2.75rem_4rem]',
    s: '@[67rem]:grid-cols-[10.625rem_8.125rem_6.875rem_minmax(0,1fr)_6rem_5.5rem_3.25rem_2.75rem_4rem]',
  },
  mash: {
    v: '@[67rem]:grid-cols-[10.625rem_6.875rem_3.5rem_3.5rem_minmax(0,1fr)_6rem_5.5rem_3.25rem_2.75rem_4rem]',
    h: '@[67rem]:grid-cols-[10.625rem_6.875rem_4.75rem_6.625rem_minmax(0,1fr)_6rem_5.5rem_3.25rem_2.75rem_4rem]',
    s: '@[67rem]:grid-cols-[10.625rem_6.875rem_minmax(0,1fr)_6rem_5.5rem_3.25rem_2.75rem_4rem]',
  },
};

// A table row of `mode` and `layout`; the grid needs 67rem of the card.
export const rowClass = (mode: Mode, layout: Layout) =>
  `flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 last:border-b-0 @[67rem]:grid @[67rem]:gap-2.5 ${COLS[mode][layout]}`;
// Cells that only hold the grid's place, and parts only the wrapped row needs.
export const gridOnly = 'hidden @[67rem]:block';
export const wrapOnly = '@[67rem]:hidden';

const r = 'text-right tabular-nums';
const num = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',');
const short = (n: number) => num(n, n % 1 ? 1 : 0);
const range = ([lo, hi]: Range, unit: string) =>
  `${lo !== null && hi !== null && lo !== hi ? `${short(lo)}–${short(hi)}` : short(rangeValue([lo, hi]))} ${unit}`;
const addBtn = 'flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-fg/10';
const muted = `${badge} bg-fg/10 text-muted`;

// The label of an enum value of the entry (fieldsOf), e.g. its malt type.
function optionLabel(c: CatalogIngredient, key: string): string | undefined {
  const v = getField(c, key);
  return fieldsOf(c).find((f) => f.key === key)?.options?.find((o) => o.id === v)?.label;
}

const LEVEL: Record<Level, string> = { 'very-low': 'sehr gering', low: 'gering', medium: 'mittel', high: 'hoch', 'very-high': 'sehr hoch' };

// Colour of a beer of `ebc` for the swatch. TODO(verify): the common SRM → RGB
// table of homebrew calculators; no primary source here yet.
const SRM_RGB = ['#FFE699', '#FFD878', '#FFCA5A', '#FFBF42', '#FBB123', '#F8A600', '#F39C00', '#EA8F00', '#E58500',
  '#DE7C00', '#D77200', '#CF6900', '#CB6200', '#C35900', '#BB5100', '#B54C00', '#B04500', '#A63E00', '#A13700',
  '#9B3200', '#952D00', '#8E2900', '#882300', '#821E00', '#7B1A00', '#771900', '#701400', '#6A0E00', '#660D00',
  '#5E0B00', '#5A0A02', '#600903', '#520907', '#4C0505', '#470606', '#440607', '#3F0708', '#3B0607', '#3A070B', '#36080A'];
export const ebcSwatch = (ebc: number) => SRM_RGB[Math.min(Math.max(Math.round(ebc / 1.97), 1), 40) - 1];

const nameLabel = (k: IngredientKind) =>
  ({ fermentable: 'Zutat', hop: 'Sorte', yeast: 'Kultur', aroma: 'Zutat', auxiliary: 'Stoff' })[k];
const EMPTY: Record<IngredientKind, string> = {
  fermentable: 'Kein Vergärbares in diesem Rezept.', hop: 'Kein Hopfen in diesem Rezept.',
  yeast: 'Keine Hefen oder Kulturen in diesem Rezept.', aroma: 'Keine Aromazutaten in diesem Rezept.',
  auxiliary: 'Keine Hilfsstoffe in diesem Rezept.',
};
const SUB: Partial<Record<IngredientKind, string>> = {
  yeast: 'Hefen, Brettanomyces, Milchsäurebakterien, Mischkulturen',
  aroma: 'Früchte, Gewürze, Holz, Kakao, Kaffee …',
  auxiliary: 'Wasseraufbereitung, Klärung, Hefenahrung, Enzyme',
};

// Column heads after the name (and kind) column; `kind` names the row kind
// whose heads a group's head row shows.
function heads(kind: IngredientKind, mode: Mode): [string, boolean?][] {
  const moment: [string, boolean?][] = mode === 'kind' ? [['Zeitpunkt']] : [];
  if (kind === 'fermentable') return [['Typ'], ['Farbe', true], ['Extrakt', true], [''], ...moment, ['Menge', true], ['Anteil', true], ['°P', true], ['EBC', true]];
  if (kind === 'hop') return [['Form'], ['α-Säure', true], ['Ölgehalt', true], [''], ...moment, ['Menge', true], ['Dauer', true], ['Öl ml', true], ['IBU', true]];
  const mid: [string, boolean?][] = kind === 'yeast' ? [['Form'], ['Eigenschaften']] : [[kind === 'aroma' ? 'Kategorie' : 'Zweck'], ['']];
  return [...mid, ...moment, ['Menge', true], ['Details', mode !== 'kind'], [''], ['']];
}

const HeadCells = ({ kind, mode }: { kind: IngredientKind; mode: Mode }) => (
  <>{heads(kind, mode).map(([t, right], n) => <span key={n} class={right ? 'text-right' : ''}>{t}</span>)}</>
);

const headRow = 'bg-fg/[0.03] text-xs font-semibold text-muted';

interface RowProps {
  i: Ingredient;
  mode: Mode;
  scope?: Scope;
  fig?: RowFigures;
  entries: CatalogIngredient[] | null;
  boilMin: number;
  mark?: string;
  patch: (p: Partial<Ingredient>) => void;
  remove: () => void;
}

// One ingredient as a table row.
function IngredientRow({ i, mode, scope, fig, entries, boilMin, mark, patch, remove }: RowProps) {
  const c = entryOf(i, entries);
  const layout = layoutOf(i.kind);
  const fill = 'w-28 @[67rem]:w-full';
  const value = (v: number | undefined, unit: string, digits = 1) => (
    <span class={r}>{v === undefined ? <span class={gridOnly}>—</span> : <>{num(v, digits)}<span class={wrapOnly}> {unit}</span></>}</span>
  );
  const blank = <span class={gridOnly} />;

  function changeKind(k: IngredientKind) {
    patch({
      kind: k, ingredientId: undefined, stockLotId: undefined, timeMin: undefined, form: undefined, dryHopDay: undefined, dryHopDays: undefined,
    });
  }

  const sub = c?.kind === 'hop' ? c.origin : c?.kind === 'culture' ? [c.manufacturer, c.species].filter(Boolean).join(' · ') : c?.manufacturer;
  const name = (
    <div class="min-w-0 flex-1 basis-40 @[67rem]:basis-auto">
      <IngredientPicker ingredient={i} onChange={patch} />
      {(sub || mark) && (
        <div class="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
          {mark && <span class={muted}>{mark}</span>}
          {sub}
        </div>
      )}
    </div>
  );

  const kinds = KINDS.filter((k) => allowedTimings(k.id).includes(i.timing));
  const kindCell = mode === 'process' && (
    <select class={`${inp} py-1 text-xs @[67rem]:w-full`} aria-label="Art" value={i.kind}
      onChange={(e) => changeKind(e.currentTarget.value as IngredientKind)}>
      {kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
    </select>
  );

  const dryDay = (
    <OptNum unit=". Tag" value={i.dryHopDay} placeholder="–" step={1} class="w-24 @[67rem]:w-[5.25rem] shrink-0"
      onChange={(n) => patch({ dryHopDay: n })} />
  );
  const dryDays = (
    <OptNum unit="Tage" value={i.dryHopDays} placeholder="–" step={1} class={fill} onChange={(n) => patch({ dryHopDays: n })} />
  );
  const boilTime = (
    <NumInput unit="min" value={i.timeMin ?? boilMin} class={fill} onChange={(n) => patch({ timeMin: n })} />
  );

  const moment = mode === 'kind' && (
    <div class="flex min-w-0 items-center gap-1.5">
      <select class={`${inp} min-w-0 @[67rem]:flex-1`} aria-label="Zeitpunkt" value={i.timing}
        onChange={(e) => {
          const timing = e.currentTarget.value as Ingredient['timing'];
          patch({ timing, timeMin: undefined, ...(isDryHop({ kind: i.kind, timing }) ? {} : { dryHopDay: undefined, dryHopDays: undefined }) });
        }}>
        {allowedTimings(i.kind, scope).map((t) => <option key={t} value={t}>{TIMING_LABEL[t]}</option>)}
      </select>
      {isDryHop(i) && dryDay}
    </div>
  );

  const amount = (
    <NumInput unit={unitOfEntry(i.kind, c)} value={i.amount} class={fill} onChange={(n) => patch({ amount: n })} />
  );

  const del = (
    <button type="button" title="Entfernen" aria-label={`${i.name || 'Zutat'} entfernen`} onClick={remove}
      class="justify-self-end rounded-md px-2 py-1.5 text-muted hover:bg-fg/10 hover:text-critical">
      <Trash2 size={14} />
    </button>
  );

  let cells: ComponentChildren;
  if (layout === 'v') {
    const f = c?.kind === 'fermentable' ? c : undefined;
    const type = f && (f.type === 'malt' ? optionLabel(f, 'role') : optionLabel(f, 'type'));
    cells = (
      <>
        {type ? <span class={`${muted} justify-self-start`}>{type}</span> : blank}
        {f ? (
          <span class={`${r} flex items-center justify-end gap-1.5`}>
            <span class="inline-block h-3.5 w-3.5 shrink-0 rounded-[3px] border border-black/15" style={{ background: ebcSwatch(rangeValue(f.colorEbc)) }} />
            {num(rangeValue(f.colorEbc), 0)}<span class={wrapOnly}> EBC</span>
          </span>
        ) : blank}
        {f ? <span class={r}><span class={wrapOnly}>Extrakt </span>{num(rangeValue(f.extractDryPct), 0)} %</span> : blank}
        {blank}
        {moment}
        {amount}
        {value(fig?.sharePct, '%')}
        {value(fig?.plato, '°P')}
        {value(fig?.ebc, 'EBC')}
      </>
    );
  } else if (layout === 'h') {
    const h = c?.kind === 'hop' ? c : undefined;
    const duration = i.timing === 'boil' ? boilTime
      : isDryHop(i) ? (mode === 'kind' ? dryDays : <div class="flex flex-col gap-1.5">{dryDay}{dryDays}</div>)
      : blank;
    cells = (
      <>
        <HopFormSelect i={i} lotForm={lotFormOf(i, entries)} onChange={(form) => patch({ form })} />
        {h ? <span class={r}>{num(rangeValue(h.alphaPct))} %</span> : blank}
        {h ? <span class={r}>{num(rangeValue(h.oilMlPer100g))} ml/100 g</span> : blank}
        {blank}
        {moment}
        {amount}
        {duration}
        {value(fig?.oilMl, 'ml Öl', 2)}
        {value(fig?.ibu, 'IBU', 0)}
      </>
    );
  } else {
    const label = c && (c.kind === 'culture' ? optionLabel(c, 'form') : optionLabel(c, 'category'));
    const props = c?.kind === 'culture' ? [
      'attenuationPct' in c && c.attenuationPct ? `EVG ${range(c.attenuationPct, '%')}` : undefined,
      range(c.tempRangeC, '°C'),
      'flocculation' in c && c.flocculation ? `Flockung ${(Array.isArray(c.flocculation) ? c.flocculation : [c.flocculation])
        .filter((x, n, a) => a.indexOf(x) === n).map((x) => LEVEL[x]).join('–')}` : undefined,
    ].filter(Boolean).join(' · ') : '';
    // In the process tables the duration sits in the narrow column, like a hop's.
    const durationBox = mode === 'kind' ? 'w-28' : 'w-28 @[67rem]:w-full';
    const details = (
      <div class={`flex flex-wrap items-center gap-1.5 ${mode === 'kind' ? '@[67rem]:col-span-3' : '@[67rem]:justify-end'}`}>
        {i.timing === 'boil' && <div class={durationBox} title="vor Kochende">{boilTime}</div>}
        {isDryHop(i) && (mode === 'kind' ? <div class="w-28">{dryDays}</div> : <>{dryDay}<div class={durationBox}>{dryDays}</div></>)}
        <Strength i={i} agent={agentOf(i, entries)} onChange={(strengthPct) => patch({ strengthPct })} />
      </div>
    );
    cells = (
      <>
        {label ? <span class={`${muted} justify-self-start`}>{label[0].toUpperCase() + label.slice(1)}</span> : blank}
        {props ? <span class="text-xs text-muted">{props}</span> : blank}
        {moment}
        {amount}
        {details}
        {mode !== 'kind' && <>{blank}{blank}</>}
      </>
    );
  }

  return (
    <div class={rowClass(mode, layout)}>
      {name}
      {kindCell}
      {cells}
      {del}
    </div>
  );
}

// Form of a hop addition; empty = the stock lot's, else T90 (fermentation.ts).
function HopFormSelect({ i, lotForm, onChange }: { i: Ingredient; lotForm?: HopForm; onChange: (f: HopForm | undefined) => void }) {
  const label = (f: HopForm) => HOP_FORMS.find((x) => x.value === f)!.label;
  return (
    <select class={`${inp} @[67rem]:w-full`} value={i.form ?? ''} aria-label="Form"
      title={`Form, für die Würzeaufnahme; ohne Auswahl ${lotForm ? 'die des Lagerpostens' : 'T90 (Vorgabe)'}`}
      onChange={(e) => onChange((e.currentTarget.value || undefined) as HopForm | undefined)}>
      <option value="">{lotForm ? `${label(lotForm)} · Lager` : label('t90')}</option>
      {HOP_FORMS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
    </select>
  );
}

// Concentration of an acid or solution; the catalog gives the default.
export function Strength({ i, agent, onChange }: {
  i: Ingredient; agent: ReturnType<typeof agentOf>; onChange: (pct: number | undefined) => void;
}) {
  if (agent?.agent.form !== 'liquid') return null;
  return (
    <div class="flex items-center gap-1 text-xs text-muted" title={`Konzentration, Vorgabe ${agent.entry.acidStrengthPct ?? 100} %`}>
      <NumInput unit="%" value={i.strengthPct ?? agent.strengthPct}
        onChange={(n) => onChange(n === agent.entry.acidStrengthPct ? undefined : n)} />
    </div>
  );
}

// Editing the shared ingredient list; an edit drops the water automation's mark.
function useRows(all: Ingredient[], onChange: (next: Ingredient[]) => void, scope?: Scope) {
  return {
    patch: (id: string, p: Partial<Ingredient>) => onChange(all.map((i) => (i.id === id ? { ...i, ...p, auto: undefined } : i))),
    remove: (id: string) => onChange(all.filter((x) => x.id !== id)),
    // Without a kind: the first one allowed at the given moment.
    add: (init: Partial<Ingredient>) => {
      const k = init.kind ?? KINDS.find((x) => !init.timing || allowedTimings(x.id).includes(init.timing))!.id;
      onChange([...all, { id: uid(), kind: k, name: '', amount: 0, timing: defaultTiming(k, scope), ...init }]);
    },
  };
}

const HOP_ORDER = allowedTimings('hop');

// Tab "Zutaten": the rows of one kind under its own heading, with the moment as
// a column; hops in process order. Below fermentables and hops their sums.
export function KindTable({ kind, all, onChange, figures, boilMin, mark }: {
  kind: IngredientKind;
  all: Ingredient[];
  onChange: (next: Ingredient[]) => void;
  figures: IngredientFigures;
  boilMin: number; // the recipe's boil duration, the default of a boil addition's minutes
  mark?: (i: Ingredient) => string | undefined;
}) {
  const entries = useCatalog()?.entries ?? null;
  const ed = useRows(all, onChange);
  const label = KINDS.find((k) => k.id === kind)!.label;
  const rows = all.filter((i) => i.kind === kind);
  if (kind === 'hop') rows.sort((a, b) => HOP_ORDER.indexOf(a.timing) - HOP_ORDER.indexOf(b.timing));
  const layout = layoutOf(kind);

  return (
    <Section title={label} sub={SUB[kind]}
      action={
        <button type="button" onClick={() => ed.add({ kind })} class={addBtn}>
          <Plus size={12} /> Hinzufügen
        </button>
      }>
      <div class="@container text-sm">
        {rows.length === 0 ? (
          <p class="px-4 py-4 text-muted">{EMPTY[kind]}</p>
        ) : (
          <>
            <div class={`${rowClass('kind', layout)} hidden text-xs font-semibold text-muted @[67rem]:grid`}>
              <span>{nameLabel(kind)}</span>
              <HeadCells kind={kind} mode="kind" />
              <span />
            </div>
            {rows.map((i) => (
              <IngredientRow key={i.id} i={i} mode="kind" fig={figures.rows.get(i.id)} entries={entries} boilMin={boilMin}
                mark={mark?.(i)} patch={(p) => ed.patch(i.id, p)} remove={() => ed.remove(i.id)} />
            ))}
            {kind === 'fermentable' && <GristSums rows={rows} figures={figures} entries={entries} />}
            {kind === 'hop' && <HopSums figures={figures} />}
          </>
        )}
      </div>
    </Section>
  );
}

const sumRow = `${rowClass('kind', 'v')} hidden font-semibold tabular-nums @[67rem]:grid`;
const sumText = 'px-4 py-2 text-sm font-semibold tabular-nums @[67rem]:hidden';

function GristSums({ rows, figures: f, entries }: { rows: Ingredient[]; figures: IngredientFigures; entries: CatalogIngredient[] | null }) {
  const wort = rows.filter((i) => f.rows.get(i.id)?.sharePct !== undefined && i.amount > 0);
  const shareSum = wort.reduce((s, i) => s + f.rows.get(i.id)!.sharePct!, 0);
  const ebcOf = (i: Ingredient) => {
    const c = entryOf(i, entries);
    return c?.kind === 'fermentable' ? rangeValue(c.colorEbc) : undefined;
  };
  const og = f.ogPlato === undefined ? '—' : num(f.ogPlato);
  const ebc = f.ebc === undefined ? '—' : num(f.ebc, 0);
  return (
    <>
      <div class={sumRow}>
        <span /><span /><span /><span /><span /><span />
        <span class="text-right">{num(f.wortKg, 2)} kg</span>
        <span class="text-right text-xs font-normal text-muted">Stammwürze</span>
        <span class="text-right">{og}</span>
        <span class="text-right">{ebc}</span>
        <span class="text-xs font-normal text-muted">EBC</span>
      </div>
      <p class={sumText}>{num(f.wortKg, 2)} kg · Stammwürze {og} °P · {ebc} EBC</p>
      {wort.length > 0 && (
        <div class="space-y-2 px-4 pb-3.5 pt-1">
          <div class="flex h-2.5 overflow-hidden rounded-full bg-fg/10" aria-label="Anteile der Schüttung">
            {wort.map((i) => {
              const e = ebcOf(i);
              return <div key={i.id} style={{ width: `${f.rows.get(i.id)!.sharePct}%`, background: e === undefined ? 'var(--color-faint)' : ebcSwatch(e) }} />;
            })}
          </div>
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted">
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              {wort.map((i) => <span key={i.id}>{i.name || 'Ohne Namen'} {num(f.rows.get(i.id)!.sharePct!)} %</span>)}
            </div>
            <span class="tabular-nums">Summe {num(shareSum)} %</span>
          </div>
        </div>
      )}
    </>
  );
}

function HopSums({ figures: f }: { figures: IngredientFigures }) {
  const oil = [...f.rows.values()].reduce((s, x) => s + (x.oilMl ?? 0), 0);
  const cold = f.coldGPerL === undefined ? undefined : `kalt ${num(f.coldGPerL)} g/l`;
  const ibu = f.ibu === undefined ? '—' : num(f.ibu, 0);
  return (
    <>
      <div class={`${rowClass('kind', 'h')} hidden font-semibold tabular-nums @[67rem]:grid`}>
        <span /><span /><span /><span /><span /><span />
        <span class="text-right">{num(f.hopG, 0)} g</span>
        <span class="text-xs font-normal text-muted">{cold}</span>
        <span class="text-right">{oil > 0 ? num(oil, 2) : ''}</span>
        <span class="text-right">{ibu}</span>
        <span class="text-xs font-normal text-muted">IBU</span>
      </div>
      <p class={sumText}>{num(f.hopG, 0)} g{cold && ` · ${cold}`} · {ibu} IBU</p>
    </>
  );
}

// A process step in a process tab's table.
export interface IngredientGroup {
  id: string;
  title: string;
  note?: string;
  match: (i: Ingredient) => boolean;
  add?: Partial<Ingredient>;  // "+ Zutat" in the step's head row adds this; unset = no button
  empty?: string;             // shown without rows; unset = the step is left out when empty
  // Blocks of the step with a head row of their own (the charges); the rows
  // in none of them follow.
  sections?: { id: string; head: ComponentChildren; match: (i: Ingredient) => boolean }[];
}

// The process tabs' table: one head row per step, which carries the column
// heads of its first row's kind.
export function ProcessTable({ title, info, action, all, onChange, figures, boilMin, scope, mode, groups }: {
  title: string;
  info?: ComponentChildren;    // next to the heading
  action?: ComponentChildren;  // right of the heading
  all: Ingredient[];
  onChange: (next: Ingredient[]) => void;
  figures: IngredientFigures;
  boilMin: number;
  scope: Scope;
  mode: 'process' | 'mash';
  groups: IngredientGroup[];
}) {
  const entries = useCatalog()?.entries ?? null;
  const ed = useRows(all, onChange, scope);
  const row = (i: Ingredient) => (
    <IngredientRow key={i.id} i={i} mode={mode} scope={scope} fig={figures.rows.get(i.id)} entries={entries} boilMin={boilMin}
      patch={(p) => ed.patch(i.id, p)} remove={() => ed.remove(i.id)} />
  );
  return (
    <Section title={title} sub={info} action={action}>
      <div class="@container text-sm">
        {groups.map((g) => {
          const rows = all.filter(g.match);
          if (rows.length === 0 && g.empty === undefined) return null;
          const first = rows[0]?.kind ?? g.add?.kind ?? 'auxiliary';
          const inSection = (i: Ingredient) => g.sections?.some((s) => s.match(i));
          return (
            <div key={g.id}>
              <div class={`${rowClass(mode, layoutOf(first))} ${headRow}`}>
                <span class={`flex flex-wrap items-baseline gap-x-2 ${mode === 'process' ? '@[67rem]:col-span-2' : ''}`}>
                  <span class="text-sm text-fg">{g.title}</span>
                  {g.note && <span class="font-normal">{g.note}</span>}
                </span>
                {heads(first, mode).map(([t, right], n) => (
                  <span key={n} class={`${gridOnly} ${right ? 'text-right' : ''}`}>{rows.length > 0 ? t : ''}</span>
                ))}
                {g.add ? (
                  <button type="button" onClick={() => ed.add(g.add!)} class="ml-auto justify-self-end whitespace-nowrap px-1 text-xs font-medium text-accent hover:underline">
                    + Zutat
                  </button>
                ) : <span />}
              </div>
              {rows.length === 0 && <p class="border-b border-border px-4 py-2 text-muted last:border-b-0">{g.empty}</p>}
              {g.sections?.map((s) => (
                <div key={s.id}>
                  {s.head}
                  {rows.filter(s.match).map(row)}
                </div>
              ))}
              {rows.filter((i) => !inSection(i)).map(row)}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
