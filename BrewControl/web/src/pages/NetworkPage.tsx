// BrewControl/web/src/pages/NetworkPage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { NetworkStatus, ScanNetwork } from '../types';
import { getNetwork, scanNetworks, setNetwork, setHostname, wifiReset } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { Breadcrumb } from '../components/Breadcrumb';
import { btnPrimary, inp } from '../ui';

// Coarse signal-strength bucket from RSSI (dBm) for a 0–4 bar display.
function signalBars(rssi: number): number {
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  if (rssi >= -85) return 1;
  return 0;
}

function SignalBars({ rssi }: { rssi: number }) {
  const bars = signalBars(rssi);
  return (
    <span class="inline-flex items-end gap-0.5" title={`${rssi} dBm`}>
      {[1, 2, 3, 4].map((b) => (
        <span key={b}
          class={`inline-block w-1 rounded-sm ${b <= bars ? 'bg-fg' : 'bg-fg/20'}`}
          style={{ height: `${b * 3 + 2}px` }} />
      ))}
    </span>
  );
}

export function NetworkPage(_: { path?: string }) {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // WLAN-Wechsel — one SSID source (selSsid), fed by the scan dropdown or, when
  // `manual` is set (hidden network / scan failed), a free-text input.
  const [nets, setNets] = useState<ScanNetwork[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [selSsid, setSelSsid] = useState('');
  const [manual, setManual] = useState(false);
  const [password, setPassword] = useState('');
  const [switchOpen, setSwitchOpen] = useState(false);
  const ssid = selSsid;

  async function doScan() {
    setScanning(true);
    setScanErr(null);
    setManual(false);
    try {
      const found = await scanNetworks();
      // De-dupe by SSID (strongest wins), drop hidden/empty, sort by signal.
      const best = new Map<string, ScanNetwork>();
      for (const n of found) {
        if (!n.ssid) continue;
        const prev = best.get(n.ssid);
        if (!prev || n.rssi > prev.rssi) best.set(n.ssid, n);
      }
      const list = [...best.values()].sort((a, b) => b.rssi - a.rssi);
      setNets(list);
      if (list.length && !selSsid) setSelSsid(list[0].ssid);
    } catch (e) {
      setScanErr(`${e} — du kannst den Namen unten manuell eintragen.`);
      setManual(true);   // scan failed → fall back to free-text SSID entry
    }
    setScanning(false);
  }

  // Hostname
  const [host, setHost] = useState('');
  const [hostOpen, setHostOpen] = useState(false);

  // Reset
  const [resetOpen, setResetOpen] = useState(false);

  // Shared action state
  const [pending, setPending] = useState(false);
  const [actErr, setActErr] = useState<string | null>(null);
  const [reboot, setReboot] = useState<{ title: string; body: ComponentChildren } | null>(null);

  useEffect(() => {
    getNetwork()
      .then((s) => { setStatus(s); setHost(s.hostname); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function doSwitch() {
    setPending(true);
    setActErr(null);
    try {
      await setNetwork(ssid.trim(), password);
      setReboot({
        title: 'Verbinde mit neuem Netzwerk…',
        body: (
          <p>
            Das Gerät startet neu und verbindet sich mit
            <code class="mx-1 rounded bg-fg/10 px-1 font-mono">{ssid.trim()}</code>.
            Diese Oberfläche ist danach nur noch im neuen Netzwerk erreichbar
            (z.&nbsp;B. über
            <code class="mx-1 rounded bg-fg/10 px-1 font-mono">{host}.local</code>).
            Schlägt die Verbindung fehl, öffnet das Gerät den Setup-AP
            <code class="mx-1 rounded bg-fg/10 px-1 font-mono">BrewControl-Setup</code>.
          </p>
        ),
      });
    } catch (e) {
      setActErr(String(e));
      setPending(false);
    }
  }

  async function doHostname() {
    setPending(true);
    setActErr(null);
    const h = host.trim().toLowerCase();
    try {
      await setHostname(h);
      setReboot({
        title: 'Hostname wird übernommen…',
        body: (
          <p>
            Das Gerät startet neu. Danach ist es unter
            <code class="mx-1 rounded bg-fg/10 px-1 font-mono">{h}.local</code>
            erreichbar.
          </p>
        ),
      });
    } catch (e) {
      setActErr(String(e));
      setPending(false);
    }
  }

  async function doReset() {
    setPending(true);
    setActErr(null);
    try {
      await wifiReset();
      setReboot({
        title: 'Neustart in den Setup-Modus…',
        body: (
          <p>
            Die gespeicherten WLAN-Zugangsdaten wurden gelöscht. Zum Neu-Einrichten
            mit dem WLAN
            <code class="mx-1 rounded bg-fg/10 px-1 font-mono">BrewControl-Setup</code>
            verbinden.
          </p>
        ),
      });
    } catch (e) {
      setActErr(String(e));
      setPending(false);
    }
  }

  const hostValid = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/.test(host.trim().toLowerCase());
  const hostChanged = status != null && host.trim().toLowerCase() !== status.hostname;

  if (reboot) return (
    <div class="flex min-h-full items-center justify-center bg-bg p-6 text-fg">
      <div class="max-w-md text-center">
        <h1 class="text-xl font-medium tracking-tight">{reboot.title}</h1>
        <div class="mt-3 text-sm text-muted">{reboot.body}</div>
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
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Netzwerk' }]} />
      </header>

      {/* ── Status ─────────────────────────────────────────────────────── */}
      <div class="mb-4 rounded-lg border border-border bg-surface p-4">
        <div class="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Status</div>
        {status?.connected ? (
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt class="text-muted">Netzwerk</dt>
            <dd class="font-medium">{status.ssid || '—'}</dd>
            <dt class="text-muted">Signal</dt>
            <dd class="flex items-center gap-2"><SignalBars rssi={status.rssi} /><span class="text-faint">{status.rssi} dBm</span></dd>
            <dt class="text-muted">IP-Adresse</dt>
            <dd class="font-mono">{status.ip}</dd>
            <dt class="text-muted">Hostname</dt>
            <dd class="font-mono">{status.hostname}.local</dd>
            <dt class="text-muted">MAC</dt>
            <dd class="font-mono text-faint">{status.mac}</dd>
          </dl>
        ) : (
          <p class="text-sm text-muted">Nicht verbunden.</p>
        )}
      </div>

      {/* ── WLAN wechseln ──────────────────────────────────────────────── */}
      <div class="mb-4 space-y-3 rounded-lg border border-border bg-surface p-4">
        <div class="text-xs font-medium uppercase tracking-wider text-muted">WLAN wechseln</div>
        <button type="button" onClick={doScan} disabled={scanning}
          class="rounded-md border border-border bg-bg px-3 py-1.5 text-sm font-medium text-fg hover:bg-fg/5 disabled:opacity-50">
          {scanning ? 'Suche…' : 'Netzwerke suchen'}
        </button>
        {scanErr && <p class="text-sm text-red-600">{scanErr}</p>}
        {(nets.length > 0 || manual) && (
          <>
            <div>
              <div class="mb-1 text-xs text-muted">Netzwerk</div>
              {manual ? (
                <input type="text" value={selSsid} title="SSID" placeholder="Netzwerkname (SSID)"
                  autoComplete="off" autoCorrect="off" autoCapitalize="off" spellcheck={false}
                  onInput={(e) => setSelSsid((e.target as HTMLInputElement).value)}
                  class={inp} />
              ) : (
                <select value={selSsid} title="Netzwerk"
                  onChange={(e) => setSelSsid((e.target as HTMLSelectElement).value)}
                  class={inp}>
                  {nets.map((n) => (
                    <option key={n.ssid} value={n.ssid}>
                      {n.ssid} ({n.rssi} dBm){n.open ? ' · offen' : ''}
                    </option>
                  ))}
                </select>
              )}
              <button type="button"
                onClick={() => { setManual((m) => !m); setSelSsid(''); }}
                class="mt-1 text-xs text-faint underline hover:text-fg">
                {manual ? 'Aus Liste wählen' : 'Netzwerk manuell eingeben'}
              </button>
            </div>
            <div>
              <div class="mb-1 text-xs text-muted">Passwort</div>
              <input type="password" value={password} title="Passwort" placeholder="WLAN-Passwort"
                autoComplete="off"
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                class={inp} />
            </div>
            <button type="button" onClick={() => setSwitchOpen(true)} disabled={!ssid.trim()}
              class={btnPrimary}>
              Verbinden
            </button>
          </>
        )}
      </div>

      {/* ── Hostname ───────────────────────────────────────────────────── */}
      <div class="mb-4 space-y-2 rounded-lg border border-border bg-surface p-4">
        <div class="text-xs font-medium uppercase tracking-wider text-muted">Hostname</div>
        <div class="flex items-center gap-2">
          <input type="text" value={host} title="Hostname" placeholder="brewcontrol"
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellcheck={false}
            onInput={(e) => setHost((e.target as HTMLInputElement).value)}
            class={`${inp} font-mono`} />
          <span class="shrink-0 font-mono text-sm text-faint">.local</span>
        </div>
        {!hostValid && host.length > 0 && (
          <p class="text-xs text-red-600">Nur Kleinbuchstaben, Ziffern und Bindestriche (kein führender/abschließender Bindestrich), max. 32 Zeichen.</p>
        )}
        <button type="button" onClick={() => setHostOpen(true)} disabled={!hostValid || !hostChanged}
          class={btnPrimary}>
          Speichern
        </button>
      </div>

      {/* ── Zurücksetzen ───────────────────────────────────────────────── */}
      <div class="space-y-2 rounded-lg border border-border bg-surface p-4">
        <div class="text-xs font-medium uppercase tracking-wider text-muted">WLAN zurücksetzen</div>
        <p class="text-sm text-muted">
          Löscht die gespeicherten Zugangsdaten und startet das Gerät in den Setup-Modus.
        </p>
        <button type="button" onClick={() => setResetOpen(true)}
          class="rounded-md border border-red-600/40 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-600/10">
          WLAN zurücksetzen
        </button>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <ConfirmModal open={switchOpen} title="Netzwerk wechseln?"
        confirmLabel="Verbinden & Neustart" pending={pending}
        onCancel={() => { setSwitchOpen(false); setActErr(null); }}
        onConfirm={doSwitch}>
        <p>
          Das Gerät startet neu und verbindet sich mit
          <code class="mx-1 rounded bg-fg/10 px-1 font-mono">{ssid.trim()}</code>.
          Diese Oberfläche ist während des Wechsels kurz nicht erreichbar.
        </p>
        {actErr && <p class="mt-2 text-red-600">{actErr}</p>}
      </ConfirmModal>

      <ConfirmModal open={hostOpen} title="Hostname ändern?"
        confirmLabel="Speichern & Neustart" pending={pending}
        onCancel={() => { setHostOpen(false); setActErr(null); }}
        onConfirm={doHostname}>
        <p>
          Das Gerät startet neu und ist danach unter
          <code class="mx-1 rounded bg-fg/10 px-1 font-mono">{host.trim().toLowerCase()}.local</code>
          erreichbar.
        </p>
        {actErr && <p class="mt-2 text-red-600">{actErr}</p>}
      </ConfirmModal>

      <ConfirmModal open={resetOpen} title="WLAN-Zugangsdaten zurücksetzen?" destructive
        confirmLabel="Zurücksetzen & Neustart" pending={pending}
        onCancel={() => { setResetOpen(false); setActErr(null); }}
        onConfirm={doReset}>
        <p>
          Dies löscht die gespeicherten WLAN-Zugangsdaten und startet das Gerät neu in
          den Setup-Modus. Danach über
          <code class="mx-1 rounded bg-fg/10 px-1 font-mono">BrewControl-Setup</code>
          neu verbinden.
        </p>
        {actErr && <p class="mt-2 text-red-600">{actErr}</p>}
      </ConfirmModal>
    </div>
  );
}
