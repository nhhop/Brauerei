import type { ComponentChildren } from 'preact';

// Page container for every routed settings page — Windows-11-Settings style: a
// padded viewport fill with a centered, width-capped content column so cards
// stay readable on wide screens. `wide` opts out of the cap for the chart pages,
// where the extra room is worth more than the line length.

export function PageShell({ wide, children }: { wide?: boolean; children: ComponentChildren }) {
  return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      <div class={wide ? '' : 'mx-auto max-w-4xl'}>{children}</div>
    </div>
  );
}
