import type { DryHop } from '../../brewPrograms';
import { setChecked, type Brew } from '../../brews';
import type { Recipe } from '../../recipes';
import { AdditionRow } from './AdditionRow';
import { num } from './amounts';
import type { Patch } from './PrepTab';

const DAY_MS = 86400000;
const date = (ms: number) => new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

// "Tag 3 (18.10.) · 4 Tage": when it goes in, from the pitching once known.
function planned(h: DryHop, pitchedAt: number | undefined): string {
  if (h.day === undefined) return 'ohne Tag';
  const on = `Tag ${num(h.day)}${pitchedAt !== undefined ? ` (${date(pitchedAt + h.day * DAY_MS)})` : ''}`;
  return h.days === undefined ? on : `${on} · ${num(h.days)} ${h.days === 1 ? 'Tag' : 'Tage'}`;
}

const removedKey = (rowId: string) => `removed:${rowId}`;

// Dry hops to tick off: in (time, amount as used, rebooked like any addition)
// and out again ("entnommen", a key in `checked`).
export function DryHopList({ brew, recipe, title, hops, pitchedAt, editable, patch }: {
  brew: Brew;
  recipe: Recipe;
  title?: string;
  hops: DryHop[];
  pitchedAt: number | undefined;
  editable: boolean;
  patch: Patch;
}) {
  if (hops.length === 0) return null;
  return (
    <div class="mt-3">
      {title && <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>}
      {hops.map((h) => {
        const key = removedKey(h.row.id);
        return (
          <AdditionRow key={h.row.id} brew={brew} recipe={recipe} row={h.row} amount={h.amount} unit={h.unit}
            when={planned(h, pitchedAt)} editable={editable} patch={patch}
            extra={(
              <label class="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={brew.checked?.includes(key) ?? false} disabled={!editable}
                  aria-label={`${h.row.name || 'Ohne Namen'} entnommen`}
                  onChange={(e) => { const on = e.currentTarget.checked; return patch((b) => setChecked(b, key, on)); }} />
                entnommen
              </label>
            )} />
        );
      })}
    </div>
  );
}
