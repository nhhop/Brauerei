import type { ComponentChildren } from 'preact';
import { unitBox, unitText } from '../ui';

// Frame of a number field with its unit inside (see `unitBox` in ui.ts). The
// input in it takes `unitInput` instead of `inp`.
export function UnitBox({ unit, class: cls = 'w-full', children }: {
  unit: string; class?: string; children: ComponentChildren;
}) {
  return (
    <span class={`${unitBox} ${cls}`}>
      {children}
      <span class={unitText}>{unit}</span>
    </span>
  );
}
