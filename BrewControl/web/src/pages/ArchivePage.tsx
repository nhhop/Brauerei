import { useEffect, useState } from 'preact/hooks';
import type { LogConfig, LogSession, TimeSettings } from '../types';
import { getLogs, getLogSessions, deleteLogSession, logDownloadUrl, getSettings } from '../api';
import { ChartCard } from '../components/ChartCard';
import { formatDateTime } from '../time';
import { Breadcrumb } from '../components/Breadcrumb';
import { Trash2 } from 'lucide-preact';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ArchivePage({ id }: { id?: string; path?: string }) {
  const [log, setLog] = useState<LogConfig | null>(null);
  const [sessions, setSessions] = useState<LogSession[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [time, setTime] = useState<TimeSettings | undefined>(undefined);

  function refresh() {
    if (!id) return;
    getLogSessions(id)
      .then((ss) => setSessions([...ss].sort((a, b) => b.start - a.start)))
      .catch(() => {});
  }

  useEffect(() => {
    if (!id) return;
    getLogs().then((ls) => setLog(ls.find((l) => l.id === id) ?? null)).catch(() => {});
    getSettings().then((s) => setTime(s.time)).catch(() => {});
    refresh();
  }, [id]);

  async function remove(start: number) {
    if (!id) return;
    await deleteLogSession(id, start);
    if (selected === start) setSelected(null);
    refresh();
  }

  return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      <header class="mb-6">
        <Breadcrumb trail={[
          { label: 'Einstellungen', href: '/settings' },
          { label: 'Logs & Charts', href: '/settings/logs' },
          { label: `Archiv${log ? ` · ${log.name}` : ''}` },
        ]} />
      </header>

      {sessions.length === 0 ? (
        <p class="text-sm text-muted">Noch keine Sessions aufgezeichnet.</p>
      ) : (
        <div class="space-y-2">
          {sessions.map((s) => (
            <div key={s.start}
              class="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5">
              <div class="min-w-0">
                <div class="truncate text-sm">
                  {formatDateTime(s.start, time)}
                  {s.active && <span class="ml-2 rounded-full bg-green-600 px-2 py-0.5 text-xs text-white">aktiv</span>}
                </div>
                <div class="text-xs text-muted">{fmtSize(s.size)}</div>
              </div>
              <div class="flex shrink-0 items-center gap-2 text-xs">
                <button type="button"
                  onClick={() => setSelected(selected === s.start ? null : s.start)}
                  class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
                  {selected === s.start ? 'Schließen' : 'Ansehen'}
                </button>
                <a href={logDownloadUrl(id!, s.start)}
                  class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
                  CSV
                </a>
                {!s.active && (
                  <button type="button" onClick={() => remove(s.start)}
                    class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {log && selected !== null && (
        <div class="mt-4 rounded-lg border border-border bg-surface p-4 shadow-elev-2 transition-shadow duration-200 hover:shadow-elev-8">
          <div class="mb-2 text-sm font-medium">{formatDateTime(selected, time)}</div>
          <ChartCard log={log} snap={null} session={selected} />
        </div>
      )}
    </div>
  );
}
