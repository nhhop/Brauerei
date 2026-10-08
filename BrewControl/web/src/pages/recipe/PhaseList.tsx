import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-preact';
import { uid, type Phase } from '../../recipes';
import { inp } from '../../ui';
import { Card, NumInput } from './fields';

// Ordered list of fermentation phases: name, temperature,
// duration. Order is the sequence, changed with the arrow buttons.
export function PhaseList({ title, addLabel, namePlaceholder, durationUnit, empty, items, onChange }: {
  title: string;
  addLabel: string;
  namePlaceholder: string;
  durationUnit: string;
  empty: string;
  items: Phase[];
  onChange: (next: Phase[]) => void;
}) {
  function patch(id: string, p: Partial<Phase>) {
    onChange(items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  function move(index: number, by: -1 | 1) {
    const next = [...items];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  }

  const iconBtn = 'rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10 disabled:opacity-30';

  return (
    <Card title={title}
      action={
        <button type="button"
          onClick={() => onChange([...items, { id: uid(), name: '', tempC: 65, duration: 30 }])}
          class="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-fg/10">
          <Plus size={12} /> {addLabel}
        </button>
      }>
      {items.length === 0 ? (
        <p class="text-sm text-muted">{empty}</p>
      ) : (
        <div class="space-y-2">
          {items.map((p, i) => (
            <div key={p.id} class="flex flex-wrap items-center gap-2">
              <span class="w-5 text-xs text-faint">{i + 1}</span>
              <input class={`${inp} min-w-0 flex-1 basis-40`} placeholder={namePlaceholder} value={p.name}
                onInput={(e) => patch(p.id, { name: e.currentTarget.value })} />
              <div class="flex items-center gap-1 text-xs text-muted">
                <NumInput value={p.tempC} onChange={(n) => patch(p.id, { tempC: n })} class="w-20" /> °C
              </div>
              <div class="flex items-center gap-1 text-xs text-muted">
                <NumInput value={p.duration} onChange={(n) => patch(p.id, { duration: n })} class="w-20" /> {durationUnit}
              </div>
              <button type="button" title="Nach oben" disabled={i === 0} onClick={() => move(i, -1)} class={iconBtn}>
                <ArrowUp size={14} />
              </button>
              <button type="button" title="Nach unten" disabled={i === items.length - 1} onClick={() => move(i, 1)} class={iconBtn}>
                <ArrowDown size={14} />
              </button>
              <button type="button" title="Entfernen" onClick={() => onChange(items.filter((x) => x.id !== p.id))}
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
