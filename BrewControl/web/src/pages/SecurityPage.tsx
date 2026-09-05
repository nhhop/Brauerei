// BrewControl/web/src/pages/SecurityPage.tsx
import { useEffect, useState } from 'preact/hooks';
import type { AuthStatus } from '../types';
import { getAuthStatus, setDevicePassword, revokeAllSessions } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { btnPrimary, btnDanger, btnSecondary, inp, badge, badgeSuccess } from '../ui';
import { Lock, LockOpen, Info, LogOut } from 'lucide-preact';

export function SecurityPage(_: { path?: string }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  function reload() {
    // A firmware without the auth routes answers 404 here. Say so instead of
    // sitting in the skeleton forever, and never guess "unprotected" — that
    // would claim a security state we don't actually know.
    return getAuthStatus()
      .then((s) => { setStatus(s); setUnavailable(false); })
      .catch(() => setUnavailable(true));
  }

  useEffect(() => { reload(); }, []);

  function clearForm() {
    setCurrent(''); setNext(''); setRepeat('');
  }

  async function save() {
    if (!next) { setErr('Bitte ein Passwort eingeben.'); return; }
    if (next !== repeat) { setErr('Die beiden Passwörter stimmen nicht überein.'); return; }
    setPending(true); setErr(null); setNote(null);
    try {
      await setDevicePassword(current, next);
      clearForm();
      await reload();
      setNote('Passwort gespeichert.');
    } catch {
      setErr(status?.enabled ? 'Aktuelles Passwort falsch.' : 'Speichern fehlgeschlagen.');
    } finally {
      setPending(false);
    }
  }

  async function removeProtection() {
    setPending(true); setErr(null); setNote(null);
    try {
      await setDevicePassword(current, '');
      clearForm();
      setRemoveOpen(false);
      await reload();
      setNote('Zugriffsschutz aufgehoben.');
    } catch {
      setErr('Aktuelles Passwort falsch.');
      setRemoveOpen(false);
    } finally {
      setPending(false);
    }
  }

  async function revokeAll() {
    setPending(true); setErr(null); setNote(null);
    try {
      await revokeAllSessions();
      await reload();
      setNote('Alle Sitzungen wurden abgemeldet.');
    } catch {
      setErr('Abmelden fehlgeschlagen.');
    } finally {
      setPending(false);
    }
  }

  const header = (
    <header class="mb-6">
      <Breadcrumb trail={[
        { label: 'Einstellungen', href: '/settings' },
        { label: 'Zugriffsschutz' },
      ]} />
    </header>
  );

  if (unavailable) return (
    <PageShell>
      {header}
      <SettingsGroup>
        <SettingsCard icon={Info} title="Zugriffsschutz nicht verfügbar"
          desc="Das Gerät antwortet nicht auf /api/auth/status — vermutlich läuft dort noch eine Firmware ohne Zugriffsschutz." />
      </SettingsGroup>
    </PageShell>
  );

  if (!status) return <PageShell>{header}<SkeletonList count={2} /></PageShell>;

  const locked = status.enabled && !status.authenticated;

  return (
    <PageShell>
      {header}

      <SettingsGroup>
        <SettingsCard
          icon={status.enabled ? Lock : LockOpen}
          title={status.enabled ? 'Zugriffsschutz aktiv' : 'Kein Zugriffsschutz'}
          desc={status.enabled
            ? 'Werte ändern, Geräte anlegen, Updates und Backups verlangen das Gerätepasswort. Anzeigen bleibt für jeden im Netzwerk offen.'
            : 'Jeder im Netzwerk kann dieses Gerät bedienen. Ein Passwort schützt alle schreibenden Zugriffe; Anzeigen bleibt offen.'}
          control={<span class={status.enabled ? badgeSuccess : badge}>
            {status.enabled ? 'Aktiv' : 'Aus'}
          </span>} />

        {locked ? (
          <SettingsCard icon={Lock} title="Nicht angemeldet"
            desc="Zum Ändern des Passworts zuerst anmelden."
            control={
              <button type="button" class={btnSecondary}
                onClick={() => window.dispatchEvent(new Event('bc:unauthorized'))}>
                Anmelden
              </button>
            } />
        ) : (
          <SettingsCard icon={Lock}
            title={status.enabled ? 'Passwort ändern' : 'Zugriffsschutz einrichten'}
            desc={status.enabled
              ? 'Ein Wechsel meldet alle anderen Geräte ab.'
              : 'Das Passwort gilt für das ganze Gerät — es gibt keine getrennten Benutzer.'}>
            <div class="grid grid-cols-1 gap-3 pl-9 sm:grid-cols-2">
              {status.enabled && (
                <div class="sm:col-span-2">
                  <div class="mb-1 text-xs text-muted">Aktuelles Passwort</div>
                  <input type="password" class={inp} value={current} autocomplete="current-password"
                    onInput={(e) => setCurrent((e.target as HTMLInputElement).value)} />
                </div>
              )}
              <div>
                <div class="mb-1 text-xs text-muted">Neues Passwort</div>
                <input type="password" class={inp} value={next} autocomplete="new-password"
                  onInput={(e) => setNext((e.target as HTMLInputElement).value)} />
              </div>
              <div>
                <div class="mb-1 text-xs text-muted">Wiederholen</div>
                <input type="password" class={inp} value={repeat} autocomplete="new-password"
                  onInput={(e) => setRepeat((e.target as HTMLInputElement).value)} />
              </div>
            </div>
          </SettingsCard>
        )}

        {status.enabled && !locked && (
          <SettingsCard icon={LogOut} title="Alle Sitzungen abmelden"
            desc="Meldet jedes angemeldete Gerät ab, auch dieses."
            control={
              <button type="button" class={btnSecondary} disabled={pending} onClick={revokeAll}>
                Abmelden
              </button>
            } />
        )}

        {status.enabled && !locked && (
          <SettingsCard icon={LockOpen} title="Zugriffsschutz aufheben"
            desc="Entfernt das Passwort — das Gerät ist danach wieder für jeden im Netzwerk bedienbar. Aktuelles Passwort oben eintragen."
            control={
              <button type="button" class={btnDanger} disabled={pending || !current}
                onClick={() => setRemoveOpen(true)}>
                Aufheben
              </button>
            } />
        )}
      </SettingsGroup>

      <div class="mt-6 flex items-center justify-between gap-3 rounded-md border border-border bg-fg/5 px-4 py-3 text-sm">
        <div class="flex min-w-0 flex-1 items-center gap-2 text-muted">
          <Info size={16} class="shrink-0" />
          <span>
            Ohne HTTPS geht das Passwort beim Anmelden unverschlüsselt über das Netzwerk. Der Schutz
            wirkt gegen Fehlbedienung und gegen Geräte, die die API zufällig finden — nicht gegen
            einen aktiven Angreifer im selben Netz. Passwort vergessen: BOOT-Taste beim Einschalten
            halten (setzt auch die WLAN-Zugangsdaten zurück).
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          {err && <span class="text-critical">{err}</span>}
          {note && !err && <span class="text-muted">{note}</span>}
          {!locked && (
            <button type="button" class={btnPrimary} disabled={pending || !next} onClick={save}>
              Speichern
            </button>
          )}
        </div>
      </div>

      <ConfirmModal open={removeOpen} title="Zugriffsschutz aufheben?"
        confirmLabel="Aufheben" destructive pending={pending}
        onConfirm={removeProtection} onCancel={() => setRemoveOpen(false)}>
        Das Gerät ist danach ohne Passwort bedienbar — jeder im Netzwerk kann Aktoren schalten,
        Regler verstellen und Firmware aufspielen.
      </ConfirmModal>
    </PageShell>
  );
}
