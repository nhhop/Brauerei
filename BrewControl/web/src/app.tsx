import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Snapshot } from './types';
import { getSnapshot, subscribeEvents, wifiReset, deleteSensor, deleteActuator, deleteController, resetFlowVolume } from './api';
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

  // Add item
  const [addOpen, setAddOpen] = useState(false);

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

  const header = (
    <header class="mb-4 flex items-center justify-between gap-3">
      <h1 class="text-xl font-medium tracking-tight">BrewControl</h1>
      <div class="flex items-center gap-2">
        <button type="button" onClick={() => setAddOpen(true)}
          class="rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700">
          + Add Item
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
      <ConfirmModal open={resetOpen} title="Reset WiFi credentials?" destructive
        confirmLabel="Reset & reboot" pending={resetPending}
        onCancel={() => { setResetOpen(false); setResetErr(null); }}
        onConfirm={doReset}>
        <p>
          This clears the stored WiFi credentials and reboots the device into
          the setup portal. You'll need to reconnect via the
          <code class="mx-1 rounded bg-stone-100 px-1 font-mono">BrewControl-Setup</code>
          access point afterwards.
        </p>
        {resetErr && <p class="mt-2 text-red-600">{resetErr}</p>}
      </ConfirmModal>

      <ConfirmModal open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.id}"?`}
        destructive confirmLabel="Delete" pending={deletePending}
        onCancel={() => { setDeleteTarget(null); setDeleteErr(null); }}
        onConfirm={doDelete}>
        <p>This will permanently remove the item and update the SD config.</p>
        {deleteErr && <p class="mt-2 text-red-600">{deleteErr}</p>}
      </ConfirmModal>

      <AddItemModal open={addOpen} snap={snap} onClose={() => setAddOpen(false)} />
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
      <p class="text-sm text-stone-500">Loading…</p>
      {modals}
    </div>
  );

  return (
    <div class="min-h-screen bg-stone-50 p-4 text-stone-900 md:p-6">
      {header}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Column title="Sensors" count={snap.sensors.length}>
          {snap.sensors.map((s) => (
            <SensorCard key={s.id} sensor={s}
              onDelete={() => setDeleteTarget({ role: 'sensor', id: s.id })}
              onReset={s.meta.kind === 'Cumulative' ? () => resetFlowVolume(s.id) : undefined} />
          ))}
        </Column>
        <Column title="Controllers" count={snap.controllers.length}>
          {snap.controllers.map((c) => (
            <ControllerCard key={c.id} controller={c}
              onDelete={() => setDeleteTarget({ role: 'controller', id: c.id })} />
          ))}
        </Column>
        <Column title="Actuators" count={snap.actuators.length}>
          {snap.actuators.map((a) => (
            <ActuatorCard key={a.id} actuator={a}
              onDelete={() => setDeleteTarget({ role: 'actuator', id: a.id })} />
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
        <h1 class="text-xl font-medium tracking-tight">Rebooting…</h1>
        <p class="mt-3 text-sm text-stone-600">
          The device is restarting into setup-portal mode. Connect to the
          <code class="mx-1 rounded bg-stone-100 px-1 font-mono">BrewControl-Setup</code>
          WiFi network to configure new credentials.
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
