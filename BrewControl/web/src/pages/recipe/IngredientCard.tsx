import { Plus, Trash2 } from 'lucide-preact';
import {
  KINDS, TIMING_LABEL, allowedTimings, defaultTiming, uid, unitOf,
  type Ingredient, type IngredientKind, type Scope,
} from '../../recipes';
import { inp } from '../../ui';
import { Card, NumInput } from './fields';

// One card over the recipe's shared ingredient list. `kind` pins the card to a
// single kind (Zutaten tab); `scope` pins it to a process phase (process tabs),
// where the kind becomes a column and the moment is limited to that phase.
export function IngredientCard({ title, all, onChange, kind, scope, match }: {
  title: string;
  all: Ingredient[];
  onChange: (next: Ingredient[]) => void;
  kind?: IngredientKind;
  scope?: Scope;
  match: (i: Ingredient) => boolean;
}) {
  const rows = all.filter(match);
  const kinds = KINDS.filter((k) => allowedTimings(k.id, scope).length > 0);

  function patch(id: string, p: Partial<Ingredient>) {
    onChange(all.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }

  function changeKind(i: Ingredient, k: IngredientKind) {
    const timings = allowedTimings(k, scope);
    patch(i.id, { kind: k, timing: timings.includes(i.timing) ? i.timing : timings[0] });
  }

  function add() {
    const k = kind ?? kinds[0].id;
    onChange([...all, { id: uid(), kind: k, name: '', amount: 0, timing: defaultTiming(k, scope) }]);
  }

  return (
    <Card title={title}
      action={
        <button type="button" onClick={add}
          class="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-fg/10">
          <Plus size={12} /> Zutat
        </button>
      }>
      {rows.length === 0 ? (
        <p class="text-sm text-muted">Noch keine Zutaten.</p>
      ) : (
        <div class="space-y-2">
          {rows.map((i) => (
            <div key={i.id} class="flex flex-wrap items-center gap-2">
              {!kind && (
                <select class={inp} value={i.kind}
                  onChange={(e) => changeKind(i, e.currentTarget.value as IngredientKind)}>
                  {kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                </select>
              )}
              <input class={`${inp} min-w-0 flex-1 basis-40`} placeholder="Name" value={i.name}
                onInput={(e) => patch(i.id, { name: e.currentTarget.value })} />
              <select class={inp} value={i.timing}
                onChange={(e) => patch(i.id, { timing: e.currentTarget.value as Ingredient['timing'] })}>
                {allowedTimings(i.kind, scope).map((t) => <option key={t} value={t}>{TIMING_LABEL[t]}</option>)}
              </select>
              <div class="flex items-center gap-1 text-xs text-muted">
                <NumInput value={i.amount} onChange={(n) => patch(i.id, { amount: n })} class="w-20" />
                {unitOf(i.kind)}
              </div>
              <button type="button" title="Entfernen"
                onClick={() => onChange(all.filter((x) => x.id !== i.id))}
                class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
