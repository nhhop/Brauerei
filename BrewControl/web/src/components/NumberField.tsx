import { inp } from '../ui';

// Labeled numeric input row — shared across all Rechner calculators, which
// each need several of these (avoids repeating the same markup 14x).
export function NumberField({ label, value, onChange, unit, step }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
}) {
  return (
    <label class="flex items-center justify-between gap-2 text-sm">
      <span class="text-muted">{label}</span>
      <span class="flex items-center gap-1.5">
        <input type="number" step={step ?? 'any'} class={`${inp} w-24`} value={value}
          onInput={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value);
            if (!Number.isNaN(v)) onChange(v);
          }} />
        {unit && <span class="text-xs text-muted">{unit}</span>}
      </span>
    </label>
  );
}
