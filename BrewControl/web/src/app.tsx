import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Snapshot, ItemConfig } from './types';
import { getSnapshot, subscribeEvents, wifiReset, deleteSensor, deleteActuator, deleteController, resetFlowVolume, getConfig } from './api';
import { SensorCard } from './components/SensorCard';
import { ActuatorCard } from './components/ActuatorCard';
import { ControllerCard } from './components/ControllerCard';
import { ConfirmModal } from './components/ConfirmModal';
import { AddItemModal } from './components/AddItemModal';

type Role = 'sensor' | 'actuator' | 'controller';

function useSnapshot() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSnapshot()
      .then((s) => { if (alive) setSnap(s); })
      .catch((e) => { if (alive) setErr(String(e)); });
    const unsub = subscribeEvents((s) => { if (alive) setSnap(s); });
    return () => { alive = false; unsub(); };
  }, []);

  return { snap, err };
}

export function App() {
  const [rebooting, setRebooting] = useState(false);
  if (rebooting) return <RebootingView />;
  return <Dashboard onReset={() => setRebooting(true)} />;
}

function Dashboard({ onReset }: { onReset: () => void }) {
  const { snap, err } = useSnapshot();

  // WiFi reset
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetErr, setResetErr] = useState<string | null>(null);

  // Add / Edit item
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ role: Role; cfg: ItemConfig } | null>(null);

  // Delete item
  const [deleteTarget, setDeleteTarget] = useState<{ role: Role; id: string } | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  async function doReset() {
    setResetPending(true);
    setResetErr(null);
    try {
      await wifiReset();
      onReset();
    } catch (e) {
      setResetErr(String(e));
      setResetPending(false);
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

  async function startEdit(role: Role, id: string) {
    try {
      const config = await getConfig();
      const list = role === 'sensor' ? config.sensors
                 : role === 'actuator' ? config.actuators
                 : config.controllers;
      const cfg = list.find((c) => c.id === id);
      if (cfg) {
        setEditItem({ role, cfg });
        setAddOpen(true);
      }
    } catch {
      // ignore — edit simply won't open
    }
  }

  function closeModal() {
    setAddOpen(false);
    setEditItem(null);
  }

  const header = (
    <header class="mb-4 flex items-center justify-between gap-3">
      <h1 class="text-xl font-medium tracking-tight">BrewControl</h1>
      <div class="flex items-center gap-2">
        <button type="button" onClick={() => setAddOpen(true)}
          class="rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700">
          + Hinzufügen
        </button>
        <button type="button" onClick={() => setResetOpen(true)}
          class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100">
          Reset WiFi
        </button>
      </div>
    </header>
  );

  const modals = (
    <>
      <ConfirmModal open={resetOpen} title="WiFi-Zugangsdaten zurücksetzen?" destructive
        confirmLabel="Zurücksetzen & Neustart" pending={resetPending}
        onCancel={() => { setResetOpen(false); setResetErr(null); }}
        onConfirm={doReset}>
        <p>
          Dies löscht die gespeicherten WiFi-Zugangsdaten und startet das Gerät neu in
          den Setup-Modus. Danach über
          <code class="mx-1 rounded bg-stone-100 px-1 font-mono">BrewControl-Setup</code>
          neu verbinden.
        </p>
        {resetErr && <p class="mt-2 text-red-600">{resetErr}</p>}
      </ConfirmModal>

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
        onClose={closeModal}
        editConfig={editItem?.cfg}
        editRole={editItem?.role}
      />
    </>
  );

  if (err) return (
    <div class="min-h-screen bg-stone-50 p-6 text-stone-900">
      {header}
      <p class="text-sm text-red-600">{err}</p>
      {modals}
    </div>
  );

  if (!snap) return (
    <div class="min-h-screen bg-stone-50 p-6 text-stone-900">
      {header}
      <p class="text-sm text-stone-500">Laden…</p>
      {modals}
    </div>
  );

  return (
    <div class="min-h-screen bg-stone-50 p-4 text-stone-900 md:p-6">
      {header}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Column title="Sensoren" count={snap.sensors.length}>
          {snap.sensors.map((s) => {
            const baseId = s.id.includes('.') ? s.id.split('.')[0] : s.id;
            return (
              <SensorCard key={s.id} sensor={s}
                onEdit={() => startEdit('sensor', baseId)}
                onDelete={() => setDeleteTarget({ role: 'sensor', id: baseId })}
                onReset={s.meta.kind === 'Cumulative' ? () => resetFlowVolume(baseId) : undefined}
              />
            );
          })}
        </Column>
        <Column title="Regler" count={snap.controllers.length}>
          {snap.controllers.map((c) => (
            <ControllerCard key={c.id} controller={c}
              sensors={snap.sensors}
              actuators={snap.actuators}
              onEdit={() => startEdit('controller', c.id)}
              onDelete={() => setDeleteTarget({ role: 'controller', id: c.id })}
            />
          ))}
        </Column>
        <Column title="Aktoren" count={snap.actuators.length}>
          {snap.actuators.map((a) => (
            <ActuatorCard key={a.id} actuator={a}
              onEdit={() => startEdit('actuator', a.id)}
              onDelete={() => setDeleteTarget({ role: 'actuator', id: a.id })}
            />
          ))}
        </Column>
      </div>
      {modals}
    </div>
  );
}

function RebootingView() {
  return (
    <div class="flex min-h-screen items-center justify-center bg-stone-50 p-6 text-stone-900">
      <div class="max-w-md text-center">
        <h1 class="text-xl font-medium tracking-tight">Neustart…</h1>
        <p class="mt-3 text-sm text-stone-600">
          Das Gerät startet in den Setup-Modus. Mit dem WLAN
          <code class="mx-1 rounded bg-stone-100 px-1 font-mono">BrewControl-Setup</code>
          verbinden um neue Zugangsdaten einzutragen.
        </p>
      </div>
    </div>
  );
}

function Column({ title, count, children }: {
  title: string;
  count: number;
  children: ComponentChildren;
}) {
  return (
    <div class="space-y-3">
      <div class="flex items-baseline justify-between">
        <h2 class="text-sm font-medium uppercase tracking-wider text-stone-500">{title}</h2>
        <span class="text-xs text-stone-400">{count}</span>
      </div>
      {children}
    </div>
  );
}
