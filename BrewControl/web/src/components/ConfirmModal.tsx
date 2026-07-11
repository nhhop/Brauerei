import type { ComponentChildren } from 'preact';
import { btnPrimary, btnSecondary, btnDanger, dialogFrame, dialogFooter, dialogBtnRow } from '../ui';

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
      <div class={`w-full max-w-md ${dialogFrame}`}
        onClick={(e) => e.stopPropagation()}>
        <div class="p-5">
          <h2 class="text-base font-medium text-fg">{title}</h2>
          <div class="mt-2 text-sm text-muted">{children}</div>
        </div>
        <div class={dialogFooter}>
          <div class={`w-full ${dialogBtnRow}`}>
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
    </div>
  );
}
