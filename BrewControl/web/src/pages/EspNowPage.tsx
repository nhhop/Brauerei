// BrewControl/web/src/pages/EspNowPage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { EspNowSettings } from '../types';
import { getSettings, updateSettings } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { EspressifIcon } from '../components/EspressifIcon';
import { btnPrimary, inp, badgeSuccess, badgeCritical } from '../ui';
import { Hash, Info, Plug } from 'lucide-preact';

const DEFAULT: EspNowSettings = {
  enabled: false,
  clientId: '',
  topicPrefix: 'brewcontrol',
};

export function EspNowPage(_: { path?: string }) {
  const [saved, setSaved] = useState<EspNowSettings>(DEFAULT);
  const [settings, setSettings] = useState<EspNowSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [actErr, setActErr] = useState<string | null>(null);
  const [rebooting, setRebooting] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => { if (s.espnow) { setSaved(s.espnow); setSettings(s.espnow); } setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function update(partial: Partial<EspNowSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  async function doSave() {
    setPending(true);
    setActErr(null);
    try {
      await updateSettings({ espnow: settings });
      setRebooting(true);
    } catch (e) {
      setActErr(String(e));
      setPending(false);
    }
  }

  const changed = JSON.stringify(settings) !== JSON.stringify(saved);

  if (rebooting) return (
    <div class="flex min-h-full items-center justify-center bg-bg p-6 text-fg">
      <div class="max-w-md text-center">
        <h1 class="text-xl font-medium tracking-tight">ESP-NOW-Einstellungen werden übernommen…</h1>
        <p class="mt-3 text-sm text-muted">Das Gerät startet neu und baut die Verbindung mit den neuen Einstellungen auf.</p>
      </div>
    </div>
  );

  if (loading) return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      <p class="text-sm text-muted">Laden…</p>
    </div>
  );

  return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      <header class="mb-6">
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'ESP-NOW' }]} />
      </header>

      <SettingsGroup>
        <SettingsCard title="ESP-NOW-Publish aktivieren" icon={EspressifIcon}
          desc="Sensoren, Aktoren und Regler per ESP-NOW-Broadcast senden (gleicher WLAN-Kanal, kein Pairing nötig)"
          control={<ToggleSwitch checked={settings.enabled} onChange={(v) => update({ enabled: v })}
            title="ESP-NOW-Publish aktivieren" />} />

        {settings.enabled && (
          <>
            <SettingsCard title="Status" icon={Plug}
              desc={!settings.connected && settings.error ? settings.error : 'ESP-NOW-Transport dieses Geräts'}
              control={
                <span class={settings.connected ? badgeSuccess : badgeCritical}>
                  {settings.connected ? 'Aktiv' : 'Nicht aktiv'}
                </span>
              } />

            <SettingsCard title="Topic & Client-ID" icon={Hash}
              desc={`Schema: ${settings.topicPrefix ? settings.topicPrefix + '/' : ''}${settings.clientId || '<mdns-hostname>'}/sensor/<id>`}>
              <div class="grid grid-cols-1 gap-3 pl-9 sm:grid-cols-2">
                <div>
                  <div class="mb-1 text-xs text-muted">Topic-Prefix</div>
                  <input type="text" class={inp} value={settings.topicPrefix}
                    placeholder="brewcontrol, leer = kein Prefix"
                    onInput={(e) => update({ topicPrefix: (e.target as HTMLInputElement).value })} />
                </div>
                <div>
                  <div class="mb-1 text-xs text-muted">Client-ID</div>
                  <input type="text" class={inp} value={settings.clientId}
                    placeholder="Leer = mDNS-Hostname"
                    onInput={(e) => update({ clientId: (e.target as HTMLInputElement).value })} />
                </div>
              </div>
            </SettingsCard>
          </>
        )}
      </SettingsGroup>

      <div class="mt-6 flex items-center justify-between gap-3 rounded-md border border-border bg-fg/5 px-4 py-3 text-sm">
        <div class="flex min-w-0 flex-1 items-center gap-2 text-muted">
          <Info size={16} class="shrink-0" />
          <span>Änderungen wirken erst nach dem Speichern — das Gerät startet dabei neu.</span>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          {actErr && <span class="text-critical">{actErr}</span>}
          <button type="button" class={btnPrimary} disabled={!changed}
            onClick={() => setConfirmOpen(true)}>
            Speichern
          </button>
        </div>
      </div>

      <ConfirmModal open={confirmOpen} title="ESP-NOW-Einstellungen übernehmen?"
        confirmLabel="Speichern & Neustart" pending={pending}
        onCancel={() => { setConfirmOpen(false); setActErr(null); }}
        onConfirm={doSave}>
        <p>Das Gerät startet neu, um die Verbindung mit den neuen Einstellungen aufzubauen.</p>
        {actErr && <p class="mt-2 text-critical">{actErr}</p>}
      </ConfirmModal>
    </div>
  );
}
