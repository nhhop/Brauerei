import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Snapshot, ItemConfig, DashboardConfig } from '../types';
import {
  wifiReset,
  resetSensor, getConfig,
  getDashboards, createDashboard, updateDashboard, deleteDashboard,
} from '../api';
import { SensorCard } from '../components/SensorCard';
import { ActuatorCard } from '../components/ActuatorCard';
import { ControllerCard } from '../components/ControllerCard';
import { ConfirmModal } from '../components/ConfirmModal';
import { AddItemModal } from '../components/AddItemModal';
import { DashboardEditorModal } from '../components/DashboardEditorModal';

type Role = 'sensor' | 'actuator' | 'controller';
type Tab = { kind: 'dashboard'; id: string };

function filterSnap(snap: Snapshot, dash: DashboardConfig): Snapshot {
  const si = new Set(dash.sensors);
  const ai = new Set(dash.actuators);
  const ci = new Set(dash.controllers);
  return {
    sensors: snap.sensors.filter(s => {
      const base = s.id.includes('.') ? s.id.split('.')[0] : s.id;
      return si.has(base);
    }),
    actuators: snap.actuators.filter(a => ai.has(a.id)),
    controllers: snap.controllers.filter(c => ci.has(c.id)),
  };
}

export function Dashboard({ snap, err, onReset }: {
  snap: Snapshot | null;
  err: string | null;
  onReset: () => void;
  path?: string;
}) {
  // ── Dashboards ────────────────────────────────────────────────────────────
  const [dashboards, setDashboards] = useState<DashboardConfig[]>([]);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [dashEditorOpen, setDashEditorOpen] = useState(false);
  const [editingDash, setEditingDash] = useState<DashboardConfig | null>(null);

  useEffect(() => {
    getDashboards().then(ds => {
      setDashboards(ds);
      if (ds.length > 0) setActiveTab({ kind: 'dashboard', id: ds[0].id });
    }).catch(() => {});
  }, []);

  function openCreateDash() { setEditingDash(null); setDashEditorOpen(true); }
  function openEditDash(d: DashboardConfig) { setEditingDash(d); setDashEditorOpen(true); }

  async function saveDashboard(
    name: string, sensors: string[], actuators: string[], controllers: string[]
  ) {
    if (editingDash) {
      await updateDashboard(editingDash.id, { name, sensors, actuators, controllers });
      setDashboards(ds => ds.map(d =>
        d.id === editingDash.id ? { ...d, name, sensors, actuators, controllers } : d
      ));
    } else {
      const id = await createDashboard({ name, sensors, actuators, controllers });
      setDashboards(ds => [...ds, { id, name, sensors, actuators, controllers }]);
      setActiveTab({ kind: 'dashboard', id });
    }
    setDashEditorOpen(false);
    setEditingDash(null);
  }

  async function doDeleteDashboard(id: string) {
    await deleteDashboard(id);
    setDashboards(ds => ds.filter(d => d.id !== id));
    if (activeTab?.id === id) setActiveTab(null);
  }

  // ── WiFi reset ────────────────────────────────────────────────────────────
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetErr, setResetErr] = useState<string | null>(null);

  // ── Edit item (from card buttons) ─────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ role: Role; cfg: ItemConfig } | null>(null);

  async function removeFromDashboard(role: Role, id: string) {
    if (!activeDash) return;
    const updated = {
      name: activeDash.name,
      sensors: role === 'sensor' ? activeDash.sensors.filter(s => s !== id) : activeDash.sensors,
      actuators: role === 'actuator' ? activeDash.actuators.filter(a => a !== id) : activeDash.actuators,
      controllers: role === 'controller' ? activeDash.controllers.filter(c => c !== id) : activeDash.controllers,
    };
    await updateDashboard(activeDash.id, updated);
    setDashboards(ds => ds.map(d => d.id === activeDash.id ? { ...d, ...updated } : d));
  }

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

  // ── Computed view ─────────────────────────────────────────────────────────
  const activeDash = activeTab !== null
    ? (dashboards.find(d => d.id === activeTab.id) ?? null)
    : null;
  const displaySnap = snap && activeDash ? filterSnap(snap, activeDash) : snap;

  // ── Header ────────────────────────────────────────────────────────────────
  const header = (
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-medium tracking-tight">BrewControl</h1>
      <div class="flex items-center gap-2">
        <a href="/settings"
          class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100">
          ⚙
        </a>
        <button type="button" onClick={() => setResetOpen(true)}
          class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100">
          Reset WiFi
        </button>
      </div>
    </header>
  );

  // ── Tab bar ───────────────────────────────────────────────────────────────
  const tabBar = (
    <div class="my-4 flex items-end gap-2 border-b border-stone-200">
      <div class="flex flex-1 overflow-x-auto">
        {dashboards.map(d => (
          <TabBtn key={d.id}
            active={activeTab?.id === d.id}
            onClick={() => setActiveTab({ kind: 'dashboard', id: d.id })}>
            {d.name}
          </TabBtn>
        ))}
        <button type="button"
          class="shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 pb-2 pt-1.5 text-sm text-stone-500 hover:text-stone-800"
          onClick={openCreateDash}>
          + Neu
        </button>
      </div>
      {activeDash && (
        <button type="button"
          class="mb-2 shrink-0 rounded-md border border-stone-300 bg-white px-3 py-1 text-xs text-stone-600 hover:bg-stone-100"
          onClick={() => openEditDash(activeDash)}
          title="Dashboard bearbeiten">
          ✎ Bearbeiten
        </button>
      )}
    </div>
  );

  // ── Modals ────────────────────────────────────────────────────────────────
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

      <AddItemModal
        open={addOpen}
        snap={snap}
        onClose={() => { setAddOpen(false); setEditItem(null); }}
        editConfig={editItem?.cfg}
        editRole={editItem?.role}
      />

      <DashboardEditorModal
        open={dashEditorOpen}
        snap={snap}
        initial={editingDash ?? undefined}
        onSave={saveDashboard}
        onDelete={editingDash ? async () => {
          await doDeleteDashboard(editingDash.id);
          setDashEditorOpen(false);
          setEditingDash(null);
        } : undefined}
        onClose={() => { setDashEditorOpen(false); setEditingDash(null); }}
      />
    </>
  );

  if (err) return (
    <div class="min-h-screen bg-stone-50 p-4 text-stone-900 md:p-6">
      {header}{tabBar}
      <p class="text-sm text-red-600">{err}</p>
      {modals}
    </div>
  );

  if (!displaySnap) return (
    <div class="min-h-screen bg-stone-50 p-4 text-stone-900 md:p-6">
      {header}{tabBar}
      <p class="text-sm text-stone-500">Laden…</p>
      {modals}
    </div>
  );

  return (
    <div class="min-h-screen bg-stone-50 p-4 text-stone-900 md:p-6">
      {header}
      {tabBar}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Column title="Sensoren" count={displaySnap.sensors.length}>
          {displaySnap.sensors.map((s) => {
            const baseId = s.id.includes('.') ? s.id.split('.')[0] : s.id;
            return (
              <SensorCard key={s.id} sensor={s}
                onEdit={() => startEdit('sensor', baseId)}
                onDelete={() => removeFromDashboard('sensor', baseId)}
                onReset={s.meta.kind === 'Cumulative' || s.meta.quantity === 'Mass'
                  ? () => resetSensor(baseId) : undefined}
              />
            );
          })}
        </Column>
        <Column title="Regler" count={displaySnap.controllers.length}>
          {displaySnap.controllers.map((c) => (
            <ControllerCard key={c.id} controller={c}
              sensors={displaySnap.sensors}
              actuators={displaySnap.actuators}
              onEdit={() => startEdit('controller', c.id)}
              onDelete={() => removeFromDashboard('controller', c.id)}
            />
          ))}
        </Column>
        <Column title="Aktoren" count={displaySnap.actuators.length}>
          {displaySnap.actuators.map((a) => (
            <ActuatorCard key={a.id} actuator={a}
              onEdit={() => startEdit('actuator', a.id)}
              onDelete={() => removeFromDashboard('actuator', a.id)}
            />
          ))}
        </Column>
      </div>
      {modals}
    </div>
  );
}

function TabBtn({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: ComponentChildren;
}) {
  return (
    <div role="button" onClick={onClick}
      class={`flex shrink-0 cursor-pointer select-none items-center gap-0 whitespace-nowrap border-b-2 px-3 pb-2 pt-1.5 text-sm transition-colors
        ${active
          ? 'border-stone-900 font-medium text-stone-900'
          : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
      {children}
    </div>
  );
}

function Column({ title, count, children }: {
  title: string;
  count: number;
  children: ComponentChildren;
}) {
  if (count === 0) return null;
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
