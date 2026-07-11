// WinUI-style ToggleSwitch — 40x20 track with a sliding knob; accent fill when on.
export function ToggleSwitch({ checked, onChange, disabled = false, title }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} title={title}
      disabled={disabled} onClick={() => onChange(!checked)}
      class={`relative h-5 w-10 shrink-0 rounded-full border transition-colors disabled:opacity-40 ${
        checked
          ? 'border-accent bg-accent'
          : 'border-fg/40 bg-transparent hover:bg-fg/5'
      }`}>
      <span class={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-[left] duration-150 ${
        checked ? 'left-[22px] bg-accent-fg' : 'left-[3px] bg-fg/60'
      }`} />
    </button>
  );
}
