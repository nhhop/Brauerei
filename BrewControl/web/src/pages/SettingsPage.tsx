import { useState } from 'preact/hooks';
import type { Snapshot, ItemConfig } from '../types';
import { deleteSensor, deleteActuator, deleteController, getConfig } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { AddItemModal } from '../components/AddItemModal';

type Role = 'sensor' | 'actuator' | 'controller';

export function SettingsPage({ snap }: { snap: Snapshot | null; path?: string }) {
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
      const cfg = list.find(c => c.id === id);
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

  // Deduplicate multi-channel sensors (e.g. temp.0 + temp.1 → temp)
  const sensors = snap ? snap.sensors.filter((s, i, arr) => {
    const base = s.id.includes('.') ? s.id.split('.')[0] : s.id;
    return arr.findIndex(x => (x.id.includes('.') ? x.id.split('.')[0] : x.id) === base) === i;
  }) : [];

  return (
    <div class="min-h-screen bg-stone-50 p-4 text-stone-900 md:p-6">
      <header class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <a href="/" class="text-lg leading-none text-stone-500 hover:text-stone-900">←</a>
          <h1 class="text-xl font-medium tracking-tight">Einstellungen</h1>
        </div>
        <button type="button" onClick={() => setAddOpen(true)}
          class="rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700">
          + Hinzufügen
        </button>
      </header>

      <div class="mt-6 space-y-6">
        {!snap && <p class="text-sm text-stone-500">Laden…</p>}

        {sensors.length > 0 && (
          <section>
            <h2 class="mb-2 text-sm font-medium uppercase tracking-wider text-stone-500">Sensoren</h2>
            <div class="space-y-2">
              {sensors.map(s => {
                const base = s.id.includes('.') ? s.id.split('.')[0] : s.id;
                return (
                  <DeviceRow key={base} label={base} badge={s.meta.quantity}
                    onEdit={() => startEdit('sensor', base)}
                    onDelete={() => setDeleteTarget({ role: 'sensor', id: base })} />
                );
              })}
            </div>
          </section>
        )}

        {snap && snap.controllers.length > 0 && (
          <section>
            <h2 class="mb-2 text-sm font-medium uppercase tracking-wider text-stone-500">Regler</h2>
            <div class="space-y-2">
              {snap.controllers.map(c => (
                <DeviceRow key={c.id} label={c.id}
                  badge={c.params?.sensor && c.params?.actuator
                    ? `${c.params.sensor} → ${c.params.actuator}`
                    : undefined}
                  onEdit={() => startEdit('controller', c.id)}
                  onDelete={() => setDeleteTarget({ role: 'controller', id: c.id })} />
              ))}
            </div>
          </section>
        )}

        {snap && snap.actuators.length > 0 && (
          <section>
            <h2 class="mb-2 text-sm font-medium uppercase tracking-wider text-stone-500">Aktoren</h2>
            <div class="space-y-2">
              {snap.actuators.map(a => (
                <DeviceRow key={a.id} label={a.id} badge={a.meta.kind}
                  onEdit={() => startEdit('actuator', a.id)}
                  onDelete={() => setDeleteTarget({ role: 'actuator', id: a.id })} />
              ))}
            </div>
          </section>
        )}
      </div>

      <ConfirmModal open={deleteTarget !== null}
        title={`"${deleteTarget?.id}" löschen?`}
        destructive confirmLabel="Löschen" pending={deletePending}
        onCancel={() => { setDeleteTarget(null); setDeleteErr(null); }}
        onConfirm={doDelete}>
        <p>Das Item wird dauerhaft entfernt und die SD-Konfiguration aktualisiert.</p>
        {deleteErr && <p class="mt-2 text-red-600">{deleteErr}</p>}
      </ConfirmModal>

      <AddItemModal
        open={addOpen}
        snap={snap}
        onClose={() => { setAddOpen(false); setEditItem(null); }}
        editConfig={editItem?.cfg}
        editRole={editItem?.role}
      />
    </div>
  );
}

function DeviceRow({ label, badge, onEdit, onDelete }: {
  label: string;
  badge?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div class="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
      <div class="flex min-w-0 items-center gap-2">
        <span class="truncate font-medium text-stone-900">{label}</span>
        {badge && (
          <span class="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">{badge}</span>
        )}
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <button type="button" onClick={onEdit} title="Bearbeiten"
          class="text-sm leading-none text-stone-400 hover:text-stone-700">✎</button>
        <button type="button" onClick={onDelete} title="Löschen"
          class="leading-none text-stone-400 hover:text-red-600">×</button>
      </div>
    </div>
  );
}
