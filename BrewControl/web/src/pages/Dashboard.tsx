import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Snapshot, ItemConfig, DashboardConfig, LogConfig } from '../types';
import {
  resetSensor, getConfig,
  getDashboards, createDashboard, updateDashboard, deleteDashboard,
  getLogs,
} from '../api';
import { SensorCard } from '../components/SensorCard';
import { ActuatorCard } from '../components/ActuatorCard';
import { ControllerCard } from '../components/ControllerCard';
import { ChartCard } from '../components/ChartCard';
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

export function Dashboard({ snap, err }: {
  snap: Snapshot | null;
  err: string | null;
  path?: string;
}) {
  // ── Dashboards ────────────────────────────────────────────────────────────
  const [dashboards, setDashboards] = useState<DashboardConfig[]>([]);
  const [logs, setLogs] = useState<LogConfig[]>([]);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [dashEditorOpen, setDashEditorOpen] = useState(false);
  const [editingDash, setEditingDash] = useState<DashboardConfig | null>(null);

  useEffect(() => {
    getDashboards().then(ds => {
      setDashboards(ds);
      if (ds.length > 0) setActiveTab({ kind: 'dashboard', id: ds[0].id });
    }).catch(() => {});
    getLogs().then(setLogs).catch(() => {});
  }, []);

  function openCreateDash() { setEditingDash(null); setDashEditorOpen(true); }
  function openEditDash(d: DashboardConfig) { setEditingDash(d); setDashEditorOpen(true); }

  async function saveDashboard(
    name: string, sensors: string[], actuators: string[], controllers: string[], charts: string[]
  ) {
    if (editingDash) {
      await updateDashboard(editingDash.id, { name, sensors, actuators, controllers, charts });
      setDashboards(ds => ds.map(d =>
        d.id === editingDash.id ? { ...d, name, sensors, actuators, controllers, charts } : d
      ));
    } else {
      const id = await createDashboard({ name, sensors, actuators, controllers, charts });
      setDashboards(ds => [...ds, { id, name, sensors, actuators, controllers, charts }]);
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
      charts: activeDash.charts ?? [],
    };
    await updateDashboard(activeDash.id, updated);
    setDashboards(ds => ds.map(d => d.id === activeDash.id ? { ...d, ...updated } : d));
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
          class="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-fg/10">
          ⚙
        </a>
      </div>
    </header>
  );

  // ── Tab bar ───────────────────────────────────────────────────────────────
  const tabBar = (
    <div class="my-4 flex items-end gap-2 border-b border-border">
      <div class="flex flex-1 overflow-x-auto">
        {dashboards.map(d => (
          <TabBtn key={d.id}
            active={activeTab?.id === d.id}
            onClick={() => setActiveTab({ kind: 'dashboard', id: d.id })}>
            {d.name}
          </TabBtn>
        ))}
        <button type="button"
          class="shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 pb-2 pt-1.5 text-sm text-muted hover:text-fg"
          onClick={openCreateDash}>
          + Neu
        </button>
      </div>
      {activeDash && (
        <button type="button"
          class="mb-2 shrink-0 rounded-md border border-border bg-surface px-3 py-1 text-xs text-muted hover:bg-fg/10"
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
        logs={logs}
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
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      {header}{tabBar}
      <p class="text-sm text-red-600">{err}</p>
      {modals}
    </div>
  );

  if (!displaySnap) return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      {header}{tabBar}
      <p class="text-sm text-muted">Laden…</p>
      {modals}
    </div>
  );

  return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
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
      {activeDash && (activeDash.charts?.length ?? 0) > 0 && (
        <div class="mt-4 space-y-4">
          {activeDash.charts!.map((cid) => {
            const log = logs.find((l) => l.id === cid);
            if (!log) return null;
            return (
              <div key={cid} class="rounded-lg border border-border bg-surface p-4">
                <div class="mb-2 text-sm font-medium">{log.name}</div>
                <ChartCard log={log} snap={snap} />
              </div>
            );
          })}
        </div>
      )}
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
          ? 'border-accent font-medium text-fg'
          : 'border-transparent text-muted hover:text-fg'}`}>
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
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">{title}</h2>
        <span class="text-xs text-faint">{count}</span>
      </div>
      {children}
    </div>
  );
}
