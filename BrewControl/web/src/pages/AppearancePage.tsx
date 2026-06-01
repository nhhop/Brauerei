// BrewControl/web/src/pages/AppearancePage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { ThemeSettings } from '../types';
import { getSettings, updateSettings } from '../api';
import { applyTheme } from '../theme';

const ACCENT_PRESETS: { label: string; value: string }[] = [
  { label: 'Bernstein', value: '#d97706' },
  { label: 'Kupfer',    value: '#c2703d' },
  { label: 'Blau',      value: '#3b82f6' },
  { label: 'Grün',      value: '#22c55e' },
  { label: 'Rot',       value: '#ef4444' },
  { label: 'Violett',   value: '#8b5cf6' },
];

export function AppearancePage({ path }: { path?: string }) {
  const [settings, setSettings] = useState<ThemeSettings>({
    mode: 'system',
    accent: '#d97706',
    background: 'neutral',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then((s) => { setSettings(s.theme); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function update(partial: Partial<ThemeSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      applyTheme(next);
      updateSettings({ theme: next }).catch(() => {});
      return next;
    });
  }

  if (loading) return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <p class="text-sm text-muted">Laden…</p>
    </div>
  );

  return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <header class="mb-6 flex items-center gap-3">
        <a href="/settings" class="text-lg leading-none text-faint hover:text-fg">←</a>
        <h1 class="text-xl font-medium tracking-tight">Darstellung</h1>
      </header>

      <div class="space-y-5 rounded-lg border border-border bg-surface p-4">
        {/* Modus */}
        <div>
          <div class="mb-2 text-xs text-muted">Modus</div>
          <div class="inline-flex overflow-hidden rounded-lg border border-border text-sm">
            {(['light', 'dark', 'system'] as const).map((m) => (
              <button key={m} type="button"
                class={`px-4 py-1.5 transition-colors ${
                  settings.mode === m ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
                }`}
                onClick={() => update({ mode: m })}>
                {m === 'light' ? 'Hell' : m === 'dark' ? 'Dunkel' : 'System'}
              </button>
            ))}
          </div>
        </div>

        {/* Akzentfarbe */}
        <div>
          <div class="mb-2 text-xs text-muted">Akzentfarbe</div>
          <div class="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((p) => (
              <button key={p.value} type="button" title={p.label}
                onClick={() => update({ accent: p.value })}
                class="h-6 w-6 rounded-full transition-transform hover:scale-110"
                style={{
                  background: p.value,
                  boxShadow: settings.accent === p.value
                    ? `0 0 0 2px var(--bg), 0 0 0 4px ${p.value}` : 'none',
                }} />
            ))}
            <input type="color" value={settings.accent}
              onInput={(e) => update({ accent: (e.target as HTMLInputElement).value })}
              class="h-6 w-6 cursor-pointer rounded border border-border" title="Eigene Farbe" />
          </div>
        </div>

        {/* Hintergrund-Tönung */}
        <div>
          <div class="mb-2 text-xs text-muted">Hintergrund-Tönung</div>
          <div class="inline-flex overflow-hidden rounded-lg border border-border text-sm">
            {(['neutral', 'warm', 'cool'] as const).map((b) => (
              <button key={b} type="button"
                class={`px-4 py-1.5 transition-colors ${
                  settings.background === b ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
                }`}
                onClick={() => update({ background: b })}>
                {b === 'neutral' ? 'Neutral' : b === 'warm' ? 'Warm' : 'Kalt'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
