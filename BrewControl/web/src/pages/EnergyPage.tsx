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

export function EnergyPage({ snap }: { path?: string; snap: Snapshot | null }) {
  const [settings, setSettings] = useState<EnergySettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [pins, setPins] = useState<PinsInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [pin, setPin] = useState('');
  const [r1, setR1] = useState('100');
  const [r2, setR2] = useState('100');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    getSettings()
      .then((s) => { if (s.energy) setSettings(s.energy); setLoading(false); })
      .catch(() => setLoading(false));
    getPins()
      .then((p) => {
        setPins(p);
        if (p.battery) {
          setPin(String(p.battery.gpio));
          setR1(String(p.battery.r1));
          setR2(String(p.battery.r2));
        }
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
    const k1 = parseFloat(r1);
    const k2 = parseFloat(r2);
    if (isNaN(p) || p < 0) { setErr('Pin ungültig'); return; }
    if (isNaN(k1) || k1 < 0 || isNaN(k2) || k2 <= 0) { setErr('Widerstände ungültig (R1 ≥ 0, R2 > 0)'); return; }
    const id = freeBatteryId((snap?.sensors ?? []).map((s) => s.id));
    setBusy(true);
    setErr('');
    try {
      await createSensor({ type: 'Voltage', id, pin: p, r1: k1, r2: k2, smoothing: 16 });
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
              desc="Legt einen Spannungssensor für die Batterie an und wählt ihn aus"
              onClick={() => { setCreating(true); setErr(''); }} />
          ) : (
            <SettingsCard title="Batteriesensor anlegen" icon={Plus}
              desc={pins?.battery
                ? 'Vorbelegt mit dem Batterie-Messeingang dieses Boards'
                : 'Batterie – R1 – ADC-Pin – R2 – GND'}>
              <div class="space-y-3">
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="mb-1 block text-xs text-muted">ADC-Pin</label>
                    <input type="number" value={pin} class={inp}
                      onInput={(e) => setPin((e.target as HTMLInputElement).value)} />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-muted">R1 (kΩ)</label>
                    <input type="number" step="any" min="0" value={r1} class={inp}
                      onInput={(e) => setR1((e.target as HTMLInputElement).value)} />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-muted">R2 (kΩ)</label>
                    <input type="number" step="any" min="0" value={r2} class={inp}
                      onInput={(e) => setR2((e.target as HTMLInputElement).value)} />
                  </div>
                </div>
                {/* The board's own battery input is marked risky for other items; here it is the point. */}
                {pin !== String(pins?.battery?.gpio) && (
                  <PinHint pins={pins} value={pin} analog configKey="pin" onPick={(g) => setPin(String(g))} />
                )}
                <p class="text-xs text-muted">
                  Legt einen Sensor vom Typ „Spannung“ an. Die Firmware nutzt die ab Werk
                  hinterlegte ADC-Kalibrierung; einen Feinabgleich mit dem Multimeter gibt es
                  danach unter Geräte über „Kalibrieren“.
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
