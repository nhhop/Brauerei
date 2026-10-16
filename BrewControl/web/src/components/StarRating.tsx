import { Star } from 'lucide-preact';

// One to five stars to pick; `onPick` gets the star that was pressed, the caller
// decides what pressing the picked one again does. A disabled fieldset around it
// disables the stars too.
export function StarRating({ value, onPick, max = 5 }: { value: number | undefined; onPick: (n: number) => void; max?: number }) {
  return (
    <div class="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" aria-pressed={value === n} aria-label={n === 1 ? '1 Stern' : `${n} Sterne`}
          class={`p-1 transition-colors disabled:opacity-50 ${value !== undefined && n <= value ? 'text-accent' : 'text-muted hover:text-fg'}`}
          onClick={() => onPick(n)}>
          <Star size={26} fill={value !== undefined && n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}
