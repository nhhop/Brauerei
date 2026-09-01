// BrewControl/web/src/pages/MqttPage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { MqttSettings } from '../types';
import { getSettings, updateSettings } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { Segmented } from '../components/Segmented';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { btnPrimary, inp, badgeSuccess, badgeCritical } from '../ui';
import { Radio, Router, Server, KeyRound, Lock, Info, Plug, Hash } from 'lucide-preact';

const DEFAULT: MqttSettings = {
  enabled: false,
  mode: 'external',
  host: '',
  port: 1883,
  username: '',
  password: '',
  passwordSet: false,
  tls: false,
  clientId: '',
  topicPrefix: 'brewcontrol',
  embeddedBrokerSupported: false,
};

export function MqttPage(_: { path?: string }) {
  const [saved, setSaved] = useState<MqttSettings>(DEFAULT);
  const [settings, setSettings] = useState<MqttSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [actErr, setActErr] = useState<string | null>(null);
  const [rebooting, setRebooting] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => { if (s.mqtt) { setSaved(s.mqtt); setSettings(s.mqtt); } setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function update(partial: Partial<MqttSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  function setTls(tls: boolean) {
    // Nudge the port to the conventional default when it's still untouched.
    if (tls && settings.port === 1883) update({ tls, port: 8883 });
    else if (!tls && settings.port === 8883) update({ tls, port: 1883 });
    else update({ tls });
  }

  async function doSave() {
    setPending(true);
    setActErr(null);
    try {
      await updateSettings({ mqtt: settings });
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
        <h1 class="text-xl font-medium tracking-tight">MQTT-Einstellungen werden übernommen…</h1>
        <p class="mt-3 text-sm text-muted">Das Gerät startet neu und baut die Verbindung mit den neuen Einstellungen auf.</p>
      </div>
    </div>
  );

  if (loading) return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      <p class="text-sm text-muted">Laden…</p>
    </div>
  );

  const embeddedSupported = settings.embeddedBrokerSupported !== false;

  return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      <header class="mb-6">
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'MQTT' }]} />
      </header>

      <SettingsGroup>
        <SettingsCard title="MQTT aktivieren" icon={Radio} desc="Sensoren, Aktoren und Regler per MQTT veröffentlichen"
          control={<ToggleSwitch checked={settings.enabled} onChange={(v) => update({ enabled: v })}
            title="MQTT aktivieren" />} />

        {settings.enabled && (
          <>
            {settings.mode === 'external' && (
              <SettingsCard title="Status" icon={Plug}
                desc={!settings.connected && settings.error ? settings.error : 'Verbindung zum konfigurierten Broker'}
                control={
                  <span class={settings.connected ? badgeSuccess : badgeCritical}>
                    {settings.connected ? 'Verbunden' : 'Nicht verbunden'}
                  </span>
                } />
            )}

            <SettingsCard title="Modus" icon={Router} desc={
              !embeddedSupported ? 'Eingebauter Broker auf diesem Board nicht verfügbar (Flash-Budget)' : undefined
            } control={
              <Segmented value={settings.mode}
                options={(
                  embeddedSupported
                    ? [{ value: 'external', label: 'Externer Broker' }, { value: 'embedded', label: 'Eingebaut' }]
                    : [{ value: 'external', label: 'Externer Broker' }]
                ) as { value: 'external' | 'embedded'; label: string }[]}
                onChange={(m) => update({ mode: m })} />
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

            {settings.mode === 'external' && (
              <SettingsCard title="Broker-Adresse" icon={Server} desc="Host und Port des externen MQTT-Brokers">
                <div class="grid grid-cols-1 gap-3 pl-9 sm:grid-cols-[2fr_1fr]">
                  <div>
                    <div class="mb-1 text-xs text-muted">Host</div>
                    <input type="text" class={inp} value={settings.host}
                      placeholder="z.B. homeassistant.local"
                      onInput={(e) => update({ host: (e.target as HTMLInputElement).value })} />
                  </div>
                  <div>
                    <div class="mb-1 text-xs text-muted">Port</div>
                    <input type="number" class={inp} value={settings.port} min={1} max={65535}
                      onInput={(e) => {
                        const v = Number((e.target as HTMLInputElement).value);
                        if (v >= 1 && v <= 65535) update({ port: v });
                      }} />
                  </div>
                </div>
              </SettingsCard>
            )}

            {settings.mode === 'embedded' && (
              <SettingsCard title="Broker-Port" icon={Server} desc="Nur im lokalen Netz erreichbar, keine TLS-Verschlüsselung">
                <div class="pl-9 sm:w-40">
                  <input type="number" class={inp} value={settings.port} min={1} max={65535}
                    onInput={(e) => {
                      const v = Number((e.target as HTMLInputElement).value);
                      if (v >= 1 && v <= 65535) update({ port: v });
                    }} />
                </div>
              </SettingsCard>
            )}

            <SettingsCard title="Zugangsdaten" icon={KeyRound} desc={
              settings.mode === 'embedded' ? 'Schützt den eingebauten Broker vor unbefugtem Zugriff im LAN' : 'Optional, falls der Broker Authentifizierung verlangt'
            }>
              <div class="grid grid-cols-1 gap-3 pl-9 sm:grid-cols-2">
                <div>
                  <div class="mb-1 text-xs text-muted">Benutzername</div>
                  <input type="text" class={inp} value={settings.username} autocomplete="off"
                    onInput={(e) => update({ username: (e.target as HTMLInputElement).value })} />
                </div>
                <div>
                  <div class="mb-1 text-xs text-muted">Passwort</div>
                  <input type="password" class={inp} value={settings.password} autocomplete="off"
                    placeholder={settings.passwordSet ? '•••••••• (gespeichert — leer lassen zum Behalten)' : ''}
                    onInput={(e) => update({ password: (e.target as HTMLInputElement).value })} />
                </div>
              </div>
            </SettingsCard>

            {settings.mode === 'external' && (
              <SettingsCard title="TLS" icon={Lock} desc="Verschlüsselte Verbindung zum externen Broker"
                control={<ToggleSwitch checked={settings.tls} onChange={setTls} title="TLS" />} />
            )}
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

      <ConfirmModal open={confirmOpen} title="MQTT-Einstellungen übernehmen?"
        confirmLabel="Speichern & Neustart" pending={pending}
        onCancel={() => { setConfirmOpen(false); setActErr(null); }}
        onConfirm={doSave}>
        <p>Das Gerät startet neu, um die Verbindung mit den neuen Einstellungen aufzubauen.</p>
        {actErr && <p class="mt-2 text-critical">{actErr}</p>}
      </ConfirmModal>
    </div>
  );
}
