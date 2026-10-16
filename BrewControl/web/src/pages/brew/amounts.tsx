import { useEffect, useState } from 'preact/hooks';
import { setRowAmount, type Brew } from '../../brews';
import { lotTarget, rebook, withBooking } from '../../brewStart';
import { reloadCatalog, saveStockLot } from '../../ingredientSource';
import type { Recipe } from '../../recipes';
import { unitBox, unitInput, unitText } from '../../ui';

export const num = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

// Sets the amount used of a recipe row. A lot taken at the start follows it;
// one left out there is not booked.
export const rowAmountChange = (recipe: Recipe, rowId: string, lotId: string | undefined, amount: number | undefined) =>
  async (b: Brew): Promise<Brew> => {
    const next = setRowAmount(b, rowId, amount);
    const booking = lotId ? b.booked?.find((x) => x.lotId === lotId) : undefined;
    if (!lotId || !booking) return next;
    const lot = (await reloadCatalog()).stock.find((l) => l.id === lotId);
    if (!lot) return next;
    const r = rebook(lot, booking.amount, lotTarget(recipe, next.rowAmounts, lotId));
    if (r.booked !== booking.amount) {
      await saveStockLot(r.lot);
      await reloadCatalog();
    }
    return { ...next, booked: withBooking(next.booked, lotId, r.booked) };
  };

// The amount used of a recipe row; empty = as in the recipe (the placeholder).
// The typed text stays local, so a live update of the page does not reset it.
export function AmountInput({ value, placeholder, unit, label, disabled, onSave }: {
  value: number | undefined; placeholder: string; unit: string; label: string; disabled: boolean;
  onSave: (n: number | undefined) => Promise<void>;
}) {
  const toText = (v: number | undefined) => (v === undefined ? '' : num(v));
  const [text, setText] = useState(toText(value));
  useEffect(() => setText(toText(value)), [value]);
  return (
    <span class={`${unitBox} w-28`}>
      <input type="text" inputMode="decimal" aria-label={label} class={unitInput} placeholder={placeholder}
        disabled={disabled} value={text}
        onInput={(e) => setText(e.currentTarget.value)}
        onChange={(e) => {
          const t = e.currentTarget.value.trim();
          const n = parseFloat(t.replace(',', '.'));
          if (t === '') { if (value !== undefined) void onSave(undefined); }
          else if (!Number.isNaN(n) && n >= 0 && n !== value) void onSave(n);
          else setText(toText(value));
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      <span class={unitText}>{unit}</span>
    </span>
  );
}
