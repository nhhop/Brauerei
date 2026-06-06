import { useEffect, useState } from 'preact/hooks';
import type { Snapshot, LogConfig } from '../types';
import { getLogs, createLog, updateLog, deleteLog, logDownloadUrl } from '../api';

type SaveCfg = Omit<LogConfig, 'id' | 'session'>;
import { ChartCard } from '../components/ChartCard';
import { LogEditorModal } from '../components/LogEditorModal';
import { ConfirmModal } from '../components/ConfirmModal';

export function LogsPage({ snap }: { snap: Snapshot | null; path?: string }) {
  const [logs, setLogs] = useState<LogConfig[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LogConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LogConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getLogs().then(setLogs).catch(() => {});
  }, []);

  async function save(cfg: SaveCfg) {
    if (editing) {
      await updateLog(editing.id, cfg);
      setLogs((ls) => ls.map((l) => l.id === editing.id ? { ...l, ...cfg } : l));
    } else {
      const id = await createLog(cfg);
      setLogs((ls) => [...ls, { id, ...cfg }]);
    }
    setEditorOpen(false);
    setEditing(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLog(deleteTarget.id);
      setLogs((ls) => ls.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <header class="mb-6 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <a href="/settings" class="text-lg leading-none text-faint hover:text-fg">←</a>
          <h1 class="text-xl font-medium tracking-tight">Logs &amp; Charts</h1>
        </div>
        <button type="button" onClick={() => { setEditing(null); setEditorOpen(true); }}
          class="rounded-md bg-fg px-3 py-1.5 text-sm text-bg hover:bg-fg/80">
          + Neues Log
        </button>
      </header>

      {logs.length === 0 ? (
        <p class="text-sm text-muted">Noch keine Logs. Lege eines an, um Werte aufzuzeichnen und als Chart anzuzeigen.</p>
      ) : (
        <div class="space-y-4">
          {logs.map((log) => (
            <div key={log.id} class="rounded-lg border border-border bg-surface p-4">
              <div class="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div class="font-medium">{log.name}</div>
                  <div class="text-xs text-muted">
                    {log.intervalSec}s · {log.series.length} Serie{log.series.length === 1 ? '' : 'n'}
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-2 text-xs">
                  <a href={logDownloadUrl(log.id)}
                    class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
                    CSV
                  </a>
                  <button type="button" onClick={() => { setEditing(log); setEditorOpen(true); }}
                    class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
                    ✎
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(log)}
                    class="rounded-md border border-border px-2 py-1 text-red-500 hover:bg-fg/10">
                    🗑
                  </button>
                </div>
              </div>
              <ChartCard log={log} snap={snap} />
            </div>
          ))}
        </div>
      )}

      <LogEditorModal open={editorOpen} snap={snap} initial={editing ?? undefined}
        onSave={save} onClose={() => { setEditorOpen(false); setEditing(null); }} />

      <ConfirmModal open={!!deleteTarget} title="Log löschen?" destructive
        confirmLabel="Löschen" cancelLabel="Abbrechen" pending={deleting}
        onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete}>
        <p>
          Die Konfiguration „{deleteTarget?.name}" wird entfernt. Bereits aufgezeichnete
          CSV-Dateien bleiben auf der SD-Karte erhalten.
        </p>
      </ConfirmModal>
    </div>
  );
}
