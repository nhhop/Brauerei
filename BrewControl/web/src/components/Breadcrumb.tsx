import { ChevronRight } from 'lucide-preact';

export interface Crumb {
  label: string;
  href?: string;
}

// Rendered in title size, like the Windows 11 Settings breadcrumb — the
// breadcrumb IS the page title; parent crumbs are muted links.
export function Breadcrumb({ trail }: { trail: Crumb[] }) {
  return (
    <nav class="flex flex-wrap items-center gap-1.5 text-2xl tracking-tight">
      {trail.map((c, i) => (
        <span key={i} class="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={20} class="shrink-0 text-faint" />}
          {c.href
            ? <a href={c.href} class="text-muted hover:text-fg">{c.label}</a>
            : <span class="font-semibold text-fg">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}
