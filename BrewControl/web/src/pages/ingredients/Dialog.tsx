import type { ComponentChildren } from 'preact';
import { dialogFooter, dialogFrame, dialogScrim, dialogSheet } from '../../ui';

// Scrollable sheet with a fixed footer, as the other form dialogs.
export function Dialog({ title, onClose, footer, children }: {
  title: string; onClose: () => void; footer: ComponentChildren; children: ComponentChildren;
}) {
  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-lg ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="mb-4 text-base font-medium text-fg">{title}</h2>
          {children}
        </div>
        <div class={dialogFooter}>{footer}</div>
      </div>
    </div>
  );
}
