import type { ComponentChildren } from 'preact';
import { btnPrimary, btnSecondary, btnDanger, dialogFrame } from '../ui';

export function ConfirmModal({
  open, title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, pending = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; children: ComponentChildren;
  confirmLabel?: string; cancelLabel?: string; destructive?: boolean;
  pending?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => { if (!pending) onCancel(); }}>
      <div class={`w-full max-w-md p-5 ${dialogFrame}`}
        onClick={(e) => e.stopPropagation()}>
        <h2 class="text-base font-medium text-fg">{title}</h2>
        <div class="mt-2 text-sm text-muted">{children}</div>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={pending} class={btnSecondary}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={pending}
            class={destructive ? btnDanger : btnPrimary}>
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
