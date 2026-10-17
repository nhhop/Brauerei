import { Plus, Trash2 } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import {
  HOP_FORMS, KINDS, TIMING_LABEL, allowedTimings, defaultTiming, isDryHop, uid,
  type HopForm, type Ingredient, type IngredientKind, type Scope,
} from '../../recipes';
import { unitOfEntry, useCatalog } from '../../ingredientSource';
import { entryOf, lotFormOf } from '../../stockLots';
import { agentOf } from '../../recipeTreatment';
import { inp } from '../../ui';
import { Card, NumInput, OptNum } from './fields';
import { IngredientPicker } from './IngredientPicker';

// A block of rows under its own header line (the charges of the mash); `init`
// is what a row added there starts with.
export interface IngredientGroup {
  id: string;
  header: ComponentChildren;
  match: (i: Ingredient) => boolean;
  init: Partial<Ingredient>;
  addLabel: string;
}

// One card over the recipe's shared ingredient list. `kind` pins the card to a
// single kind (Zutaten tab); `scope` pins it to a process phase (process tabs),
// where the kind becomes a column and the moment is limited to that phase.
// Rows in no group follow the groups; `mark` labels a row (its charge).
export function IngredientCard({ title, all, onChange, kind, scope, match, boilMin, groups, action, mark }: {
  title: string;
  all: Ingredient[];
  onChange: (next: Ingredient[]) => void;
  kind?: IngredientKind;
  scope?: Scope;
  match: (i: Ingredient) => boolean;
  boilMin: number; // the recipe's boil duration, shown as the default for the minutes of a boil addition
  groups?: IngredientGroup[];
  action?: ComponentChildren;  // next to "+ Zutat"
  mark?: (i: Ingredient) => string | undefined;
}) {
  const rows = all.filter(match);
  const catalog = useCatalog()?.entries ?? null;
  // An auxiliary measures in its catalog unit (acids in ml).
  const unitFor = (i: Ingredient) => unitOfEntry(i.kind, entryOf(i, catalog));
  const kinds = KINDS.filter((k) => allowedTimings(k.id, scope).length > 0);

  function patch(id: string, p: Partial<Ingredient>) {
    onChange(all.map((i) => (i.id === id ? { ...i, ...p, auto: undefined } : i)));
  }

  function changeKind(i: Ingredient, k: IngredientKind) {
    const timings = allowedTimings(k, scope);
    patch(i.id, {
      kind: k, ingredientId: undefined, stockLotId: undefined, timeMin: undefined, form: undefined, dryHopDay: undefined, dryHopDays: undefined,
      timing: timings.includes(i.timing) ? i.timing : timings[0],
    });
  }

  function add(init: Partial<Ingredient> = {}) {
    const k = init.kind ?? kind ?? kinds[0].id;
    onChange([...all, { id: uid(), kind: k, name: '', amount: 0, timing: defaultTiming(k, scope), ...init }]);
  }

  const addBtn = 'flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-fg/10';
  const grouped = groups ?? [];
  const ungrouped = rows.filter((i) => !grouped.some((g) => g.match(i)));

  const row = (i: Ingredient) => (
    <div key={i.id} class="flex flex-wrap items-center gap-2">
      {!kind && (
        <select class={inp} value={i.kind}
          onChange={(e) => changeKind(i, e.currentTarget.value as IngredientKind)}>
          {kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      )}
      <IngredientPicker ingredient={i} onChange={(p) => patch(i.id, p)} />
      {mark?.(i) && <span class="rounded bg-fg/10 px-1.5 py-0.5 text-xs text-muted">{mark(i)}</span>}
      <select class={inp} value={i.timing}
        onChange={(e) => {
          const timing = e.currentTarget.value as Ingredient['timing'];
          patch(i.id, { timing, timeMin: undefined, ...(isDryHop({ kind: i.kind, timing }) ? {} : { dryHopDay: undefined, dryHopDays: undefined }) });
        }}>
        {allowedTimings(i.kind, scope).map((t) => <option key={t} value={t}>{TIMING_LABEL[t]}</option>)}
      </select>
      {i.timing === 'boil' && (
        <div class="flex items-center gap-1 text-xs text-muted">
          <NumInput unit="min" value={i.timeMin ?? boilMin} onChange={(n) => patch(i.id, { timeMin: n })} />
          vor Kochende
        </div>
      )}
      {isDryHop(i) && (
        <div class="flex items-center gap-1 text-xs text-muted" title="Tag nach dem Anstellen, an dem gestopft wird, und wie lange">
          Tag <OptNum value={i.dryHopDay} placeholder="–" onChange={(n) => patch(i.id, { dryHopDay: n })} class="w-16" step={1} />
          für <OptNum unit="Tage" value={i.dryHopDays} placeholder="–" onChange={(n) => patch(i.id, { dryHopDays: n })} step={1} />
        </div>
      )}
      {i.kind === 'hop' && <HopFormSelect i={i} lotForm={lotFormOf(i, catalog)} onChange={(form) => patch(i.id, { form })} />}
      <div class="flex items-center gap-1 text-xs text-muted">
        <NumInput unit={unitFor(i)} value={i.amount} onChange={(n) => patch(i.id, { amount: n })} />
      </div>
      <Strength i={i} agent={agentOf(i, catalog)} onChange={(strengthPct) => patch(i.id, { strengthPct })} />
      <button type="button" title="Entfernen"
        onClick={() => onChange(all.filter((x) => x.id !== i.id))}
        class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <Card title={title}
      action={
        <div class="flex items-center gap-2">
          {action}
          <button type="button" onClick={() => add()} class={addBtn}>
            <Plus size={12} /> Zutat
          </button>
        </div>
      }>
      {rows.length === 0 && grouped.length === 0 ? (
        <p class="text-sm text-muted">Noch keine Zutaten.</p>
      ) : (
        <div class="space-y-2">
          {grouped.map((g) => (
            <div key={g.id} class="space-y-2">
              <div class="flex flex-wrap items-center gap-2 rounded-md bg-fg/5 px-2 py-1.5">
                {g.header}
                <button type="button" onClick={() => add(g.init)} class={`${addBtn} ml-auto`}>
                  <Plus size={12} /> {g.addLabel}
                </button>
              </div>
              {rows.filter(g.match).map(row)}
            </div>
          ))}
          {ungrouped.map(row)}
        </div>
      )}
    </Card>
  );
}

// Form of a hop addition; empty = the stock lot's, else T90 (fermentation.ts).
function HopFormSelect({ i, lotForm, onChange }: { i: Ingredient; lotForm?: HopForm; onChange: (f: HopForm | undefined) => void }) {
  const label = (f: HopForm) => HOP_FORMS.find((x) => x.value === f)!.label;
  return (
    <select class={inp} value={i.form ?? ''} title="Form, für die Würzeaufnahme"
      onChange={(e) => onChange((e.currentTarget.value || undefined) as HopForm | undefined)}>
      <option value="">{lotForm ? `${label(lotForm)} (Lager)` : `${label('t90')} (Vorgabe)`}</option>
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
