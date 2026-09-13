import { Rows3, Rows4, Gauge as GaugeIcon, type LucideIcon } from 'lucide-preact';
import type { WidgetMode } from '../types';

const NEXT: Record<WidgetMode, WidgetMode> = { normal: 'gauge', gauge: 'compact', compact: 'normal' };
const LABEL: Record<WidgetMode, string> = { normal: 'Normal', gauge: 'Gauge', compact: 'Kompakt' };
const ICON: Record<WidgetMode, LucideIcon> = { normal: Rows3, gauge: GaugeIcon, compact: Rows4 };

// Cycles a card's display variant (normal -> gauge -> compact -> normal).
// Shows the *current* mode's icon; the tooltip names what clicking switches to.
export function CardModeButton({ mode, onCycle, class: cls }: { mode: WidgetMode; onCycle: () => void; class?: string }) {
  const Icon = ICON[mode];
  return (
    <button type="button" onClick={onCycle}
      title={`Ansicht: ${LABEL[mode]} (klicken für ${LABEL[NEXT[mode]]})`}
      class={cls ?? 'text-faint hover:text-fg'}>
      <Icon size={14} />
    </button>
  );
}
