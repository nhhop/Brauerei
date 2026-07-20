import { useEffect, useState } from 'preact/hooks';
import type { Snapshot, LogConfig } from '../types';
import { getLogs, createLog, updateLog, deleteLog, logDownloadUrl, setLogEnabled, clearLog } from '../api';

type SaveCfg = Omit<LogConfig, 'id' | 'session'>;
import { ChartCard } from '../components/ChartCard';
import { LogEditorModal } from '../components/LogEditorModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Breadcrumb } from '../components/Breadcrumb';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { btnPrimary } from '../ui';
import { Pencil, Trash2 } from 'lucide-preact';

export function LogsPage({ snap }: { snap: Snapshot | null; path?: string }) {
  const [logs, setLogs] = useState<LogConfig[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LogConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LogConfig | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Bumped per log to force a ChartCard remount (re-hydrate) after Clear.
  const [versions, setVersions] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    getLogs().then(setLogs).catch(() => {});
  }, []);

  function toggleEnabled(log: LogConfig) {
    const next = !log.enabled;
    setLogs((ls) => ls.map((l) => l.id === log.id ? { ...l, enabled: next } : l));
    setLogEnabled(log.id, next).catch(() => {});
  }

  async function doClear(log: LogConfig) {
    await clearLog(log.id);
    setVersions((v) => new Map(v).set(log.id, (v.get(log.id) ?? 0) + 1));
  }

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
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      <header class="mb-6 flex items-center justify-between gap-3">
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Logs & Charts' }]} />
        <button type="button" onClick={() => { setEditing(null); setEditorOpen(true); }}
          class={btnPrimary}>
          + Neues Log
        </button>
      </header>

      {logs.length === 0 ? (
        <p class="text-sm text-muted">Noch keine Logs. Lege eines an, um Werte aufzuzeichnen und als Chart anzuzeigen.</p>
      ) : (
        <div class="space-y-4">
          {logs.map((log) => (
            <div key={log.id} class="rounded-md border border-card-border bg-card p-4 shadow-elev-2">
              <div class="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div class="font-medium">{log.name}</div>
                  <div class="text-xs text-muted">
                    {log.intervalSec}s · {log.series.length} Serie{log.series.length === 1 ? '' : 'n'}
                    {log.algo !== 'none' && ` · ${log.algo === 'swingingdoor' ? 'Swinging Door' : 'Linear'}`}
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-2 text-xs">
                  {log.bindEnableTo ? (
                    <span class="rounded-md border border-border px-2 py-1 text-faint"
                      title={`Logging folgt Regler ${log.bindEnableTo}`}>
                      ⛓ {log.bindEnableTo}
                    </span>
                  ) : (
                    <span class="flex items-center gap-1.5">
                      <ToggleSwitch checked={log.enabled}
                        title={log.enabled ? 'Aufzeichnung stoppen' : 'Aufzeichnung starten'}
                        onChange={() => toggleEnabled(log)} />
                      <span class={log.enabled ? 'text-fg' : 'text-muted'}>Aktiv</span>
                    </span>
                  )}
                  <a href={`/settings/logs/${log.id}/archive`}
                    class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
                    Archiv
                  </a>
                  <button type="button" onClick={() => doClear(log)}
                    class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10"
                    title="Aktuelle Aufzeichnung abschließen, neue Session beginnen">
                    Clear
                  </button>
                  <a href={logDownloadUrl(log.id)}
                    class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
                    CSV
                  </a>
                  <button type="button" onClick={() => { setEditing(log); setEditorOpen(true); }}
                    class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(log)}
                    class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <ChartCard key={versions.get(log.id) ?? 0} log={log} snap={snap} />
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
