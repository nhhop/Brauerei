// BrewControl/web/src/pages/NotificationsPage.tsx
import { useEffect, useState } from 'preact/hooks';
import type { PushStatus } from '../types';
import { getPush, setPushSubscription, deletePushSubscription, testPush, resetPush } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { btnPrimary, btnSecondary, btnDanger, badgeSuccess, badge } from '../ui';
import { BellRing, Smartphone, Info, Trash2 } from 'lucide-preact';

// Where the browser subscribes. It has to be an https origin: the firmware
// serves plain http, and pushManager.subscribe() refuses to run outside a
// secure context. See BrewControl/push-bootstrap/.
const BOOTSTRAP_URL = 'https://nhhop.github.io/Brauerei/push/';

type Handover = Parameters<typeof setPushSubscription>[0];

function decodeFragment(hash: string): Handover | null {
  const m = /[#&]push=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Handover;
  } catch {
    return null;
  }
}

// The push service host is what the device can see, but "welcher Browser?" is
// what the user actually wants — and the raw Mozilla host is long enough to
// run over the delete button on a phone.
function serviceName(host: string): string {
  if (host.endsWith('googleapis.com')) return 'Google — Chrome oder Edge';
  if (host.endsWith('mozilla.com')) return 'Mozilla — Firefox';
  if (host.endsWith('notify.windows.com')) return 'Microsoft — Edge';
  if (host.endsWith('push.apple.com')) return 'Apple — Safari';
  return host || 'Unbekannter Dienst';
}

function formatDate(epoch: number): string {
  if (!epoch) return 'unbekannt';
  return new Date(epoch * 1000).toLocaleString();
}

export function NotificationsPage(_: { path?: string }) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  function reload() {
    // A firmware built before this feature answers 404 — say so rather than
    // sitting in the skeleton forever.
    return getPush()
      .then((s) => { setStatus(s); setUnavailable(false); return s; })
      .catch(() => { setUnavailable(true); return null; });
  }

  // The bootstrap page comes back with the subscription in the URL fragment.
  // A fragment never reaches a server, so this is also the only part of the
  // handover that stays inside the browser.
  useEffect(() => {
    const handover = decodeFragment(window.location.hash);
    if (!handover) { reload(); return; }
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setPending(true);
    setPushSubscription(handover)
      .then(() => { setNote('Benachrichtigungen sind für diesen Browser eingerichtet.'); })
      .catch(() => setErr('Das Abo konnte nicht gespeichert werden.'))
      .finally(() => { setPending(false); reload(); });
  }, []);

  function activate() {
    const back = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({ back });
    // Hand the device's key along so a second browser subscribes against the
    // same one instead of starting a rival keypair.
    if (status?.publicKey) params.set('k', status.publicKey);
    window.location.href = BOOTSTRAP_URL + '?' + params.toString();
  }

  async function runTest() {
    setPending(true); setErr(null); setNote(null);
    try {
      await testPush();
      setNote('Testmeldung verschickt. Sie kann ein paar Sekunden brauchen.');
    } catch {
      setErr('Testmeldung fehlgeschlagen.');
    } finally { setPending(false); }
  }

  async function removeSub(id: number) {
    setPending(true); setErr(null); setNote(null);
    try {
      await deletePushSubscription(id);
      await reload();
    } catch {
      setErr('Abo konnte nicht entfernt werden.');
    } finally { setPending(false); }
  }

  async function doReset() {
    setPending(true); setErr(null); setNote(null);
    try {
      await resetPush();
      setResetOpen(false);
      await reload();
      setNote('Zurückgesetzt. Jeder Browser muss neu eingerichtet werden.');
    } catch {
      setErr('Zurücksetzen fehlgeschlagen.');
    } finally { setPending(false); }
  }

  const trail = [
    { label: 'Einstellungen', href: '/settings' },
    { label: 'Benachrichtigungen' },
  ];

  if (unavailable) {
    return (
      <PageShell>
        <Breadcrumb trail={trail} />
        <p class="mt-6 text-muted">
          Diese Firmware kennt keine Push-Benachrichtigungen. Nach einem Firmware-Update
          erscheint die Einrichtung hier.
        </p>
      </PageShell>
    );
  }

  if (!status) {
    return (
      <PageShell>
        <Breadcrumb trail={trail} />
        <div class="mt-6"><SkeletonList /></div>
      </PageShell>
    );
  }

  const subs = status.subscriptions;

  return (
    <PageShell>
      <Breadcrumb trail={trail} />

      <div class="mt-6 space-y-6">
        <SettingsGroup>
          <SettingsCard
            icon={BellRing}
            title="Push-Benachrichtigungen"
            desc={status.configured
              ? 'Meldungen erreichen dich auch bei geschlossenem Dashboard.'
              : 'Noch nicht eingerichtet — es wird noch nichts aufs Handy gemeldet.'}
            control={status.configured
              ? <span class={badgeSuccess}>aktiv</span>
              : <span class={badge}>inaktiv</span>}
          >
            <p class="mt-3 text-sm text-muted">
              Gemeldet werden dieselben Ereignisse wie im Alarm-Center: Grenzwert-Alarme,
              Störungen, Programm-Ende, ein Schritt der auf Bestätigung wartet und ein
              fertiger AutoTune.
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <button class={btnPrimary} disabled={pending} onClick={activate}>
                {subs.length ? 'Weiteren Browser hinzufügen' : 'Auf diesem Gerät aktivieren'}
              </button>
              {status.configured && (
                <button class={btnSecondary} disabled={pending} onClick={runTest}>
                  Testmeldung senden
                </button>
              )}
            </div>
          </SettingsCard>
        </SettingsGroup>

        {subs.length > 0 && (
          <SettingsGroup title={`Eingerichtete Browser (${subs.length}/${status.maxSubscriptions})`}>
            {subs.map((s) => (
              <SettingsCard
                key={s.id}
                icon={Smartphone}
                title={serviceName(s.host)}
                desc={`eingerichtet am ${formatDate(s.addedAt)}`}
                control={
                  <button type="button" title="Abo entfernen" disabled={pending}
                    onClick={() => removeSub(s.id)}
                    class="rounded border border-border px-2 py-1 text-critical transition-colors hover:bg-fg/10">
                    <Trash2 size={14} />
                  </button>
                }
              />
            ))}
          </SettingsGroup>
        )}

        <SettingsGroup title="Gut zu wissen">
          <SettingsCard icon={Info}>
            <ul class="space-y-2 text-sm text-muted">
              <li>
                Zum Einrichten geht es kurz auf eine Seite bei GitHub — nur der Browser
                verlangt für ein Abo eine verschlüsselte Verbindung, die dieses Gerät
                im Heimnetz nicht hat. Gemeldet wird danach direkt von hier.
              </li>
              <li>
                Als Absender zeigt der Browser deshalb <b>github.io</b> an, nicht dein Gerät.
              </li>
              <li>
                Auf dem <b>iPhone</b> muss die Einrichtungsseite zuerst über „Teilen → Zum
                Home-Bildschirm" abgelegt und von dort geöffnet werden — anders liefert
                Safari keine Benachrichtigungen aus.
              </li>
              <li>
                Direkt nach einem Neustart, solange die Uhrzeit noch nicht per NTP steht,
                wird nichts verschickt. Im Alarm-Center stehen diese Meldungen trotzdem.
              </li>
            </ul>
          </SettingsCard>
        </SettingsGroup>

        {status.lastError && (
          <p class="text-sm text-critical">Letzter Fehler: {status.lastError}</p>
        )}
        {err && <p class="text-sm text-critical">{err}</p>}
        {note && <p class="text-sm text-muted">{note}</p>}

        {(status.publicKey || subs.length > 0) && (
          <div>
            <button class={btnDanger} disabled={pending} onClick={() => setResetOpen(true)}>
              Zurücksetzen
            </button>
            <p class="mt-2 text-xs text-muted">
              Verwirft Schlüssel und alle Abos. Nötig, wenn zwei Geräte mit
              unterschiedlichen Schlüsseln nebeneinander stehen.
            </p>
          </div>
        )}
      </div>

      <ConfirmModal open={resetOpen} title="Benachrichtigungen zurücksetzen?"
        confirmLabel="Zurücksetzen" destructive pending={pending}
        onConfirm={doReset} onCancel={() => setResetOpen(false)}>
        Alle eingerichteten Browser verlieren die Benachrichtigungen dieses Geräts und
        müssen neu eingerichtet werden.
      </ConfirmModal>
    </PageShell>
  );
}
