import type { ComponentChildren } from 'preact';

// WinUI-style tab in an underlined tab strip. Used for the dashboard tabs and
// for the profile categories.
export function TabBtn({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: ComponentChildren;
}) {
  return (
    <div role="button" onClick={onClick}
      class={`flex shrink-0 cursor-pointer select-none items-center gap-0 whitespace-nowrap border-b-2 px-3 pb-2 pt-1.5 text-sm transition-colors
        ${active
          ? 'border-accent font-medium text-fg'
          : 'border-transparent text-muted hover:text-fg'}`}>
      {children}
    </div>
  );
}
