import { useState } from 'preact/hooks';
import { ChevronDown, ChevronRight } from 'lucide-preact';

export interface ChipItem { id: string; label: string; group?: string }

// Pill buttons to pick from: any number of them (multiple choice) or, with a
// single id in `selected`, one. With `groups` the pills sit under collapsible
// group headings that show how many are picked; a group with a pick starts open,
// plus the ones in `defaultOpen`. `tone` colours the picked pills (critical for
// off-flavours). A disabled fieldset around it disables the pills too.
export function ChipGroup({ items, groups, selected, onToggle, defaultOpen = [], tone = 'accent' }: {
  items: ChipItem[];
  groups?: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  defaultOpen?: string[];
  tone?: 'accent' | 'critical';
}) {
  const [open, setOpen] = useState<string[]>(() => [
    ...defaultOpen, ...(groups ?? []).filter((g) => items.some((i) => i.group === g.id && selected.includes(i.id))).map((g) => g.id),
  ]);
  const pills = (list: ChipItem[]) => (
    <div class="flex flex-wrap gap-1.5">
      {list.map((i) => (
        <Chip key={i.id} label={i.label} on={selected.includes(i.id)} tone={tone} onClick={() => onToggle(i.id)} />
      ))}
    </div>
  );
  if (!groups) return pills(items);
  return (
    <div class="space-y-1">
      {groups.map((g) => {
        const inGroup = items.filter((i) => i.group === g.id);
        const picked = inGroup.filter((i) => selected.includes(i.id)).length;
        const isOpen = open.includes(g.id);
        return (
          <div key={g.id}>
            <button type="button" aria-expanded={isOpen}
              class="flex w-full items-center gap-1 py-1 text-left text-xs text-muted transition-colors hover:text-fg"
              onClick={() => setOpen(isOpen ? open.filter((x) => x !== g.id) : [...open, g.id])}>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>{g.label}</span>
              {picked > 0 && <span class="rounded-full bg-accent px-1.5 text-accent-fg">{picked}</span>}
            </button>
            {isOpen && <div class="pb-1.5 pl-4">{pills(inGroup)}</div>}
          </div>
        );
      })}
    </div>
  );
}

const ON = {
  accent: 'border-accent bg-accent text-accent-fg',
  critical: 'border-critical bg-[color-mix(in_srgb,var(--critical)_16%,transparent)] text-critical',
};

function Chip({ label, on, tone, onClick }: { label: string; on: boolean; tone: 'accent' | 'critical'; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      class={`rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
        on ? ON[tone] : 'border-border text-muted hover:bg-subtle-hover hover:text-fg active:bg-subtle-pressed'
      }`}>
      {label}
    </button>
  );
}
