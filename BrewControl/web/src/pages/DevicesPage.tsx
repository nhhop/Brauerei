// BrewControl/web/src/pages/DevicesPage.tsx
import { useState } from 'preact/hooks';
import type { Snapshot, ItemConfig } from '../types';
import { deleteSensor, deleteActuator, deleteController, getConfig } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { AddItemModal } from '../components/AddItemModal';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup } from '../components/SettingsCard';
import { btnPrimary } from '../ui';
import { Pencil, X } from 'lucide-preact';

type Role = 'sensor' | 'actuator' | 'controller';

export function DevicesPage({ snap }: { snap: Snapshot | null; path?: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ role: Role; cfg: ItemConfig } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ role: Role; id: string } | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  async function startEdit(role: Role, id: string) {
    try {
      const config = await getConfig();
      const list = role === 'sensor' ? config.sensors
                 : role === 'actuator' ? config.actuators
                 : config.controllers;
      const cfg = list.find((c) => c.id === id);
      if (cfg) { setEditItem({ role, cfg }); setAddOpen(true); }
    } catch { /* ignore */ }
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

  return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      <header class="flex items-center justify-between gap-3">
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Geräte' }]} />
        <button type="button" onClick={() => setAddOpen(true)} class={btnPrimary}>
          + Hinzufügen
        </button>
      </header>

      <div class="mt-6 space-y-4">
        {!snap && <p class="text-sm text-muted">Laden…</p>}

        {sensors.length > 0 && (
          <SettingsGroup title="Sensoren">
            {sensors.map((s) => {
              const base = s.id.includes('.') ? s.id.split('.')[0] : s.id;
              return (
                <DeviceRow key={base} label={base} badge={s.meta.quantity}
                  onEdit={() => startEdit('sensor', base)}
                  onDelete={() => setDeleteTarget({ role: 'sensor', id: base })} />
              );
            })}
          </SettingsGroup>
        )}

        {snap && snap.controllers.length > 0 && (
          <SettingsGroup title="Regler">
            {snap.controllers.map((c) => (
              <DeviceRow key={c.id} label={c.id}
                badge={c.params?.sensor && c.params?.actuator
                  ? `${c.params.sensor} → ${c.params.actuator}`
                  : undefined}
                onEdit={() => startEdit('controller', c.id)}
                onDelete={() => setDeleteTarget({ role: 'controller', id: c.id })} />
            ))}
          </SettingsGroup>
        )}

        {snap && snap.actuators.length > 0 && (
          <SettingsGroup title="Aktoren">
            {snap.actuators.map((a) => (
              <DeviceRow key={a.id} label={a.id} badge={a.meta.kind}
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
    </div>
  );
}

function DeviceRow({ label, badge, onEdit, onDelete }: {
  label: string; badge?: string; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div class="flex items-center justify-between gap-3 rounded-md border border-card-border bg-card px-4 py-3 shadow-elev-2">
      <div class="flex min-w-0 items-center gap-2">
        <span class="truncate font-medium">{label}</span>
        {badge && (
          <span class="shrink-0 rounded bg-fg/10 px-1.5 py-0.5 text-xs text-muted">{badge}</span>
        )}
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <button type="button" onClick={onEdit} title="Bearbeiten"
          class="text-faint hover:text-fg"><Pencil size={14} /></button>
        <button type="button" onClick={onDelete} title="Löschen"
          class="text-faint hover:text-critical"><X size={16} /></button>
      </div>
    </div>
  );
}
