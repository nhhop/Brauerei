// WinUI-style segmented control — a bordered pill group with one active segment
// (accent fill) and subtle hover/pressed on the inactive segments.
export function Segmented<T extends string>({ value, options, onChange, disabled = false }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div class="inline-flex overflow-hidden rounded-lg border border-border text-sm">
      {options.map((o) => (
        <button key={o.value} type="button" disabled={disabled}
          onClick={() => onChange(o.value)}
          class={`px-4 py-1.5 transition-colors disabled:opacity-50 ${
            value === o.value
              ? 'bg-accent text-accent-fg'
              : 'text-muted hover:bg-subtle-hover hover:text-fg active:bg-subtle-pressed'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
