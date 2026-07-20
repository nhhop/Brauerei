import { useEffect, useState, useRef } from 'preact/hooks';
import type { UpdateStatus } from '../types';
import {
  getUpdateStatus, checkUpdate, installUpdate,
  uploadFirmware, uploadAssets, updateSettings,
} from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { Segmented } from '../components/Segmented';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { btnPrimary, btnSecondary } from '../ui';
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
            desc={<span class="font-mono">{st.currentVersion} · {st.variant}</span>}
            control={
              <button onClick={() => checkUpdate(channel).then(refresh)} disabled={busy}
                class={btnSecondary}>
                {st.state === 'checking' ? 'Prüfe…' : 'Auf Updates prüfen'}
              </button>
            } />

          <SettingsCard title="Server-Update (GitHub)" desc="Kanal wählen und auf neue Releases prüfen"
            control={
              <Segmented value={channel} disabled={busy}
                options={[{ value: 'stable', label: 'Stabil' }, { value: 'preview', label: 'Vorschau' }]}
                onChange={setChannel} />
            }>
            <div class="space-y-3">
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

          <SettingsCard title="Automatisch prüfen" desc="Täglich auf neue Releases prüfen"
            control={<ToggleSwitch checked={st.autoCheck} disabled={busy} onChange={setAuto}
              title="Automatische Update-Prüfung" />} />

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
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  return (
    <div>
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-medium">{label}</div>
          <div class="truncate text-xs text-muted">{name ?? 'Keine Datei ausgewählt'}</div>
        </div>
        <button type="button" class={`shrink-0 ${btnSecondary}`} onClick={() => ref.current?.click()}>
          Durchsuchen…
        </button>
        <input ref={ref} type="file" accept={accept} class="hidden"
          onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) { setName(f.name); onPick(f); }
          }} />
      </div>
      {pct !== null && <ProgressBar label="Upload" pct={pct} />}
    </div>
  );
}
