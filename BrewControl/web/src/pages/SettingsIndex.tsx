// BrewControl/web/src/pages/SettingsIndex.tsx
export function SettingsIndex(_: { path?: string }) {
  return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <header class="flex items-center gap-3">
        <a href="/" class="text-lg leading-none text-faint hover:text-fg">←</a>
        <h1 class="text-xl font-medium tracking-tight">Einstellungen</h1>
      </header>
      <div class="mt-6 space-y-2">
        <a href="/settings/appearance"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">Darstellung</div>
            <div class="text-xs text-muted">Modus, Akzentfarbe, Hintergrund</div>
          </div>
          <span class="text-faint">›</span>
        </a>
        <a href="/settings/devices"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">Geräte</div>
            <div class="text-xs text-muted">Sensoren, Regler, Aktoren verwalten</div>
          </div>
          <span class="text-faint">›</span>
        </a>
      </div>
    </div>
  );
}
