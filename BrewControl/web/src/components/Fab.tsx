import { useState } from 'preact/hooks';
import type { LucideIcon } from 'lucide-preact';
import { X } from 'lucide-preact';

// Mobile-only floating action button — repeats the page's primary header
// action within thumb reach at the bottom of the screen. Hidden from md: up,
// where the header button stays reachable as-is.
const fabBase =
  'flex items-center justify-center rounded-full bg-accent text-accent-fg shadow-elev-64 ' +
  'transition-colors hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

export function Fab({ icon: Icon, label, onClick, disabled }: {
  icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label}
      class={`${fabBase} fixed bottom-5 right-5 z-30 h-14 w-14 md:hidden`}>
      <Icon size={24} />
    </button>
  );
}

interface FabAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function SpeedDialFab({ icon: Icon, actions }: { icon: LucideIcon; actions: FabAction[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div class="md:hidden">
      {open && (
        <div class="fixed inset-0 z-20" onClick={() => setOpen(false)} />
      )}
      <div class="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3">
        {open && actions.map((a) => (
          <div key={a.label} class="flex items-center gap-2">
            <span class="rounded-md bg-surface px-2.5 py-1 text-sm text-fg shadow-elev-64">
              {a.label}
            </span>
            <button type="button" title={a.label} disabled={a.disabled}
              onClick={() => { setOpen(false); a.onClick(); }}
              class={`${fabBase} h-11 w-11`}>
              <a.icon size={20} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setOpen((o) => !o)}
          title={open ? 'Schließen' : 'Aktionen'}
          class={`${fabBase} h-14 w-14`}>
          {open ? <X size={24} /> : <Icon size={24} />}
        </button>
      </div>
    </div>
  );
}
