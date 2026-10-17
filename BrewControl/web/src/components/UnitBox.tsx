import type { ComponentChildren } from 'preact';
import { unitBox, unitText } from '../ui';

const chev = 'h-2.5 w-2.5 fill-none stroke-current stroke-[2.5] [stroke-linecap:round] [stroke-linejoin:round]';
const arrow = 'flex h-4 w-4 items-center justify-center rounded-sm text-muted hover:bg-fg/10 hover:text-fg active:bg-fg/15';

// Frame of a number field with its unit inside (see `unitBox` in ui.ts). The
// input in it takes `unitInput` instead of `inp`. With `onStep` the up/down
// arrows sit at the left, shown on hover and focus (always on touch screens).
export function UnitBox({ unit, class: cls = 'w-full', onStep, children }: {
  unit: string; class?: string; onStep?: (dir: 1 | -1) => void; children: ComponentChildren;
}) {
  // mousedown would pull the focus off the input and close its keyboard.
  const keep = (e: Event) => e.preventDefault();
  return (
    <span class={`${unitBox} group ${cls}`}>
      {onStep && (
        <span class="-ml-1.5 flex shrink-0 flex-col opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
          <button type="button" tabIndex={-1} aria-label="Erhöhen" class={arrow} onMouseDown={keep} onClick={() => onStep(1)}>
            <svg viewBox="0 0 24 24" class={chev}><path d="m6 15 6-6 6 6" /></svg>
          </button>
          <button type="button" tabIndex={-1} aria-label="Verringern" class={arrow} onMouseDown={keep} onClick={() => onStep(-1)}>
            <svg viewBox="0 0 24 24" class={chev}><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </span>
      )}
      {children}
      <span class={unitText}>{unit}</span>
    </span>
  );
}
