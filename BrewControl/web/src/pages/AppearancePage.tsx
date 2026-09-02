// BrewControl/web/src/pages/AppearancePage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { ThemeSettings } from '../types';
import { getSettings, updateSettings } from '../api';
import { applyTheme } from '../theme';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { Segmented } from '../components/Segmented';
import { Contrast, Palette, PaintBucket } from 'lucide-preact';

const ACCENT_PRESETS: { label: string; value: string }[] = [
  { label: 'Windows-Blau', value: '#0078d4' },
  { label: 'Bernstein',    value: '#d97706' },
  { label: 'Kupfer',       value: '#c2703d' },
  { label: 'Grün',         value: '#22c55e' },
  { label: 'Rot',          value: '#ef4444' },
  { label: 'Violett',      value: '#8b5cf6' },
];

export function AppearancePage(_: { path?: string }) {
  const [settings, setSettings] = useState<ThemeSettings>({
    mode: 'system',
    accent: '#0078d4',
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

  const header = (
    <header class="mb-6">
      <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Darstellung' }]} />
    </header>
  );

  if (loading) return <PageShell>{header}<SkeletonList count={3} /></PageShell>;

  return (
    <PageShell>
      {header}

      <SettingsGroup>
        <SettingsCard title="Modus" icon={Contrast} desc="Hell, dunkel oder dem System folgen"
          control={
            <Segmented value={settings.mode}
              options={[{ value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }, { value: 'system', label: 'System' }]}
              onChange={(m) => update({ mode: m })} />
          } />

        <SettingsCard title="Akzentfarbe" icon={Palette} desc="Steuerfarbe für Buttons, Schalter und Auswahl"
          control={
            <div class="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((p) => (
                <button key={p.value} type="button" title={p.label}
                  onClick={() => update({ accent: p.value })}
                  class="h-6 w-6 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: p.value,
                    boxShadow: settings.accent === p.value
                      ? `0 0 0 2px var(--surface), 0 0 0 4px ${p.value}` : 'none',
                  }} />
              ))}
              <input type="color" value={settings.accent}
                onInput={(e) => update({ accent: (e.target as HTMLInputElement).value })}
                class="h-6 w-6 cursor-pointer rounded border border-border" title="Eigene Farbe" />
            </div>
          } />

        <SettingsCard title="Hintergrund-Tönung" icon={PaintBucket} desc="Neutral oder leicht warm/kalt getönt"
          control={
            <Segmented value={settings.background}
              options={[{ value: 'neutral', label: 'Neutral' }, { value: 'warm', label: 'Warm' }, { value: 'cool', label: 'Kalt' }]}
              onChange={(b) => update({ background: b })} />
          } />
      </SettingsGroup>
    </PageShell>
  );
}
