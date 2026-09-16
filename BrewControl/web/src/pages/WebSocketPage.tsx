// BrewControl/web/src/pages/WebSocketPage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { WebSocketSettings } from '../types';
import { getSettings, updateSettings } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { btnPrimary, inp, badge, badgeSuccess, badgeCritical } from '../ui';
import { Cable, Server, Hash, Info, Plug } from 'lucide-preact';

const DEFAULT: WebSocketSettings = {
  hubEnabled: false,
  hubPort: 8081,
  publishEnabled: false,
  hubUrl: '',
  clientId: '',
  topicPrefix: 'brewcontrol',
};

export function WebSocketPage(_: { path?: string }) {
  const [saved, setSaved] = useState<WebSocketSettings>(DEFAULT);
  const [settings, setSettings] = useState<WebSocketSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [actErr, setActErr] = useState<string | null>(null);
  const [rebooting, setRebooting] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => { if (s.websocket) { setSaved(s.websocket); setSettings(s.websocket); } setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function update(partial: Partial<WebSocketSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  async function doSave() {
    setPending(true);
    setActErr(null);
    try {
      await updateSettings({ websocket: settings });
      setRebooting(true);
    } catch (e) {
      setActErr(String(e));
      setPending(false);
    }
  }

  const changed = JSON.stringify(settings) !== JSON.stringify(saved);
  const hubClients = settings.hubClients ?? 0;

  if (rebooting) return (
    <div class="flex min-h-full items-center justify-center bg-bg p-6 text-fg">
      <div class="max-w-md text-center">
        <h1 class="text-xl font-medium tracking-tight">WebSocket-Einstellungen werden übernommen…</h1>
        <p class="mt-3 text-sm text-muted">Das Gerät startet neu und baut die Verbindung mit den neuen Einstellungen auf.</p>
      </div>
    </div>
  );

  const header = (
    <header class="mb-6">
      <Breadcrumb trail={[
        { label: 'Einstellungen', href: '/settings' },
        { label: 'Konnektivität', href: '/settings/connectivity' },
        { label: 'WebSocket' },
      ]} />
    </header>
  );

  if (loading) return <PageShell>{header}<SkeletonList count={2} /></PageShell>;

  return (
    <PageShell>
      {header}

      <div class="space-y-6">
        <SettingsGroup title="Hub">
          <SettingsCard title="WebSocket-Hub aktivieren" icon={Server}
            desc="Andere Geräte verbinden sich mit diesem Gerät und liefern ihre Sensoren und Aktoren"
            control={<ToggleSwitch checked={settings.hubEnabled} onChange={(v) => update({ hubEnabled: v })}
              title="WebSocket-Hub aktivieren" />} />

          {settings.hubEnabled && (
            <>
              <SettingsCard title="Verbundene Geräte" icon={Plug}
                desc="Geräte, die gerade an diesem Hub angemeldet sind"
                control={<span class={hubClients > 0 ? badgeSuccess : badge}>{hubClients}</span>} />

              <SettingsCard title="Port" icon={Server} desc="Port, auf dem der Hub Verbindungen annimmt">
                <div class="pl-9 sm:max-w-40">
                  <input type="number" class={`${inp} w-full`} value={settings.hubPort} min={1} max={65535}
                    onInput={(e) => {
                      const v = Number((e.target as HTMLInputElement).value);
                      if (v >= 1 && v <= 65535) update({ hubPort: v });
                    }} />
                </div>
              </SettingsCard>
            </>
          )}
        </SettingsGroup>

        <SettingsGroup title="Senden an Hub">
          <SettingsCard title="WebSocket-Publish aktivieren" icon={Cable}
            desc="Sensoren, Aktoren und Regler per WebSocket an einen Hub senden"
            control={<ToggleSwitch checked={settings.publishEnabled} onChange={(v) => update({ publishEnabled: v })}
              title="WebSocket-Publish aktivieren" />} />

          {settings.publishEnabled && (
            <>
              <SettingsCard title="Status" icon={Plug}
                desc={settings.connected ? 'Verbindung zum Hub steht' : (settings.error || 'Keine Verbindung zum Hub')}
                control={
                  <span class={settings.connected ? badgeSuccess : badgeCritical}>
                    {settings.connected ? 'Verbunden' : 'Nicht verbunden'}
                  </span>
                } />

              <SettingsCard title="Hub-URL" icon={Cable} desc="Adresse des Hubs, mit dem sich dieses Gerät verbindet">
                <div class="pl-9">
                  <input type="text" class={`${inp} w-full`} value={settings.hubUrl}
                    placeholder="ws://192.168.1.50:8081"
                    onInput={(e) => update({ hubUrl: (e.target as HTMLInputElement).value })} />
                </div>
              </SettingsCard>

              <SettingsCard title="Topic & Client-ID" icon={Hash}
                desc={`Schema: ${settings.topicPrefix ? settings.topicPrefix + '/' : ''}${settings.clientId || '<mdns-hostname>'}/sensor/<id>`}>
                <div class="grid grid-cols-1 gap-3 pl-9 sm:grid-cols-2">
                  <div>
                    <div class="mb-1 text-xs text-muted">Topic-Prefix</div>
                    <input type="text" class={`${inp} w-full`} value={settings.topicPrefix}
                      placeholder="brewcontrol, leer = kein Prefix"
                      onInput={(e) => update({ topicPrefix: (e.target as HTMLInputElement).value })} />
                  </div>
                  <div>
                    <div class="mb-1 text-xs text-muted">Client-ID</div>
                    <input type="text" class={`${inp} w-full`} value={settings.clientId}
                      placeholder="Leer = mDNS-Hostname"
                      onInput={(e) => update({ clientId: (e.target as HTMLInputElement).value })} />
                  </div>
                </div>
              </SettingsCard>
            </>
          )}
        </SettingsGroup>
      </div>

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

      <ConfirmModal open={confirmOpen} title="WebSocket-Einstellungen übernehmen?"
        confirmLabel="Speichern & Neustart" pending={pending}
        onCancel={() => { setConfirmOpen(false); setActErr(null); }}
        onConfirm={doSave}>
        <p>Das Gerät startet neu, um die Verbindung mit den neuen Einstellungen aufzubauen.</p>
        {actErr && <p class="mt-2 text-critical">{actErr}</p>}
      </ConfirmModal>
    </PageShell>
  );
}
