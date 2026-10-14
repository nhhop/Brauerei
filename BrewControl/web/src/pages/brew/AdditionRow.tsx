import { setAddedAt, type Brew } from '../../brews';
import type { Ingredient, Recipe } from '../../recipes';
import { AmountInput, num, rowAmountChange } from './amounts';
import type { Patch } from './PrepTab';

const clock = (at: number) => new Date(at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

// One addition to tick off with the time it went in (addedAt) and the amount
// used. A row shown in two tabs (dip hops) shares both.
export function AdditionRow({ brew, recipe, row, amount, unit, when, editable, patch }: {
  brew: Brew;
  recipe: Recipe;
  row: Ingredient;
  amount: number;   // the recipe's, or as used
  unit: string;
  when?: string;
  editable: boolean;
  patch: Patch;
}) {
  const at = brew.addedAt?.[row.id];
  const name = row.name || 'Ohne Namen';
  // The box is read at once: the save runs later, on a fresh copy of the brew.
  const added = (on: boolean) => {
    const t = on ? Date.now() : undefined;
    return patch((b) => setAddedAt(b, row.id, t));
  };
  return (
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2 last:border-b-0">
      <label class="flex min-w-[9rem] flex-1 items-center gap-2 text-sm">
        <input type="checkbox" checked={at !== undefined} disabled={!editable} aria-label={`${name} zugegeben`}
          onChange={(e) => added(e.currentTarget.checked)} />
        <span>
          {name}
          {when && <span class="ml-2 text-xs text-muted">{when}</span>}
        </span>
      </label>
      <span class="w-24 text-sm text-muted" title="Rezept">{num(amount)} {unit}</span>
      <AmountInput value={brew.rowAmounts?.[row.id]} placeholder={num(amount)} unit={unit} disabled={!editable}
        label={`${name} Ist`} onSave={(n) => patch(rowAmountChange(recipe, row.id, row.stockLotId, n))} />
      <span class="w-28 text-xs text-muted">{at !== undefined && `zugegeben ${clock(at)}`}</span>
    </div>
  );
}
