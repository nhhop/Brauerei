// WinUI ProgressRing — indeterminate ring drawn in currentColor, so it picks up
// the text color of whatever button or row it sits in.

export function Spinner({ size = 16, class: cls = '' }: { size?: number; class?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      role="status" aria-label="Lädt" class={`inline-block shrink-0 animate-spin ${cls}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
  );
}
