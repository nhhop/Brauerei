// BrewControl/web/src/pages/EnergyPage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { EnergySettings, PinsInfo, Snapshot } from '../types';
import { getSettings, updateSettings, getPins, createSensor, setSensorLabel } from '../api';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { PinHint } from '../components/PinHint';
import { lipoPercent, freeBatteryId } from '../energy';
import { inp, btnSecondary } from '../ui';
import { BatteryMedium, Plus } from 'lucide-preact';

const DEFAULT: EnergySettings = { batterySensor: '' };

// ADC full scale the new sensor maps 0..4095 onto, before the divider. Only a
// starting point: the ESP32 ADC is neither linear nor exactly 3.3 V wide, a
// two-point calibration against a multimeter fixes both.
const ADC_FULL_SCALE_V = 3.3;

export function EnergyPage({ snap }: { path?: string; snap: Snapshot | null }) {
  const [settings, setSettings] = useState<EnergySettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [pins, setPins] = useState<PinsInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [pin, setPin] = useState('');
  const [divider, setDivider] = useState('2');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    getSettings()
      .then((s) => { if (s.energy) setSettings(s.energy); setLoading(false); })
      .catch(() => setLoading(false));
    getPins()
      .then((p) => {
        setPins(p);
        if (p.battery) { setPin(String(p.battery.gpio)); setDivider(String(p.battery.divider)); }
      })
      .catch(() => {});
  }, []);

  function update(partial: Partial<EnergySettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      updateSettings({ energy: next }).catch(() => {});
      return next;
    });
  }

  async function createBatterySensor() {
    const p = parseInt(pin, 10);
    const d = parseFloat(divider);
    if (isNaN(p) || p < 0) { setErr('Pin ungültig'); return; }
    if (isNaN(d) || d < 1) { setErr('Teiler muss mindestens 1 sein'); return; }
    const id = freeBatteryId((snap?.sensors ?? []).map((s) => s.id));
    setBusy(true);
    setErr('');
    try {
      await createSensor({
        type: 'AnalogInput', id, pin: p, unit: 'V',
        value_min: 0, value_max: Math.round(ADC_FULL_SCALE_V * d * 100) / 100, smoothing: 16,
      });
      await setSensorLabel(id, 'Batterie').catch(() => {});
      update({ batterySensor: id });
      setCreating(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <header class="mb-6">
      <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Energiemanagement' }]} />
    </header>
  );

  if (loading) return <PageShell>{header}<SkeletonList count={2} /></PageShell>;

  const sensors = snap?.sensors ?? [];
  // Voltage sensors only, plus whatever is selected so the choice stays visible.
  const candidates = sensors.filter((s) =>
    s.meta.unit === 'V' || s.meta.quantity === 'Voltage' || s.id === settings.batterySensor);
  const battery = sensors.find((s) => s.id === settings.batterySensor);
  const volts = battery?.state.ok && battery.state.v != null ? battery.state.v : null;

  let status: string;
  if (!settings.batterySensor) status = 'Keine Batteriemessung ausgewählt';
  else if (!snap) status = 'Lade …';
  else if (!battery) status = `Sensor „${settings.batterySensor}“ nicht gefunden`;
  else if (volts == null) status = 'Noch kein Messwert';
  else status = `${volts.toFixed(2)} V · ca. ${lipoPercent(volts)} % (LiPo, ohne Last)`;

  return (
    <PageShell>
      {header}

      <div class="space-y-6">
        <SettingsGroup title="Batterie">
          <SettingsCard title="Batteriespannung" icon={BatteryMedium} desc={status}
            control={
              <select value={settings.batterySensor} class={`${inp} w-44`}
                onChange={(e) => update({ batterySensor: (e.target as HTMLSelectElement).value })}>
                <option value="">Keine</option>
                {candidates.map((s) => (
                  <option key={s.id} value={s.id}>{s.label || s.id}</option>
                ))}
              </select>
            } />

          {!creating ? (
            <SettingsCard title="Batteriesensor anlegen" icon={Plus}
              desc="Legt einen Analogeingang für die Batteriespannung an und wählt ihn aus"
              onClick={() => { setCreating(true); setErr(''); }} />
          ) : (
            <SettingsCard title="Batteriesensor anlegen" icon={Plus}
              desc={pins?.battery
                ? 'Vorbelegt mit dem Batterie-Messeingang dieses Boards'
                : 'Pin des Spannungsteilers am ADC und sein Teilerverhältnis'}>
              <div class="space-y-3">
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="mb-1 block text-xs text-muted">ADC-Pin</label>
                    <input type="number" value={pin} class={inp}
                      onInput={(e) => setPin((e.target as HTMLInputElement).value)} />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-muted">Teiler (Batterie : ADC)</label>
                    <input type="number" step="any" min="1" value={divider} class={inp}
                      onInput={(e) => setDivider((e.target as HTMLInputElement).value)} />
                  </div>
                </div>
                {/* The board's own battery input is marked risky for other items; here it is the point. */}
                {pin !== String(pins?.battery?.gpio) && (
                  <PinHint pins={pins} value={pin} analog configKey="pin" onPick={(g) => setPin(String(g))} />
                )}
                <p class="text-xs text-muted">
                  Der ADC misst nicht genau linear. Für eine genaue Anzeige den Sensor danach unter
                  Geräte mit einem Multimeter per Zwei-Punkt-Kalibrierung abgleichen.
                </p>
                <div class="flex items-center gap-2">
                  <button type="button" class={btnSecondary} disabled={busy} onClick={createBatterySensor}>
                    {busy ? 'Lege an …' : 'Anlegen'}
                  </button>
                  <button type="button" class={btnSecondary} disabled={busy}
                    onClick={() => { setCreating(false); setErr(''); }}>
                    Abbrechen
                  </button>
                  {err && <span class="text-sm text-critical">{err}</span>}
                </div>
              </div>
            </SettingsCard>
          )}
        </SettingsGroup>
      </div>
    </PageShell>
  );
}
