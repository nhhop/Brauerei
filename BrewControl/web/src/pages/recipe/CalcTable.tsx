import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { ChevronRight } from 'lucide-preact';
import { fmtL } from '../../recipeWater';

// Outside heading over a flush card, like the canvas mockup: the card holds a
// padded summary and, below it, the table.
// `sub` stands next to the heading.
export function Section({ title, sub, action, children }: {
  title: string; sub?: ComponentChildren; action?: ComponentChildren; children: ComponentChildren;
}) {
  return (
    <section class="mb-4">
      <div class="mb-1.5 flex items-center justify-between gap-3 px-1">
        <div class="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
          {sub && <span class="text-xs text-muted">{sub}</span>}
        </div>
        {action}
      </div>
      <div class="overflow-hidden rounded-md border border-card-border bg-card shadow-elev-2">{children}</div>
    </section>
  );
}

const grid = 'grid grid-cols-[minmax(0,1fr)_7rem_4.5rem] items-center gap-x-3 border-b border-border px-4 py-1.5 sm:grid-cols-[minmax(0,1fr)_8rem_5rem_minmax(0,1.1fr)]';

// One line of the calculation: a stage (sum) or a loss with its default.
// `input` is the value that goes in, `basis` where it comes from.
export function Row({ op = '', label, input, l, basis, strong }: {
  op?: string; label: ComponentChildren; input?: ComponentChildren; l: number; basis?: ComponentChildren; strong?: boolean;
}) {
  return (
    <div class={`${grid} ${strong ? 'bg-fg/[0.03] font-semibold' : ''}`}>
      <span class={strong ? '' : 'pl-3.5'}>{op && <span class="inline-block w-4 text-muted">{op}</span>}{label}</span>
      <span class="text-right tabular-nums">{input ?? ''}</span>
      <span class="text-right tabular-nums">{fmtL(l)}</span>
      <span class="col-span-3 text-xs font-normal text-muted sm:col-span-1">{basis ?? ''}</span>
    </div>
  );
}

// Collapsed bar with the table below; `head` names the direction of the chain.
export function CalcTable({ head, note, children }: { head: string; note?: ComponentChildren; children: ComponentChildren }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
        class="flex w-full items-center gap-2.5 border-t border-border px-4 py-2.5 text-left text-sm font-semibold hover:bg-fg/5">
        <ChevronRight size={16} class={`transition-transform ${open ? 'rotate-90' : ''}`} />
        Berechnung
      </button>
      {open && (
        <div class="text-sm">
          <div class={`${grid} border-t py-2 text-xs font-semibold text-muted`}>
            <span>{head}</span><span class="text-right">Vorgabe</span>
            <span class="text-right">Volumen</span><span class="hidden sm:block">Grundlage</span>
          </div>
          {children}
          {note && <p class="px-4 py-2.5 text-xs text-muted">{note}</p>}
        </div>
      )}
    </>
  );
}
