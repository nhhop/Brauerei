import { useRef, useState } from 'preact/hooks';
import { downloadBackup, restoreBackup } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { Breadcrumb } from '../components/Breadcrumb';
import { TriangleAlert } from 'lucide-preact';

export function BackupPage(_: { path?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const clearFileInput = () => { if (fileRef.current) fileRef.current.value = ''; };

  if (done) {
    return (
      <div class="flex min-h-full items-center justify-center bg-bg p-6 text-fg">
        <div class="max-w-md text-center">
          <h1 class="text-xl font-medium tracking-tight">Neustart…</h1>
          <p class="mt-3 text-sm text-muted">
            Konfiguration wiederhergestellt. Das Gerät startet neu — die Seite in
            ein paar Sekunden neu laden.
          </p>
        </div>
      </div>
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
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      <header>
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Backup & Restore' }]} />
      </header>

      <section class="mt-6 rounded-lg border border-border bg-surface p-4 space-y-2">
        <div class="font-medium">Export</div>
        <div class="text-sm text-muted">
          Lädt die gesamte Konfiguration (Geräte, Dashboards, Einstellungen) als
          JSON-Datei herunter.
        </div>
        <button onClick={() => downloadBackup().catch((e) => setError(String(e)))}
          disabled={restoring}
          class="rounded-md bg-fg/5 px-3 py-1.5 text-sm font-medium hover:bg-fg/10 disabled:opacity-50">
          Backup herunterladen
        </button>
      </section>

      <section class="mt-4 rounded-lg border border-border bg-surface p-4 space-y-2">
        <div class="font-medium">Restore</div>
        <div class="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <TriangleAlert size={16} class="shrink-0" /> Überschreibt die komplette Konfiguration und startet das Gerät neu.
        </div>
        <input type="file" accept=".json,application/json" ref={fileRef}
          class="mt-1 block w-full text-sm"
          onChange={(e) => {
            const f = (e.currentTarget as HTMLInputElement).files?.[0];
            if (f) setPendingFile(f);
          }} />
        {error && <div class="text-sm text-red-500">Fehler: {error}</div>}
      </section>

      <ConfirmModal open={pendingFile !== null} title="Backup wiederherstellen?"
        confirmLabel="Wiederherstellen" cancelLabel="Abbrechen" destructive
        pending={restoring}
        onCancel={() => { if (!restoring) { setPendingFile(null); clearFileInput(); } }}
        onConfirm={confirmRestore}>
        Die Datei <span class="font-mono">{pendingFile?.name}</span> ersetzt die
        komplette Konfiguration. Das Gerät startet danach neu.
      </ConfirmModal>
    </div>
  );
}
