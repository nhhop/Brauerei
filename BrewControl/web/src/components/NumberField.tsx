import { inp, unitInput } from '../ui';
import { UnitBox } from './UnitBox';

// Labeled numeric input row — shared across all Rechner calculators, which
// each need several of these (avoids repeating the same markup 14x).
export function NumberField({ label, value, onChange, unit, step }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
}) {
  const input = (
    <input type="number" step={step ?? 'any'} class={unit ? unitInput : `${inp} w-24`} value={value}
      onInput={(e) => {
        const v = parseFloat((e.target as HTMLInputElement).value);
        if (!Number.isNaN(v)) onChange(v);
      }} />
  );
  return (
    <label class="flex items-center justify-between gap-2 text-sm">
      <span class="text-muted">{label}</span>
      {unit ? <UnitBox unit={unit} class="w-32">{input}</UnitBox> : input}
    </label>
  );
}
