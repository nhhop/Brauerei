// Shared Fluent-style button classes for dialog footers — reused across
// ConfirmModal, AddItemModal and the *EditorModal components. Each carries the
// WinUI rest → hover → pressed (active:) states plus a focus-visible stroke.
export const btnPrimary =
  'rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition-colors ' +
  'hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';
export const btnSecondary =
  'rounded-md bg-fg/5 px-3 py-1.5 text-sm font-medium text-fg transition-colors ' +
  'hover:bg-fg/10 active:bg-fg/15 disabled:opacity-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg';
export const btnDanger =
  'rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors ' +
  'hover:bg-red-700 active:bg-red-800 disabled:opacity-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-bg';
export const linkDanger =
  'text-sm text-critical transition-colors hover:text-critical/80';

// WinUI TextBox — accent underline on focus via inset box-shadow (no layout shift).
export const inp =
  'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-fg ' +
  'shadow-[inset_0_-1px_0_0_var(--color-border)] focus:outline-none ' +
  'focus:shadow-[inset_0_-2px_0_0_var(--color-accent)]';

// Status badges — WinUI InfoBadge style: tinted fill (semantic hue mixed over the
// card surface, so it adapts to light/dark) + matching legible text/icon color.
export const badge =
  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium';
export const badgeCaution =
  `${badge} text-caution bg-[color-mix(in_srgb,var(--caution)_16%,transparent)]`;
export const badgeSuccess =
  `${badge} text-success bg-[color-mix(in_srgb,var(--success)_16%,transparent)]`;
export const badgeCritical =
  `${badge} text-critical bg-[color-mix(in_srgb,var(--critical)_16%,transparent)]`;

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
