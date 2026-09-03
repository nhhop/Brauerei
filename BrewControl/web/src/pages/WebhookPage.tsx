// BrewControl/web/src/pages/WebhookPage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { WebhookSettings } from '../types';
import { getSettings, updateSettings } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { btnPrimary, inp, badgeSuccess, badgeCritical } from '../ui';
import { Webhook, Hash, Info, Plug } from 'lucide-preact';

const DEFAULT: WebhookSettings = {
  enabled: false,
  listenPort: 8080,
  peerUrl: '',
  clientId: '',
  topicPrefix: 'brewcontrol',
};

export function WebhookPage(_: { path?: string }) {
  const [saved, setSaved] = useState<WebhookSettings>(DEFAULT);
  const [settings, setSettings] = useState<WebhookSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [actErr, setActErr] = useState<string | null>(null);
  const [rebooting, setRebooting] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => { if (s.webhook) { setSaved(s.webhook); setSettings(s.webhook); } setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function update(partial: Partial<WebhookSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  async function doSave() {
    setPending(true);
    setActErr(null);
    try {
      await updateSettings({ webhook: settings });
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
        <h1 class="text-xl font-medium tracking-tight">Webhook-Einstellungen werden übernommen…</h1>
        <p class="mt-3 text-sm text-muted">Das Gerät startet neu und baut die Verbindung mit den neuen Einstellungen auf.</p>
      </div>
    </div>
  );

  const header = (
    <header class="mb-6">
      <Breadcrumb trail={[
        { label: 'Einstellungen', href: '/settings' },
        { label: 'Konnektivität', href: '/settings/connectivity' },
        { label: 'Webhook' },
      ]} />
    </header>
  );

  if (loading) return <PageShell>{header}<SkeletonList count={2} /></PageShell>;

  return (
    <PageShell>
      {header}

      <SettingsGroup>
        <SettingsCard title="Webhook-Publish aktivieren" icon={Webhook}
          desc="Sensoren, Aktoren und Regler per HTTP an ein Peer-Gerät senden"
          control={<ToggleSwitch checked={settings.enabled} onChange={(v) => update({ enabled: v })}
            title="Webhook-Publish aktivieren" />} />

        {settings.enabled && (
          <>
            <SettingsCard title="Status" icon={Plug}
              desc={!settings.connected && settings.error ? settings.error : 'WLAN-Verbindung dieses Geräts (kein Peer-Erreichbarkeits-Check)'}
              control={
                <span class={settings.connected ? badgeSuccess : badgeCritical}>
                  {settings.connected ? 'Verbunden' : 'Nicht verbunden'}
                </span>
              } />

            <SettingsCard title="Lokaler Port & Peer" icon={Plug} desc="Eigener HTTP-Server-Port und Ziel-URL des empfangenden Geräts">
              <div class="grid grid-cols-1 gap-3 pl-9 sm:grid-cols-[1fr_2fr]">
                <div>
                  <div class="mb-1 text-xs text-muted">Lokaler Port</div>
                  <input type="number" class={inp} value={settings.listenPort} min={1} max={65535}
                    onInput={(e) => {
                      const v = Number((e.target as HTMLInputElement).value);
                      if (v >= 1 && v <= 65535) update({ listenPort: v });
                    }} />
                </div>
                <div>
                  <div class="mb-1 text-xs text-muted">Peer-URL</div>
                  <input type="text" class={inp} value={settings.peerUrl}
                    placeholder="http://192.168.1.50:8080"
                    onInput={(e) => update({ peerUrl: (e.target as HTMLInputElement).value })} />
                </div>
              </div>
            </SettingsCard>

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

      <ConfirmModal open={confirmOpen} title="Webhook-Einstellungen übernehmen?"
        confirmLabel="Speichern & Neustart" pending={pending}
        onCancel={() => { setConfirmOpen(false); setActErr(null); }}
        onConfirm={doSave}>
        <p>Das Gerät startet neu, um die Verbindung mit den neuen Einstellungen aufzubauen.</p>
        {actErr && <p class="mt-2 text-critical">{actErr}</p>}
      </ConfirmModal>
    </PageShell>
  );
}
