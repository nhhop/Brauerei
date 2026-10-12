import { useRef, useState } from 'preact/hooks';
import { downloadBackup, restoreBackup, saveJson } from '../api';
import { useModule } from '../optionalModules';
import { exportRecipes, importRecipes } from '../recipes';
import { ConfirmModal } from '../components/ConfirmModal';
import { ProgressBar } from '../components/ProgressBar';
import { ReloadRetry } from '../components/ReloadRetry';
import { PageShell } from '../components/PageShell';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { btnSecondary } from '../ui';
import { TriangleAlert, Download, Upload } from 'lucide-preact';

export function BackupPage(_: { path?: string }) {
  const hasRecipes = useModule('recipes');
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const clearFileInput = () => { if (fileRef.current) fileRef.current.value = ''; };

  if (done) {
    return (
      <ReloadRetry title="Neustart…"
        body="Konfiguration wiederhergestellt. Das Gerät startet neu."
        targetUrl={location.origin} />
    );
  }

  const confirmRestore = async () => {
    if (!pendingFile) return;
    setRestoring(true);
    setError(null);
    try {
      const text = await pendingFile.text();
      await restoreBackup(text);
      setDone(true);
    } catch (e) {
      setError(String(e));
      setRestoring(false);
      setPendingFile(null);
      clearFileInput();
    }
  };

  return (
    <PageShell>
      <header>
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Backup & Restore' }]} />
      </header>

      <div class="mt-6">
        <SettingsGroup>
          <SettingsCard title="Export" icon={Download}
            desc="Lädt die gesamte Konfiguration (Geräte, Dashboards, Einstellungen) als JSON-Datei herunter."
            control={
              <button onClick={() => downloadBackup().catch((e) => setError(String(e)))}
                disabled={restoring} class={btnSecondary}>
                Backup herunterladen
              </button>
            } />

          <SettingsCard title="Restore" icon={Upload} desc="Konfiguration aus einer Backup-Datei wiederherstellen."
            control={
              <button type="button" class={btnSecondary} onClick={() => fileRef.current?.click()}>
                Durchsuchen…
              </button>
            }>
            <div class="space-y-2">
              <div class="flex items-center gap-2 rounded-md border border-caution/40 bg-[color-mix(in_srgb,var(--caution)_12%,transparent)] px-3 py-2 text-sm text-caution">
                <TriangleAlert size={16} class="shrink-0" /> Überschreibt die komplette Konfiguration und startet das Gerät neu.
              </div>
              <input type="file" accept=".json,application/json" ref={fileRef}
                class="hidden"
                onChange={(e) => {
                  const f = (e.currentTarget as HTMLInputElement).files?.[0];
                  if (f) setPendingFile(f);
                }} />
              {error && <div class="text-sm text-critical">Fehler: {error}</div>}
            </div>
          </SettingsCard>
        </SettingsGroup>

        {hasRecipes && (
          <>
            <DocBackup what="Rezepte" one="Rezept" file="brewcontrol-recipes" exportFile={exportRecipes} importFile={importRecipes} />
            {/* brews.ts loads on use, so the main bundle of the small boards stays as it was */}
            <DocBackup what="Sude" one="Sud" file="brewcontrol-brews"
              exportFile={() => import('../brews').then((m) => m.exportBrews())}
              importFile={(text, onProgress) => import('../brews').then((m) => m.importBrews(text, onProgress))}
              note="Der Lagerbestand bleibt dabei unverändert." />
          </>
        )}
      </div>

      <ConfirmModal open={pendingFile !== null} title="Backup wiederherstellen?"
        confirmLabel="Wiederherstellen" cancelLabel="Abbrechen" destructive
        pending={restoring}
        onCancel={() => { if (!restoring) { setPendingFile(null); clearFileInput(); } }}
        onConfirm={confirmRestore}>
        Die Datei <span class="font-mono">{pendingFile?.name}</span> ersetzt die
        komplette Konfiguration. Das Gerät startet danach neu.
      </ConfirmModal>
    </PageShell>
  );
}

// Export and import of the documents the backup above leaves out (recipes,
// brews), one file each.
function DocBackup({ what, one, file, exportFile, importFile, note }: {
  what: string;   // "Rezepte"
  one: string;    // "Rezept"
  file: string;   // file name stem
  exportFile: () => Promise<string>;
  importFile: (text: string, onProgress: (done: number, total: number) => void) => Promise<number>;
  note?: string;  // appended to the import text
}) {
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setPending(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const download = async () => {
    setBusy(true);
    setMsg(null);
    try {
      saveJson(await exportFile(), `${file}-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (e) {
      setMsg({ ok: false, text: `Fehler: ${e}` });
    }
    setBusy(false);
  };

  const confirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    setProgress(0);
    try {
      const n = await importFile(await pending.text(),
        (done, total) => setProgress(total ? Math.round((done / total) * 100) : 100));
      setMsg({ ok: true, text: `${n} ${what} eingespielt.` });
    } catch (e) {
      setMsg({ ok: false, text: `Fehler: ${e}` });
    }
    setBusy(false);
    close();
  };

  return (
    <div class="mt-6">
      <SettingsGroup>
        <SettingsCard title={`${what} exportieren`} icon={Download}
          desc={`Das Backup oben enthält keine ${what}. Lädt alle ${what} der SD-Karte als eigene JSON-Datei herunter.`}
          control={
            <button onClick={download} disabled={busy} class={btnSecondary}>
              {what} herunterladen
            </button>
          } />
        <SettingsCard title={`${what} importieren`} icon={Upload}
          desc={`${what} aus einer ${one}-Datei zurückspielen. ${what} mit gleicher ID werden überschrieben, das Gerät startet nicht neu.${note ? ` ${note}` : ''}`}
          control={
            <button type="button" class={btnSecondary} disabled={busy}
              onClick={() => fileRef.current?.click()}>
              Durchsuchen…
            </button>
          }>
          <input type="file" accept=".json,application/json" ref={fileRef} class="hidden"
            onChange={(e) => {
              const f = (e.currentTarget as HTMLInputElement).files?.[0];
              if (f) { setMsg(null); setPending(f); }
            }} />
          {msg && (
            <div class={`text-sm ${msg.ok ? '' : 'text-critical'}`}>{msg.text}</div>
          )}
        </SettingsCard>
      </SettingsGroup>

      <ConfirmModal open={pending !== null} title={`${what} importieren?`}
        confirmLabel="Importieren" cancelLabel="Abbrechen"
        pending={busy}
        onCancel={() => { if (!busy) close(); }}
        onConfirm={confirmImport}>
        Die {what} aus <span class="font-mono">{pending?.name}</span> werden auf das Gerät
        geschrieben. {what} mit gleicher ID werden überschrieben.
        {busy && <div class="mt-3"><ProgressBar label="Import" pct={progress} /></div>}
      </ConfirmModal>
    </div>
  );
}
