import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Snapshot, ItemConfig, DashboardConfig, LogConfig, ProgramConfig } from '../types';
import {
  resetSensor, getConfig,
  getDashboards, createDashboard, updateDashboard, deleteDashboard,
  getLogs,
  getPrograms, createProgram, updateProgram, deleteProgram,
} from '../api';
import { SensorCard } from '../components/SensorCard';
import { ActuatorCard } from '../components/ActuatorCard';
import { ControllerCard } from '../components/ControllerCard';
import { ChartCard } from '../components/ChartCard';
import { ProgramCard } from '../components/ProgramCard';
import { AddItemModal } from '../components/AddItemModal';
import { DashboardMetaModal } from '../components/DashboardMetaModal';
import { DashboardContentModal } from '../components/DashboardContentModal';
import { ProgramEditorModal } from '../components/ProgramEditorModal';
import { Pencil, Check, Plus, X } from 'lucide-preact';

type ProgramSave = Pick<ProgramConfig, 'name' | 'controller' | 'steps'>;

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
  const [programs, setPrograms] = useState<ProgramConfig[]>([]);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  // Dashboard edit mode: gates the per-card ✎/× affordances. Off = clean view.
  const [editMode, setEditMode] = useState(false);
  // Meta dialog (create / rename+delete) and the checkbox content modal.
  const [meta, setMeta] = useState<null | 'create' | 'edit'>(null);
  const [contentOpen, setContentOpen] = useState(false);

  useEffect(() => {
    getDashboards().then(ds => {
      setDashboards(ds);
      if (ds.length > 0) setActiveTab({ kind: 'dashboard', id: ds[0].id });
    }).catch(() => {});
    getLogs().then(setLogs).catch(() => {});
  }, []);

  // Poll program live status (current step, remaining time) — independent of
  // the SSE snapshot so the library serializer stays untouched.
  function refreshPrograms() { getPrograms().then(setPrograms).catch(() => {}); }
  useEffect(() => {
    refreshPrograms();
    const t = setInterval(refreshPrograms, 2000);
    return () => clearInterval(t);
  }, []);

  async function createDashboardNamed(name: string) {
    const empty = { name, sensors: [], actuators: [], controllers: [], charts: [], programs: [] };
    const id = await createDashboard(empty);
    setDashboards(ds => [...ds, { id, ...empty }]);
    setActiveTab({ kind: 'dashboard', id });
    setEditMode(true);   // land in edit mode so the new (empty) board can be filled
    setMeta(null);
  }

  async function doDeleteDashboard(id: string) {
    await deleteDashboard(id);
    setDashboards(ds => ds.filter(d => d.id !== id));
    if (activeTab?.id === id) setActiveTab(null);
  }

  // ── Edit item (from card buttons) ─────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ role: Role; cfg: ItemConfig } | null>(null);

  // Merge a partial change into the active dashboard and persist it.
  async function patchActiveDash(patch: Partial<DashboardConfig>) {
    if (!activeDash) return;
    const updated = {
      name: activeDash.name,
      sensors: activeDash.sensors,
      actuators: activeDash.actuators,
      controllers: activeDash.controllers,
      charts: activeDash.charts ?? [],
      programs: activeDash.programs ?? [],
      ...patch,
    };
    await updateDashboard(activeDash.id, updated);
    setDashboards(ds => ds.map(d => d.id === activeDash.id ? { ...d, ...updated } : d));
  }

  async function removeFromDashboard(role: Role, id: string) {
    if (!activeDash) return;
    const key = role === 'sensor' ? 'sensors' : role === 'actuator' ? 'actuators' : 'controllers';
    await patchActiveDash({ [key]: activeDash[key].filter(x => x !== id) } as Partial<DashboardConfig>);
  }

  async function removeProgramRef(id: string) {
    await patchActiveDash({ programs: (activeDash?.programs ?? []).filter(p => p !== id) });
  }

  async function removeChartRef(id: string) {
    await patchActiveDash({ charts: (activeDash?.charts ?? []).filter(c => c !== id) });
  }

  // ── Programs (create / edit / delete) ─────────────────────────────────────
  const [progEditorOpen, setProgEditorOpen] = useState(false);
  const [editingProg, setEditingProg] = useState<ProgramConfig | null>(null);

  function openCreateProgram() { setEditingProg(null); setProgEditorOpen(true); }
  function openEditProgram(p: ProgramConfig) { setEditingProg(p); setProgEditorOpen(true); }

  async function saveProgram(cfg: ProgramSave) {
    if (editingProg) await updateProgram(editingProg.id, cfg);
    else await createProgram(cfg);
    setProgEditorOpen(false);
    setEditingProg(null);
    refreshPrograms();
  }

  async function doDeleteProgram(id: string) {
    await deleteProgram(id);
    setProgEditorOpen(false);
    setEditingProg(null);
    refreshPrograms();
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
      <h1 class="text-2xl font-semibold tracking-tight">BrewControl</h1>
    </header>
  );

  // ── Tab bar ───────────────────────────────────────────────────────────────
  const tabBar = (
    <div class="my-4 flex items-end gap-2 border-b border-border lg:mb-0">
      <div class="flex flex-1 overflow-x-auto">
        {dashboards.map(d => {
          const active = activeTab?.id === d.id;
          return (
            <TabBtn key={d.id} active={active}
              onClick={() => { if (!active) setActiveTab({ kind: 'dashboard', id: d.id }); }}>
              {d.name}
              {editMode && active && (
                <button type="button" title="Umbenennen / Löschen"
                  onClick={(e) => { e.stopPropagation(); setMeta('edit'); }}
                  class="ml-1.5 text-faint hover:text-fg"><Pencil size={12} /></button>
              )}
            </TabBtn>
          );
        })}
        {(editMode || dashboards.length === 0) && (
          <button type="button"
            class="shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 pb-2 pt-1.5 text-sm text-muted hover:text-fg"
            onClick={() => setMeta('create')}>
            + Neu
          </button>
        )}
      </div>
      {activeDash && !editMode && (
        <button type="button"
          class="mb-2 flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 text-xs text-muted hover:bg-fg/10"
          onClick={() => setEditMode(true)}
          title="Dashboard bearbeiten">
          <Pencil size={12} /> Bearbeiten
        </button>
      )}
      {activeDash && editMode && (
        <div class="mb-2 flex shrink-0 items-center gap-1.5">
          <button type="button"
            class="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 text-xs text-muted hover:bg-fg/10"
            onClick={() => setContentOpen(true)}
            title="Inhalte hinzufügen">
            <Plus size={12} /> Hinzufügen
          </button>
          <button type="button"
            class="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-fg hover:bg-accent/90"
            onClick={() => setEditMode(false)}
            title="Bearbeiten beenden">
            <Check size={12} /> Fertig
          </button>
        </div>
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

      <DashboardMetaModal
        open={meta !== null}
        initial={meta === 'edit' ? (activeDash ?? undefined) : undefined}
        onSave={meta === 'edit'
          ? (name) => { patchActiveDash({ name }); setMeta(null); }
          : createDashboardNamed}
        onDelete={meta === 'edit' && activeDash ? async () => {
          await doDeleteDashboard(activeDash.id);
          setMeta(null);
          setEditMode(false);
        } : undefined}
        onClose={() => setMeta(null)}
      />

      {activeDash && (
        <DashboardContentModal
          open={contentOpen}
          snap={snap}
          logs={logs}
          programs={programs}
          dash={activeDash}
          onSave={(m) => { patchActiveDash(m); setContentOpen(false); }}
          onNewProgram={openCreateProgram}
          onClose={() => setContentOpen(false)}
        />
      )}

      <ProgramEditorModal
        open={progEditorOpen}
        snap={snap}
        initial={editingProg ?? undefined}
        onSave={saveProgram}
        onDelete={editingProg ? () => doDeleteProgram(editingProg.id) : undefined}
        onClose={() => { setProgEditorOpen(false); setEditingProg(null); }}
      />
    </>
  );

  if (err) return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      {header}{tabBar}
      <p class="text-sm text-critical">{err}</p>
      {modals}
    </div>
  );

  if (!displaySnap) return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      {header}{tabBar}
      <p class="text-sm text-muted">Laden…</p>
      {modals}
    </div>
  );

  return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6 lg:flex lg:h-full lg:flex-col lg:overflow-hidden lg:pb-0">
      {header}
      {tabBar}
      {editMode && (
        <p class="mt-3 shrink-0 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-muted lg:mt-4">
          Bearbeiten-Modus aktiv — Karten mit dem Stift konfigurieren, mit × entfernen. Inhalte über „Hinzufügen“; Name & Löschen über den Stift am Tab.
        </p>
      )}
      <div class="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:items-stretch">
        {activeDash && (activeDash.programs?.length ?? 0) > 0 && (
          <div class="max-lg:contents lg:h-full lg:w-80 lg:shrink-0 lg:space-y-4 lg:overflow-y-auto lg:pt-4 lg:pb-6">
            {activeDash.programs!.map((pid) => {
              const prog = programs.find((p) => p.id === pid);
              if (!prog) return null;
              const ctrlExists = (snap?.controllers ?? []).some((c) => c.id === prog.controller);
              return (
                <ProgramCard key={pid} program={prog}
                  controllerExists={ctrlExists}
                  onChanged={refreshPrograms}
                  onEdit={editMode ? () => openEditProgram(prog) : undefined}
                  onDelete={editMode ? () => removeProgramRef(pid) : undefined}
                  fill={activeDash.programs!.length === 1}
                />
              );
            })}
          </div>
        )}
        <div class="min-w-0 flex-1 space-y-4 lg:-mr-6 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pt-4 lg:pr-6">
          {activeDash && (activeDash.charts?.length ?? 0) > 0 && (
            <div class="space-y-4">
              {activeDash.charts!.map((cid) => {
                const log = logs.find((l) => l.id === cid);
                if (!log) return null;
                return (
                  <div key={cid} class="rounded-lg border border-border bg-surface p-4 shadow-elev-2 transition-shadow duration-200 hover:shadow-elev-8">
                    <div class="mb-2 flex items-center justify-between gap-2">
                      <span class="text-sm font-medium">{log.name}</span>
                      {editMode && (
                        <button type="button" onClick={() => removeChartRef(cid)}
                          title="Aus Dashboard entfernen"
                          class="text-faint hover:text-critical"><X size={16} /></button>
                      )}
                    </div>
                    <ChartCard log={log} snap={snap} />
                  </div>
                );
              })}
            </div>
          )}
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Column title="Sensoren" count={displaySnap.sensors.length}>
              {displaySnap.sensors.map((s) => {
                const baseId = s.id.includes('.') ? s.id.split('.')[0] : s.id;
                return (
                  <SensorCard key={s.id} sensor={s}
                    onEdit={editMode ? () => startEdit('sensor', baseId) : undefined}
                    onDelete={editMode ? () => removeFromDashboard('sensor', baseId) : undefined}
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
                  onEdit={editMode ? () => startEdit('controller', c.id) : undefined}
                  onDelete={editMode ? () => removeFromDashboard('controller', c.id) : undefined}
                />
              ))}
            </Column>
            <Column title="Aktoren" count={displaySnap.actuators.length}>
              {displaySnap.actuators.map((a) => (
                <ActuatorCard key={a.id} actuator={a}
                  onEdit={editMode ? () => startEdit('actuator', a.id) : undefined}
                  onDelete={editMode ? () => removeFromDashboard('actuator', a.id) : undefined}
                />
              ))}
            </Column>
          </div>
        </div>
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
