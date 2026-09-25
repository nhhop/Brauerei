// BrewControl/web/src/pages/DisplayPage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { DisplaySettings } from '../types';
import { getSettings, updateSettings } from '../api';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { Slider } from '../components/Slider';
import { inp } from '../ui';
import { Sun, Moon, SunDim, PowerOff, Move } from 'lucide-preact';

const DIM_AFTER = [0, 30, 60, 120, 300, 600];
const DIM_PERCENT = [5, 10, 20, 30, 50];
const OFF_AFTER = [0, 300, 600, 900, 1800, 3600];

function formatSec(v: number): string {
  if (v === 0) return 'Nie';
  return v % 60 === 0 ? `${v / 60} min` : `${v} s`;
}

const formatPercent = (v: number) => `${v} %`;

const DEFAULT: DisplaySettings = {
  brightness: 63,
  dimAfterSec: 120,
  dimPercent: 20,
  offAfterSec: 600,
  pixelShift: false,
  supported: false,
};

// A preset list; a value set some other way (API) is shown as an extra entry
// until a preset is picked.
function ChoiceSelect({ value, choices, format, onChange }: {
  value: number;
  choices: number[];
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const known = choices.includes(value);
  return (
    <select
      value={known ? value : ''}
      onChange={(e) => {
        const v = (e.target as HTMLSelectElement).value;
        if (v !== '') onChange(Number(v));
      }}
      class={`${inp} w-32`}
    >
      {!known && <option value="">{format(value)}</option>}
      {choices.map((c) => (
        <option key={c} value={c}>{format(c)}</option>
      ))}
    </select>
  );
}

export function DisplayPage(_: { path?: string }) {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then((s) => { if (s.display) setSettings(s.display); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function update(partial: Partial<DisplaySettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      updateSettings({ display: next }).catch(() => {});
      return next;
    });
  }

  const header = (
    <header class="mb-6">
      <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Gerätedisplay' }]} />
    </header>
  );

  if (loading) return <PageShell>{header}<SkeletonList count={4} /></PageShell>;

  if (!settings.supported) {
    return (
      <PageShell>
        {header}
        <p class="px-1 text-sm text-muted">Dieses Gerät hat kein eigenes Display.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {header}

      <SettingsGroup title="Burn-in-Schutz">
        <SettingsCard title="Helligkeit" icon={Sun} desc="Helligkeit im normalen Betrieb"
          control={<span class="text-sm tabular-nums">{settings.brightness} %</span>}>
          <Slider min={10} max={100} step={1} value={settings.brightness} color="var(--accent)"
            onInput={(v) => setSettings((prev) => ({ ...prev, brightness: v }))}
            onChange={(v) => update({ brightness: v })} />
        </SettingsCard>

        <SettingsCard title="Dimmen nach" icon={Moon} desc="Zeit ohne Berührung, bis das Display dunkler wird"
          control={
            <ChoiceSelect value={settings.dimAfterSec} choices={DIM_AFTER} format={formatSec}
              onChange={(v) => update({ dimAfterSec: v })} />
          } />

        <SettingsCard title="Helligkeit gedimmt" icon={SunDim} desc="Anteil der eingestellten Helligkeit"
          control={
            <ChoiceSelect value={settings.dimPercent} choices={DIM_PERCENT} format={formatPercent}
              onChange={(v) => update({ dimPercent: v })} />
          } />

        <SettingsCard title="Ausschalten nach" icon={PowerOff} desc="Zeit ohne Berührung, bis das Display schwarz wird"
          control={
            <ChoiceSelect value={settings.offAfterSec} choices={OFF_AFTER} format={formatSec}
              onChange={(v) => update({ offAfterSec: v })} />
          } />

        <SettingsCard title="Pixel-Shift" icon={Move} desc="Verschiebt das Bild jede Minute um wenige Pixel"
          control={
            <ToggleSwitch checked={settings.pixelShift}
              onChange={(v) => update({ pixelShift: v })} />
          } />
      </SettingsGroup>

      <p class="mt-4 px-1 text-xs text-muted">
        Tippen weckt das Display; der erste Tipp löst nichts aus. Not-Aus und Meldungen wecken es ebenfalls.
      </p>
    </PageShell>
  );
}
