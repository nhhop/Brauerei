// BrewControl/web/src/pages/EnergyPage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { EnergySettings, PinsInfo, Snapshot } from '../types';
import { getSettings, updateSettings, getPins, createSensor, setSensorLabel } from '../api';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { PinHint } from '../components/PinHint';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { ConfirmModal } from '../components/ConfirmModal';
import { lipoPercent, freeBatteryId } from '../energy';
import { inp, btnPrimary, btnSecondary } from '../ui';
import { AlarmClock, BatteryMedium, Info, Moon, Plus, Timer, Wifi } from 'lucide-preact';

const DEFAULT: EnergySettings = {
  batterySensor: '', deepSleep: false, sleepIntervalSec: 300, wakePin: -1,
  wakeActiveLow: true, awakeTimeoutSec: 300, shortWakeWifi: true,
};

// The deep-sleep part of the settings, saved explicitly (it puts the device to sleep).
type SleepSettings = Pick<EnergySettings,
  'deepSleep' | 'sleepIntervalSec' | 'wakePin' | 'wakeActiveLow' | 'awakeTimeoutSec' | 'shortWakeWifi'>;

function sleepPart(e: EnergySettings): SleepSettings {
  const { deepSleep, sleepIntervalSec, wakePin, wakeActiveLow, awakeTimeoutSec, shortWakeWifi } = e;
  return { deepSleep, sleepIntervalSec, wakePin, wakeActiveLow, awakeTimeoutSec, shortWakeWifi };
}

const INTERVALS: [number, string][] = [
  [60, '1 min'], [300, '5 min'], [900, '15 min'], [1800, '30 min'], [3600, '1 h'],
  [21600, '6 h'], [43200, '12 h'], [86400, '24 h'],
];
const TIMEOUTS: [number, string][] = [
  [60, '1 min'], [120, '2 min'], [300, '5 min'], [600, '10 min'], [1800, '30 min'], [3600, '60 min'],
];

// A value set over the API that is not in the list still shows up.
function choices(list: [number, string][], value: number): [number, string][] {
  return list.some(([v]) => v === value) ? list : [...list, [value, `${value} s`]];
}

function label(list: [number, string][], value: number): string {
  return list.find(([v]) => v === value)?.[1] ?? `${value} s`;
}

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
  const [draft, setDraft] = useState<SleepSettings>(sleepPart(DEFAULT));
  const [wakePinText, setWakePinText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s.energy) {
          setSettings(s.energy);
          setDraft(sleepPart(s.energy));
          setWakePinText(s.energy.wakePin >= 0 ? String(s.energy.wakePin) : '');
        }
        setLoading(false);
      })
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

  function edit(partial: Partial<SleepSettings>) {
    setDraft((prev) => ({ ...prev, ...partial }));
    setSaveErr('');
  }

  async function saveSleep() {
    setSaving(true);
    setSaveErr('');
    try {
      const next = { ...settings, ...draft };
      await updateSettings({ energy: next });
      setSettings(next);
      setConfirmOpen(false);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
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

  const sleepChanged = JSON.stringify(draft) !== JSON.stringify(sleepPart(settings));
  const wakeText = settings.wakeCause === 'pin' ? 'Zuletzt über den Wach-Pin aufgewacht'
    : settings.wakeCause === 'timer' ? 'Zuletzt per Timer aufgewacht, Wach-Pin gehalten'
    : 'Zwischen zwei Messungen schlafen – für Batteriebetrieb';

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
                  <PinHint pins={pins} value={pin} analog onPick={(g) => setPin(String(g))} />
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

        <SettingsGroup title="Deep-Sleep">
          <SettingsCard title="Deep-Sleep" icon={Moon} desc={wakeText}
            control={<ToggleSwitch checked={draft.deepSleep} title="Deep-Sleep"
              onChange={(v) => edit({ deepSleep: v })} />} />

          <SettingsCard title="Messintervall" icon={Timer}
            desc="So oft wacht das Gerät kurz auf, misst, sendet und schläft wieder. Laufende Programme und Timer wecken es zusätzlich pünktlich."
            control={
              <select value={draft.sleepIntervalSec} class={`${inp} w-28`}
                onChange={(e) => edit({ sleepIntervalSec: Number((e.target as HTMLSelectElement).value) })}>
                {choices(INTERVALS, draft.sleepIntervalSec).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            } />

          <SettingsCard title="Wach-Pin" icon={AlarmClock}
            desc="Taster oder Jumper: ein Druck weckt das Gerät voll auf, dauerhaft aktiv hält es wach">
            <div class="space-y-3 pl-9">
              <div class="flex flex-wrap items-center gap-3">
                <input type="number" value={wakePinText} placeholder="GPIO" class={`${inp} w-24`}
                  onInput={(e) => {
                    const t = (e.target as HTMLInputElement).value;
                    setWakePinText(t);
                    const g = parseInt(t, 10);
                    edit({ wakePin: isNaN(g) || g < 0 ? -1 : g });
                  }} />
                <label class="flex items-center gap-2 text-sm">
                  <ToggleSwitch checked={draft.wakeActiveLow} title="Aktiv gegen GND"
                    onChange={(v) => edit({ wakeActiveLow: v })} />
                  {draft.wakeActiveLow ? 'Aktiv gegen GND (interner Pull-up)' : 'Aktiv gegen 3,3 V (interner Pull-down)'}
                </label>
              </div>
              <PinHint pins={pins} value={wakePinText} selfId="energy" rtc pullup={draft.wakeActiveLow}
                suggest={wakePinText === ''} onPick={(g) => { setWakePinText(String(g)); edit({ wakePin: g }); }} />
            </div>
          </SettingsCard>

          <SettingsCard title="Wach bleiben" icon={Timer}
            desc="Nach dem Aufwecken per Pin oder dem Einschalten: so lange ohne Zugriff auf Weboberfläche oder Display, bis es wieder schläft"
            control={
              <select value={draft.awakeTimeoutSec} class={`${inp} w-28`}
                onChange={(e) => edit({ awakeTimeoutSec: Number((e.target as HTMLSelectElement).value) })}>
                {choices(TIMEOUTS, draft.awakeTimeoutSec).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            } />

          <SettingsCard title="WLAN beim kurzen Aufwachen" icon={Wifi}
            desc={draft.shortWakeWifi
              ? 'Sendet über MQTT, Webhook, WebSocket und ESP-NOW und stellt die Uhr per NTP'
              : 'Nur ESP-NOW auf dem zuletzt bekannten Kanal – spart Strom, die Uhr läuft ohne Abgleich'}
            control={<ToggleSwitch checked={draft.shortWakeWifi} title="WLAN beim kurzen Aufwachen"
              onChange={(v) => edit({ shortWakeWifi: v })} />} />
        </SettingsGroup>

        <div class="flex items-center justify-between gap-3 rounded-md border border-border bg-fg/5 px-4 py-3 text-sm">
          <div class="flex min-w-0 flex-1 items-center gap-2 text-muted">
            <Info size={16} class="shrink-0" />
            <span>
              Beim kurzen Aufwachen bleiben Weboberfläche und Display aus. Aktoren sind im Schlaf
              aus, Regler regeln nur, solange das Gerät wach ist. Eine offene Seite hält es wach.
            </span>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            {saveErr && !confirmOpen && <span class="text-critical">{saveErr}</span>}
            <button type="button" class={btnPrimary} disabled={!sleepChanged || saving}
              onClick={() => (draft.deepSleep ? setConfirmOpen(true) : saveSleep())}>
              Speichern
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal open={confirmOpen} title="Deep-Sleep einschalten?"
        confirmLabel="Speichern" pending={saving}
        onCancel={() => { setConfirmOpen(false); setSaveErr(''); }}
        onConfirm={saveSleep}>
        <p>
          Nach {label(TIMEOUTS, draft.awakeTimeoutSec)} ohne Zugriff schläft das Gerät ein und
          wacht alle {label(INTERVALS, draft.sleepIntervalSec)} kurz auf. Die Weboberfläche ist
          dann nur erreichbar, nachdem du es über den Wach-Pin (GPIO {draft.wakePin}) aufgeweckt hast.
        </p>
        {saveErr && <p class="mt-2 text-critical">{saveErr}</p>}
      </ConfirmModal>
    </PageShell>
  );
}
