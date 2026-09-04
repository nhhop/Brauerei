// BrewControl/web/src/pages/DevicesPage.tsx
import { useState } from 'preact/hooks';
import type { Snapshot, ItemConfig } from '../types';
import { deleteSensor, deleteActuator, deleteController, getConfig } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { Spinner } from '../components/Spinner';
import { AddItemModal } from '../components/AddItemModal';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { Fab } from '../components/Fab';
import { btnPrimary } from '../ui';
import { Pencil, Plus, X, Gauge, SlidersHorizontal, Zap, type LucideIcon } from 'lucide-preact';

type Role = 'sensor' | 'actuator' | 'controller';

// WinUI subtle button — 32px square hit area, no fill at rest.
const iconBtn =
  'flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors ' +
  'hover:bg-subtle-hover active:bg-subtle-pressed disabled:opacity-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function DevicesPage({ snap }: { snap: Snapshot | null; path?: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ role: Role; cfg: ItemConfig } | null>(null);
  const [editPending, setEditPending] = useState<string | null>(null);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ role: Role; id: string } | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  async function startEdit(role: Role, id: string) {
    setEditPending(id);
    setEditErr(null);
    try {
      const config = await getConfig();
      const list = role === 'sensor' ? config.sensors
                 : role === 'actuator' ? config.actuators
                 : config.controllers;
      const cfg = list.find((c) => c.id === id);
      if (cfg) { setEditItem({ role, cfg }); setAddOpen(true); }
      else setEditErr(`Keine gespeicherte Konfiguration für „${id}“ gefunden.`);
    } catch (e) {
      setEditErr(String(e));
    } finally {
      setEditPending(null);
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setDeletePending(true);
    setDeleteErr(null);
    try {
      if (deleteTarget.role === 'sensor') await deleteSensor(deleteTarget.id);
      else if (deleteTarget.role === 'actuator') await deleteActuator(deleteTarget.id);
      else await deleteController(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteErr(String(e));
    }
    setDeletePending(false);
  }

  const sensors = snap ? snap.sensors.filter((s, i, arr) => {
    const base = s.id.includes('.') ? s.id.split('.')[0] : s.id;
    return arr.findIndex((x) => (x.id.includes('.') ? x.id.split('.')[0] : x.id) === base) === i;
  }) : [];

  const empty = snap != null && sensors.length === 0
    && snap.controllers.length === 0 && snap.actuators.length === 0;

  return (
    <PageShell>
      <header class="flex items-center justify-between gap-3">
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Geräte' }]} />
        <button type="button" onClick={() => setAddOpen(true)} class={`${btnPrimary} hidden md:inline-flex`}>
          + Hinzufügen
        </button>
      </header>
      <Fab icon={Plus} label="Hinzufügen" onClick={() => setAddOpen(true)} />

      <div class="mt-6 space-y-4">
        {!snap && <SkeletonList count={3} />}
        {editErr && <p class="text-sm text-critical">{editErr}</p>}
        {empty && (
          <p class="text-sm text-muted">
            Noch keine Geräte konfiguriert — über „+ Hinzufügen“ anlegen.
          </p>
        )}

        {sensors.length > 0 && (
          <SettingsGroup title="Sensoren">
            {sensors.map((s) => {
              const base = s.id.includes('.') ? s.id.split('.')[0] : s.id;
              return (
                <DeviceRow key={base} label={base} badge={s.meta.quantity} icon={Gauge}
                  editing={editPending === base}
                  onEdit={() => startEdit('sensor', base)}
                  onDelete={() => setDeleteTarget({ role: 'sensor', id: base })} />
              );
            })}
          </SettingsGroup>
        )}

        {snap && snap.controllers.length > 0 && (
          <SettingsGroup title="Regler">
            {snap.controllers.map((c) => (
              <DeviceRow key={c.id} label={c.id} icon={SlidersHorizontal}
                badge={c.params?.sensor && c.params?.actuator
                  ? `${c.params.sensor} → ${c.params.actuator}`
                  : undefined}
                editing={editPending === c.id}
                onEdit={() => startEdit('controller', c.id)}
                onDelete={() => setDeleteTarget({ role: 'controller', id: c.id })} />
            ))}
          </SettingsGroup>
        )}

        {snap && snap.actuators.length > 0 && (
          <SettingsGroup title="Aktoren">
            {snap.actuators.map((a) => (
              <DeviceRow key={a.id} label={a.id} badge={a.meta.kind} icon={Zap}
                editing={editPending === a.id}
                onEdit={() => startEdit('actuator', a.id)}
                onDelete={() => setDeleteTarget({ role: 'actuator', id: a.id })} />
            ))}
          </SettingsGroup>
        )}
      </div>

      <ConfirmModal open={deleteTarget !== null}
        title={`"${deleteTarget?.id}" löschen?`}
        destructive confirmLabel="Löschen" pending={deletePending}
        onCancel={() => { setDeleteTarget(null); setDeleteErr(null); }}
        onConfirm={doDelete}>
        <p>Das Item wird dauerhaft entfernt und die SD-Konfiguration aktualisiert.</p>
        {deleteErr && <p class="mt-2 text-critical">{deleteErr}</p>}
      </ConfirmModal>

      <AddItemModal open={addOpen} snap={snap}
        onClose={() => { setAddOpen(false); setEditItem(null); }}
        editConfig={editItem?.cfg}
        editRole={editItem?.role} />
    </PageShell>
  );
}

function DeviceRow({ label, badge, icon, editing, onEdit, onDelete }: {
  label: string; badge?: string; icon: LucideIcon; editing: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  return (
    <SettingsCard icon={icon} title={label} desc={badge} chevron={false}
      control={
        <div class="flex items-center gap-1">
          <button type="button" onClick={onEdit} disabled={editing} title="Bearbeiten"
            class={`${iconBtn} hover:text-fg`}>
            {editing ? <Spinner size={14} /> : <Pencil size={14} />}
          </button>
          <button type="button" onClick={onDelete} title="Löschen"
            class={`${iconBtn} hover:text-critical`}>
            <X size={16} />
          </button>
        </div>
      } />
  );
}
