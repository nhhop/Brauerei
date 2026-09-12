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
// No `w-full` here: it used to ride along on every call site, but `.w-full`
// is declared after `.w-20` etc. in the generated CSS and always won on
// specificity ties, so a fixed-width override never actually applied
// (PLAN.md). Callers that want full width add `w-full` themselves.
export const inp =
  'rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-fg ' +
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
export const badgeAccent =
  `${badge} text-accent bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]`;

// Toast — WinUI notification card. The severity hue rides on a left stroke so
// the surface stays neutral and legible in both themes; pair with a badge*
// class for the icon. Fixed width keeps a stack of them aligned.
export const toastFrame =
  'flex w-80 max-w-[calc(100vw-2rem)] items-start gap-2.5 rounded-lg border border-card-border ' +
  'border-l-4 bg-surface p-3 text-left shadow-elev-64';

// Slide-in panel (WinUI flyout) — full height on the right, full width on
// mobile. Pairs with a `fixed inset-0 z-40 bg-black/40` scrim.
export const panelFrame =
  'fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-surface shadow-elev-64 ' +
  'pt-[var(--safe-t)] pb-[var(--safe-b)] pr-[var(--safe-r)]';

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
