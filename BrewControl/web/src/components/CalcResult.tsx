// Prominent result readout — shared shape across all 14 Rechner calculators.
export function CalcResult({ label, value, unit, secondary }: {
  label: string;
  value: string;
  unit?: string;
  secondary?: string;
}) {
  return (
    <div class="rounded-md bg-fg/5 px-4 py-3">
      <div class="text-xs text-muted">{label}</div>
      <div class="text-2xl font-semibold text-fg">
        {value}
        {unit && <span class="ml-1 text-base font-normal text-muted">{unit}</span>}
      </div>
      {secondary && <div class="mt-0.5 text-xs text-muted">{secondary}</div>}
    </div>
  );
}
