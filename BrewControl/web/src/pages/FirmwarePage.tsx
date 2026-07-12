import { useEffect, useState, useRef } from 'preact/hooks';
import type { UpdateStatus } from '../types';
import {
  getUpdateStatus, checkUpdate, installUpdate,
  uploadFirmware, uploadAssets, updateSettings,
} from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { btnPrimary } from '../ui';
import { TriangleAlert } from 'lucide-preact';

export function FirmwarePage(_: { path?: string }) {
  const [st, setSt] = useState<UpdateStatus | null>(null);
  const [confirmInstall, setConfirmInstall] = useState(false);
  const [fwPct, setFwPct] = useState<number | null>(null);
  const [tarPct, setTarPct] = useState<number | null>(null);
  const poll = useRef<number | null>(null);

  const refresh = () => getUpdateStatus().then(setSt).catch(() => {});

  useEffect(() => {
    refresh();
    poll.current = window.setInterval(refresh, 1500);
    return () => { if (poll.current) clearInterval(poll.current); };
  }, []);

  if (!st) return <div class="min-h-full bg-bg p-6 text-fg">Lädt…</div>;

  const busy = ['checking', 'downloading', 'flashing'].includes(st.state);
  const channel = st.channel;

  const setChannel = (c: 'stable' | 'preview') =>
    updateSettings({ firmware: { channel: c, autoCheck: st.autoCheck } }).then(refresh);
  const setAuto = (a: boolean) =>
    updateSettings({ firmware: { channel, autoCheck: a } }).then(refresh);

  return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      <header>
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Firmware-Update' }]} />
      </header>

      <div class="mt-4 flex items-center gap-2 rounded-md border border-caution/40 bg-[color-mix(in_srgb,var(--caution)_12%,transparent)] px-4 py-3 text-sm text-caution">
        <TriangleAlert size={16} class="shrink-0" /> Nicht während eines laufenden Brauvorgangs aktualisieren — das Gerät startet neu.
      </div>

      <div class="mt-6">
        <SettingsGroup>
          <SettingsCard title="Aktuelle Version"
            control={<span class="font-mono text-sm">{st.currentVersion} · {st.variant}</span>} />

          <SettingsCard title="Server-Update (GitHub)" desc="Kanal wählen und auf neue Releases prüfen">
            <div class="space-y-3">
              <div class="flex gap-2">
                {(['stable', 'preview'] as const).map((c) => (
                  <button key={c} onClick={() => setChannel(c)} disabled={busy}
                    class={`rounded-md px-3 py-1.5 text-sm ${channel === c
                      ? 'bg-accent text-accent-fg' : 'bg-fg/5 text-fg hover:bg-fg/10'}`}>
                    {c}
                  </button>
                ))}
              </div>
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={st.autoCheck} class="accent-accent"
                  onChange={(e) => setAuto((e.target as HTMLInputElement).checked)} />
                Täglich automatisch auf Updates prüfen
              </label>

              <button onClick={() => checkUpdate(channel).then(refresh)} disabled={busy}
                class="rounded-md bg-fg/5 px-3 py-1.5 text-sm font-medium hover:bg-fg/10 disabled:opacity-50">
                {st.state === 'checking' ? 'Prüfe…' : 'Auf Updates prüfen'}
              </button>

              {st.available && (
                <div class="rounded-md bg-fg/5 p-3 text-sm">
                  <div>Verfügbar: <span class="font-mono">{st.available.version}</span></div>
                  {st.available.notes && <pre class="mt-1 whitespace-pre-wrap text-xs text-muted">{st.available.notes}</pre>}
                  {st.state === 'updateAvailable' && (
                    <button onClick={() => setConfirmInstall(true)} class={`mt-2 ${btnPrimary}`}>
                      Installieren
                    </button>
                  )}
                </div>
              )}

              {(st.state === 'downloading' || st.state === 'flashing') && (
                <ProgressBar label={st.state === 'downloading' ? 'Lade…' : 'Flashe…'} pct={st.progress} />
              )}
              {st.state === 'error' && <div class="text-sm text-critical">Fehler: {st.error}</div>}
            </div>
          </SettingsCard>

          <SettingsCard title="Manueller Upload" desc="Firmware- oder UI-Paket direkt hochladen">
            <div class="space-y-4">
              <FileUpload label="Firmware (.bin)" accept=".bin" pct={fwPct}
                onPick={(f) => { setFwPct(0); uploadFirmware(f, setFwPct).then(() => setFwPct(100)).catch(() => setFwPct(null)); }} />
              <FileUpload label="UI-Paket (.tar)" accept=".tar" pct={tarPct}
                onPick={(f) => { setTarPct(0); uploadAssets(f, setTarPct).then(() => setTarPct(100)).catch(() => setTarPct(null)); }} />
            </div>
          </SettingsCard>
        </SettingsGroup>
      </div>

      <ConfirmModal open={confirmInstall} title="Update installieren?"
        confirmLabel="Installieren" cancelLabel="Abbrechen" destructive
        onCancel={() => setConfirmInstall(false)}
        onConfirm={() => { setConfirmInstall(false); installUpdate(channel).then(refresh); }}>
        Firmware <span class="font-mono">{st.available?.version}</span> wird geflasht und das Gerät startet neu.
      </ConfirmModal>
    </div>
  );
}

function ProgressBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div class="text-xs text-muted">{label} {pct}%</div>
      <div class="mt-1 h-2 rounded bg-fg/10">
        <div class="h-2 rounded bg-fg" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FileUpload({ label, accept, pct, onPick }: {
  label: string; accept: string; pct: number | null; onPick: (f: File) => void;
}) {
  return (
    <div>
      <label class="text-sm">{label}</label>
      <input type="file" accept={accept} class="mt-1 block w-full text-sm"
        onChange={(e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) onPick(f);
        }} />
      {pct !== null && <ProgressBar label="Upload" pct={pct} />}
    </div>
  );
}
