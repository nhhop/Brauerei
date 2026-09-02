// Placeholder shapes for a page's first fetch. SkeletonCard mirrors the surface
// classes of SettingsCard so swapping in the real content doesn't shift layout.

export function SkeletonBar({ class: cls = '' }: { class?: string }) {
  return <div class={`h-3 animate-pulse rounded bg-fg/10 ${cls}`} />;
}

export function SkeletonCard() {
  return (
    <div class="rounded-md border border-card-border bg-card px-4 py-3 shadow-elev-2">
      <div class="flex items-center gap-x-4">
        <div class="h-5 w-5 shrink-0 animate-pulse rounded bg-fg/10" />
        <div class="min-w-0 flex-1 space-y-2.5">
          <SkeletonBar class="h-4 w-2/5" />
          <SkeletonBar class="w-3/5" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div class="space-y-1" role="status" aria-label="Lädt">
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
