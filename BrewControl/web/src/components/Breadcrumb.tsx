import { ChevronRight } from 'lucide-preact';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ trail }: { trail: Crumb[] }) {
  return (
    <nav class="flex items-center gap-1.5 text-sm">
      {trail.map((c, i) => (
        <span key={i} class="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={14} class="shrink-0 text-faint" />}
          {c.href
            ? <a href={c.href} class="text-faint hover:text-fg">{c.label}</a>
            : <span class="font-medium text-fg">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}
