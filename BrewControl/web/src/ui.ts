// Shared Fluent-style button classes for dialog footers — reused across
// ConfirmModal, AddItemModal and the *EditorModal components.
export const btnPrimary =
  'rounded-md bg-fg px-3 py-1.5 text-sm font-medium text-bg hover:bg-fg/80 disabled:opacity-50';
export const btnSecondary =
  'rounded-md bg-fg/5 px-3 py-1.5 text-sm font-medium text-fg hover:bg-fg/10 disabled:opacity-50';
export const btnDanger =
  'rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50';
export const linkDanger =
  'text-sm text-red-500 hover:text-red-700';

// Dialog frame — ContentDialog-style corner radius + elevation.
export const dialogFrame = 'rounded-lg bg-surface shadow-elev-64';
