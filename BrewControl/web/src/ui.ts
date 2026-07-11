// Shared Fluent-style button classes for dialog footers — reused across
// ConfirmModal, AddItemModal and the *EditorModal components.
export const btnPrimary =
  'rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-50';
export const btnSecondary =
  'rounded-md bg-fg/5 px-3 py-1.5 text-sm font-medium text-fg hover:bg-fg/10 disabled:opacity-50';
export const btnDanger =
  'rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50';
export const linkDanger =
  'text-sm text-red-500 hover:text-red-700';

// WinUI TextBox — accent underline on focus via inset box-shadow (no layout shift).
export const inp =
  'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-fg ' +
  'shadow-[inset_0_-1px_0_0_var(--color-border)] focus:outline-none ' +
  'focus:shadow-[inset_0_-2px_0_0_var(--color-accent)]';

// Dialog frame — ContentDialog-style corner radius + elevation. A flex column
// of content zone (scrolls when capped by max-h) + footer strip; padding lives
// in the zones so the footer spans the full width.
export const dialogFrame =
  'flex flex-col overflow-hidden rounded-lg bg-surface shadow-elev-64';
// Separated footer strip (ContentDialog command area) — sits below the scroll
// area, so it stays visible.
export const dialogFooter =
  'flex shrink-0 items-center justify-end gap-2 border-t border-border bg-bg/60 px-5 py-4';
// Equal-width button group inside the footer (WinUI stretch).
export const dialogBtnRow = 'grid grid-flow-col auto-cols-fr gap-2';
