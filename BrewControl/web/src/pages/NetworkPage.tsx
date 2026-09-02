// BrewControl/web/src/pages/NetworkPage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { NetworkStatus, ScanNetwork } from '../types';
import { getNetwork, scanNetworks, setNetwork, setHostname, wifiReset } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageShell } from '../components/PageShell';
import { Spinner } from '../components/Spinner';
import { SkeletonList } from '../components/Skeleton';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { btnPrimary, btnSecondary, inp } from '../ui';
import { Signal, Wifi, Tag, RotateCcw } from 'lucide-preact';

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

  // WLAN-Wechsel — Liste statt Dropdown. `expanded` ist entweder die SSID der
  // aufgeklappten Zeile (Passwort-Eingabe) oder das Sentinel 'manual' für die
  // freie Eingabe (verstecktes Netz / Scan fehlgeschlagen).
  const [nets, setNets] = useState<ScanNetwork[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [manualSsid, setManualSsid] = useState('');
  const [password, setPassword] = useState('');
  const [switchOpen, setSwitchOpen] = useState(false);
  const ssid = expanded === 'manual' ? manualSsid : (expanded ?? '');

  function selectNet(netSsid: string) {
    setExpanded((cur) => (cur === netSsid ? null : netSsid));
    setPassword('');
  }

  function toggleManual() {
    setExpanded((cur) => (cur === 'manual' ? null : 'manual'));
    setPassword('');
    setManualSsid('');
  }

  async function doScan() {
    setScanning(true);
    setScanErr(null);
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
    } catch (e) {
      setScanErr(`${e} — du kannst den Namen unten manuell eintragen.`);
      setExpanded('manual');   // scan failed → fall back to free-text SSID entry
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

  const header = (
    <header class="mb-6">
      <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Netzwerk' }]} />
    </header>
  );

  if (loading) return <PageShell>{header}<SkeletonList count={4} /></PageShell>;

  return (
    <PageShell>
      {header}

      <SettingsGroup>
        {/* ── Status ─────────────────────────────────────────────────── */}
        <SettingsCard title="Status" icon={Signal}>
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
        </SettingsCard>

        {/* ── WLAN wechseln ──────────────────────────────────────────── */}
        <SettingsCard title="WLAN wechseln" icon={Wifi}
          control={
            <button type="button" onClick={doScan} disabled={scanning} class={btnSecondary}>
              {scanning ? <><Spinner size={14} class="mr-1.5 -mt-0.5" />Suche…</> : 'Netzwerke suchen'}
            </button>
          }>
          {(scanErr || nets.length > 0 || expanded === 'manual') && (
            <div class="space-y-1">
              {scanErr && <p class="mb-2 text-sm text-critical">{scanErr}</p>}

              <div class="-mx-2 space-y-1">
                {nets.map((n) => {
                  const isConnected = status?.connected && status.ssid === n.ssid;
                  const isExpanded = expanded === n.ssid;
                  return (
                    <div key={n.ssid}
                      class={`rounded-md transition-colors ${
                        isExpanded ? 'bg-subtle-pressed' : 'hover:bg-subtle-hover active:bg-subtle-pressed'
                      }`}>
                      <button type="button" onClick={() => selectNet(n.ssid)}
                        class="relative flex w-full items-center gap-3 px-2 py-2 text-left text-sm">
                        {isExpanded && (
                          <span class="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent" />
                        )}
                        <SignalBars rssi={n.rssi} />
                        <span class="min-w-0 flex-1">
                          <span class="block truncate font-medium">{n.ssid}</span>
                          <span class={`block text-xs ${isConnected ? 'text-success' : 'text-muted'}`}>
                            {isConnected ? 'Verbunden' : n.open ? 'Offen' : 'Gesichert'}
                          </span>
                        </span>
                      </button>
                      {isExpanded && !isConnected && (
                        <div class="flex items-center gap-2 py-1 pr-2 pl-[42px]">
                          <input type="password" value={password} title="Passwort"
                            placeholder={n.open ? 'Kein Passwort nötig' : 'WLAN-Passwort'}
                            autoComplete="off"
                            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                            class={`${inp} flex-1`} />
                          <button type="button" onClick={() => setSwitchOpen(true)} class={btnPrimary}>
                            Verbinden
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={toggleManual}
                class="mt-1 text-xs text-faint underline hover:text-fg">
                {expanded === 'manual' ? 'Abbrechen' : 'Netzwerk manuell eingeben'}
              </button>
              {expanded === 'manual' && (
                <div class="space-y-2 pt-1">
                  <input type="text" value={manualSsid} title="SSID" placeholder="Netzwerkname (SSID)"
                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellcheck={false}
                    onInput={(e) => setManualSsid((e.target as HTMLInputElement).value)}
                    class={inp} />
                  <div class="flex items-center gap-2">
                    <input type="password" value={password} title="Passwort" placeholder="WLAN-Passwort"
                      autoComplete="off"
                      onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                      class={`${inp} flex-1`} />
                    <button type="button" onClick={() => setSwitchOpen(true)} disabled={!manualSsid.trim()}
                      class={btnPrimary}>
                      Verbinden
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SettingsCard>

        {/* ── mDNS ───────────────────────────────────────────────────── */}
        <SettingsCard title="mDNS" icon={Tag} desc="Name vergeben, unter dem das Gerät gefunden werden kann">
          <div class="flex items-center justify-between gap-3 pl-9">
            <div class="flex items-center gap-2">
              <input type="text" value={host} title="Hostname" placeholder="brewcontrol"
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellcheck={false}
                onInput={(e) => setHost((e.target as HTMLInputElement).value)}
                class={`${inp} w-40 font-mono`} />
              <span class="shrink-0 font-mono text-sm text-faint">.local</span>
            </div>
            <button type="button" onClick={() => setHostOpen(true)} disabled={!hostValid || !hostChanged}
              class={btnPrimary}>
              Speichern
            </button>
          </div>
          {!hostValid && host.length > 0 && (
            <p class="mt-2 pl-9 text-xs text-critical">Nur Kleinbuchstaben, Ziffern und Bindestriche (kein führender/abschließender Bindestrich), max. 32 Zeichen.</p>
          )}
        </SettingsCard>

        {/* ── Zurücksetzen ───────────────────────────────────────────── */}
        <SettingsCard title="WLAN zurücksetzen" icon={RotateCcw}
          desc="Löscht die gespeicherten Zugangsdaten und startet das Gerät in den Setup-Modus."
          control={
            <button type="button" onClick={() => setResetOpen(true)}
              class="rounded-md border border-critical/40 px-3 py-1.5 text-sm font-medium text-critical hover:bg-critical/10">
              WLAN zurücksetzen
            </button>
          } />
      </SettingsGroup>

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
        {actErr && <p class="mt-2 text-critical">{actErr}</p>}
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
        {actErr && <p class="mt-2 text-critical">{actErr}</p>}
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
        {actErr && <p class="mt-2 text-critical">{actErr}</p>}
      </ConfirmModal>
    </PageShell>
  );
}
