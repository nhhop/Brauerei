import type { ComponentChildren } from 'preact';
import { ChevronRight, type LucideIcon } from 'lucide-preact';

// Windows-11 "settings" building blocks. A SettingsGroup is an optional section
// label above a stack of SettingsCards; each card is a rounded surface row with
// a leading icon, title + description on the left, a control/chevron on the
// right, and optional full-width content below the header for complex controls.

export function SettingsGroup({ title, children }: { title?: string; children: ComponentChildren }) {
  return (
    <section class="space-y-1.5">
      {title && (
        <h2 class="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      )}
      <div class="space-y-1">{children}</div>
    </section>
  );
}

interface CardProps {
  icon?: LucideIcon;
  title?: string;
  desc?: string;
  href?: string;
  onClick?: () => void;
  control?: ComponentChildren;   // right-aligned control (toggle, dropdown, button…)
  chevron?: boolean;             // trailing chevron — defaults on when href/onClick set
  children?: ComponentChildren;  // full-width content rendered below the header row
}

export function SettingsCard({ icon: Icon, title, desc, href, onClick, control, chevron, children }: CardProps) {
  const interactive = Boolean(href || onClick);
  const showChevron = chevron ?? interactive;

  const header = (
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      {Icon && <Icon size={20} class="shrink-0 text-muted" />}
      {(title || desc) && (
        <div class="min-w-0 flex-1">
          {title && <div class="font-medium text-fg">{title}</div>}
          {desc && <div class="text-xs text-muted">{desc}</div>}
        </div>
      )}
      {control && <div class="shrink-0">{control}</div>}
      {showChevron && <ChevronRight size={16} class="shrink-0 text-faint" />}
    </div>
  );

  const body = (
    <>
      {header}
      {children && <div class={title || desc || control ? 'mt-3' : ''}>{children}</div>}
    </>
  );

  const base = 'block rounded-md border border-card-border bg-card px-4 py-3 text-left shadow-elev-2';
  if (href) return <a href={href} class={`${base} transition-colors hover:bg-subtle-hover active:bg-subtle-pressed`}>{body}</a>;
  if (onClick) return <button type="button" onClick={onClick} class={`${base} w-full transition-colors hover:bg-subtle-hover active:bg-subtle-pressed`}>{body}</button>;
  return <div class={base}>{body}</div>;
}
