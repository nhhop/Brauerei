import { useEffect, useState } from 'preact/hooks';
import type { Snapshot, AlarmConfig } from '../types';
import { getAlarms, createAlarm, updateAlarm, deleteAlarm, setAlarmEnabled, resolveRef } from '../api';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { Breadcrumb } from '../components/Breadcrumb';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { ConfirmModal } from '../components/ConfirmModal';
import { AlarmEditorModal } from '../components/AlarmEditorModal';
import { Fab } from '../components/Fab';
import { btnPrimary, badge, badgeAccent, badgeCaution, badgeCritical } from '../ui';
import { Pencil, Plus, Trash2, BellRing } from 'lucide-preact';

type SaveCfg = Pick<AlarmConfig, 'name' | 'enabled' | 'severity' | 'forSec' | 'cond'>;

const SEV_BADGE: Record<AlarmConfig['severity'], string> = {
  info: badgeAccent,
  warning: badgeCaution,
  critical: badgeCritical,
};

const SEV_LABEL: Record<AlarmConfig['severity'], string> = {
  info: 'Info',
  warning: 'Warnung',
  critical: 'Kritisch',
};

// "kettle.temp > 78" — the rule in one readable line.
function condText(a: AlarmConfig): string {
  const slash = a.cond.ref.indexOf('/');
  const who = slash < 0 ? a.cond.ref : a.cond.ref.slice(slash + 1);
  return `${who} ${a.cond.op === 'lt' ? '<' : '>'} ${a.cond.value}`;
}

export function AlarmsPage({ snap }: { snap: Snapshot | null; path?: string }) {
  const [alarms, setAlarms] = useState<AlarmConfig[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AlarmConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlarmConfig | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getAlarms().then(setAlarms).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  function toggleEnabled(a: AlarmConfig) {
    const next = !a.enabled;
    setAlarms((as) => as.map((x) => x.id === a.id ? { ...x, enabled: next } : x));
    setAlarmEnabled(a.id, next).catch(() => {});
  }

  async function save(cfg: SaveCfg) {
    if (editing) {
      await updateAlarm(editing.id, cfg);
      // The device resets the latch on update, so mirror that locally instead
      // of keeping a stale "active".
      setAlarms((as) => as.map((x) =>
        x.id === editing.id ? { ...x, ...cfg, active: false, since: 0 } : x));
    } else {
      const id = await createAlarm(cfg);
      setAlarms((as) => [...as, { ...cfg, id, active: false, since: 0, resolved: true }]);
    }
    setEditorOpen(false);
    setEditing(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAlarm(deleteTarget.id);
      setAlarms((as) => as.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PageShell>
      <header class="mb-6 flex items-center gap-3">
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Alarme' }]} />
        <span class="flex-1" />
        <button type="button" class={`${btnPrimary} hidden md:inline-flex`}
          onClick={() => { setEditing(null); setEditorOpen(true); }}>
          + Neuer Alarm
        </button>
      </header>

      <Fab icon={Plus} label="Neuer Alarm"
        onClick={() => { setEditing(null); setEditorOpen(true); }} />

      {!loaded ? (
        <SkeletonList count={2} />
      ) : alarms.length === 0 ? (
        <p class="text-sm text-muted">
          Noch keine Alarme. Ein Alarm überwacht einen Messwert und meldet sich,
          sobald er eine Grenze über- oder unterschreitet.
        </p>
      ) : (
        <div class="space-y-4">
          {alarms.map((a) => {
            const live = snap ? resolveRef(snap, a.cond.ref) : null;
            return (
              <div key={a.id}
                class="flex items-center gap-3 rounded-md border border-card-border bg-card p-4 shadow-elev-2">
                <BellRing size={18} class="shrink-0 text-muted" />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="truncate text-sm font-medium text-fg">{a.name}</span>
                    <span class={SEV_BADGE[a.severity]}>{SEV_LABEL[a.severity]}</span>
                    {a.active && <span class={badgeCritical}>Aktiv</span>}
                    {!a.resolved && a.enabled && (
                      <span class={badgeCaution} title={a.cond.ref}>Quelle fehlt</span>
                    )}
                  </div>
                  <p class="mt-0.5 text-xs text-muted">
                    {condText(a)}
                    {a.cond.hyst > 0 && ` · Hysterese ${a.cond.hyst}`}
                    {a.forSec > 0 && ` · ab ${a.forSec} s`}
                    {live !== null && (
                      <span class={`ml-2 ${badge} bg-fg/10 text-muted`}>aktuell {live}</span>
                    )}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2 text-xs">
                  <ToggleSwitch checked={a.enabled} onChange={() => toggleEnabled(a)} />
                  <button type="button" title="Bearbeiten"
                    onClick={() => { setEditing(a); setEditorOpen(true); }}
                    class="rounded border border-border px-2 py-1 text-muted transition-colors hover:bg-fg/10">
                    <Pencil size={14} />
                  </button>
                  <button type="button" title="Löschen" onClick={() => setDeleteTarget(a)}
                    class="rounded border border-border px-2 py-1 text-critical transition-colors hover:bg-fg/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlarmEditorModal open={editorOpen} snap={snap} initial={editing ?? undefined}
        onSave={save}
        onDelete={editing ? () => { const t = editing; setEditorOpen(false); setDeleteTarget(t); } : undefined}
        onClose={() => { setEditorOpen(false); setEditing(null); }} />

      <ConfirmModal open={!!deleteTarget} title="Alarm löschen?" destructive
        pending={deleting} confirmLabel="Löschen"
        onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)}>
        <p class="text-sm text-muted">
          „{deleteTarget?.name}" wird dauerhaft entfernt.
        </p>
      </ConfirmModal>
    </PageShell>
  );
}
