import type { ComponentChildren } from 'preact';

export function ConfirmModal({
  open, title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, pending = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; children: ComponentChildren;
  confirmLabel?: string; cancelLabel?: string; destructive?: boolean;
  pending?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  const confirmCls = destructive
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-fg hover:bg-fg/80 text-bg';
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => { if (!pending) onCancel(); }}>
      <div class="w-full max-w-md rounded-lg bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <h2 class="text-base font-medium text-fg">{title}</h2>
        <div class="mt-2 text-sm text-muted">{children}</div>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={pending}
            class="rounded-md bg-fg/5 px-3 py-1.5 text-sm font-medium text-fg hover:bg-fg/10 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={pending}
            class={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${confirmCls}`}>
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
