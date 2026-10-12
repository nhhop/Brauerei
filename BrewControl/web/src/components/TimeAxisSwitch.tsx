import { TIME_AXIS_LABELS, TIME_AXIS_MODES, type TimeAxisMode } from '../timeAxis';

// Small segmented control for a chart's time axis.
export function TimeAxisSwitch({ value, onChange }: {
  value: TimeAxisMode;
  onChange: (mode: TimeAxisMode) => void;
}) {
  return (
    <div class="inline-flex shrink-0 overflow-hidden rounded-md border border-border text-xs"
      title="Zeitachse: ältere Werte gestaucht darstellen">
      {TIME_AXIS_MODES.map((m) => (
        <button key={m} type="button" onClick={() => m !== value && onChange(m)}
          class={`px-2 py-0.5 ${m === value ? 'bg-fg/15 text-fg' : 'text-muted hover:bg-fg/10'}`}>
          {TIME_AXIS_LABELS[m]}
        </button>
      ))}
    </div>
  );
}
