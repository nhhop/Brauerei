export function ProgressBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div class="text-xs text-muted">{label} {pct}%</div>
      <div class="mt-1 h-2 rounded bg-fg/10">
        <div class="h-2 rounded bg-fg" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
