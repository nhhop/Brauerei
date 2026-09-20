import { useEffect, useState } from 'preact/hooks';
import type { VNode } from 'preact';
import type { LayoutNode, Snapshot, ItemConfig, DashboardConfig, LogConfig, ProgramConfig, ProgramStep, TimerConfig, ProfileLibrary, Severity, WidgetMode } from '../types';
import {
  resetSensor, getConfig,
  getDashboards, createDashboard, updateDashboard, deleteDashboard, moveDashboard,
  getLogs,
  getPrograms, createProgram, updateProgram, deleteProgram,
  getTimers, createTimer, updateTimer, deleteTimer,
  getProfiles, createProfile,
} from '../api';
import { SensorCard } from '../components/SensorCard';
import { ActuatorCard } from '../components/ActuatorCard';
import { ControllerCard } from '../components/ControllerCard';
import { ChartCard } from '../components/ChartCard';
import { SkeletonList } from '../components/Skeleton';
import { ProgramCard } from '../components/ProgramCard';
import { TimerCard } from '../components/TimerCard';
import { DashboardLayout } from '../components/DashboardLayout';
import { isCardRef, linearize, memberRefs, reconcile, refId, refKind, renameRef } from '../dashboardLayout';
import { AddItemModal } from '../components/AddItemModal';
import { NameModal } from '../components/NameModal';
import { TabBtn } from '../components/TabBtn';
import { DashboardContentModal } from '../components/DashboardContentModal';
import { ProgramEditorModal } from '../components/ProgramEditorModal';
import { TimerEditorModal } from '../components/TimerEditorModal';
import { ProfileEditorModal } from '../components/ProfileEditorModal';
import { Pencil, Check, Plus, X, ChevronLeft, ChevronRight } from 'lucide-preact';

type ProgramSave = Pick<ProgramConfig, 'name' | 'steps'>;
type TimerSave = Pick<TimerConfig, 'name' | 'mode' | 'durationSec' | 'timeOfDay' | 'repeat' | 'onExpire'>;

type Role = 'sensor' | 'actuator' | 'controller';
type Tab = { kind: 'dashboard'; id: string };

function filterSnap(snap: Snapshot, dash: DashboardConfig): Snapshot {
  const si = new Set(dash.sensors);
  const ai = new Set(dash.actuators);
  const ci = new Set(dash.controllers);
  return {
    sensors: snap.sensors.filter(s => {
      const base = s.id.includes('.') ? s.id.split('.')[0] : s.id;
      return si.has(base) || si.has(s.id);
    }),
    actuators: snap.actuators.filter(a => ai.has(a.id)),
    controllers: snap.controllers.filter(c => ci.has(c.id)),
  };
}

// Chart card with its title row. On desktop the uPlot legend is moved into
// that row (next to the title) instead of rendering below the chart; the
// `legendHost` div only gets a real DOM node after mount, so it's kept in
// state to trigger the re-render ChartCard needs to reparent the legend.
function ChartRow({ log, snap, isDesktop, editMode, onRemove }: {
  log: LogConfig; snap: Snapshot | null; isDesktop: boolean; editMode: boolean; onRemove: () => void;
}) {
  const [legendHost, setLegendHost] = useState<HTMLDivElement | null>(null);
  return (
    <div class="flex flex-col rounded-lg border border-card-border bg-card p-4 shadow-elev-2 transition-shadow duration-200 hover:shadow-elev-8 lg:min-h-0 lg:flex-1">
      <div class="mb-2 flex shrink-0 items-center gap-2">
        <span class="shrink-0 text-sm font-medium">{log.name}</span>
        <div ref={setLegendHost} class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap" />
        {editMode && (
          <button type="button" onClick={onRemove}
            title="Aus Dashboard entfernen"
            class="text-faint hover:text-critical"><X size={16} /></button>
        )}
      </div>
      <div class="lg:min-h-0 lg:flex-1">
        <ChartCard log={log} snap={snap} fill={isDesktop} legendHost={isDesktop ? legendHost : null} />
      </div>
    </div>
  );
}

export function Dashboard({ snap, err, alarmByRef }: {
  snap: Snapshot | null;
  err: string | null;
  // Active threshold alarms keyed by their watched ref, for the card badges.
  alarmByRef?: Map<string, Severity>;
  path?: string;
}) {
  // ── Dashboards ────────────────────────────────────────────────────────────
  const [dashboards, setDashboards] = useState<DashboardConfig[]>([]);
  const [logs, setLogs] = useState<LogConfig[]>([]);
  const [programs, setPrograms] = useState<ProgramConfig[]>([]);
  const [timers, setTimers] = useState<TimerConfig[]>([]);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  // Dashboard edit mode: gates the per-card ✎/× affordances. Off = clean view.
  const [editMode, setEditMode] = useState(false);
  // Meta dialog (create / rename+delete) and the checkbox content modal.
  const [meta, setMeta] = useState<null | 'create' | 'edit'>(null);
  const [contentOpen, setContentOpen] = useState(false);
  // Live height (px) of the fixed mobile program bottom sheet — drives the
  // spacer that keeps the list's last row reachable above it.
  const [sheetH, setSheetH] = useState(0);
  // Same breakpoint ProgramCard's own sheet check uses — the chart only fills
  // the remaining column height in the fixed-height desktop layout; on mobile
  // the page scrolls naturally and the chart keeps its default fixed height.
  const [isDesktop, setIsDesktop] = useState(() => matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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
    const t = setInterval(refreshPrograms, 1000);
    return () => clearInterval(t);
  }, []);

  // Same reasoning as programs: poll timer live status independently of SSE.
  function refreshTimers() { getTimers().then(setTimers).catch(() => {}); }
  useEffect(() => {
    refreshTimers();
    const t = setInterval(refreshTimers, 1000);
    return () => clearInterval(t);
  }, []);

  async function createDashboardNamed(name: string) {
    const empty = {
      name, sensors: [], actuators: [], controllers: [], charts: [], programs: [], timers: [],
      sensorModes: {}, controllerModes: {}, timerModes: {},
    };
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

  async function moveTab(id: string, direction: 'left' | 'right') {
    const i = dashboards.findIndex(d => d.id === id);
    if (i < 0) return;
    const j = direction === 'left' ? i - 1 : i + 1;
    if (j < 0 || j >= dashboards.length) return;
    await moveDashboard(id, direction);
    setDashboards(ds => {
      const next = [...ds];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // ── Edit item (from card buttons) ─────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ role: Role; cfg: ItemConfig } | null>(null);

  // POST /api/dashboards/<id> replaces every field, so a key left out of the
  // body is cleared on the device — the layout included. Every writer goes
  // through here to send a complete dashboard.
  function dashBody(d: DashboardConfig): Omit<DashboardConfig, 'id'> {
    return {
      name: d.name,
      sensors: d.sensors,
      actuators: d.actuators,
      controllers: d.controllers,
      charts: d.charts ?? [],
      programs: d.programs ?? [],
      timers: d.timers ?? [],
      sensorModes: d.sensorModes ?? {},
      controllerModes: d.controllerModes ?? {},
      timerModes: d.timerModes ?? {},
      layout: d.layout,
    };
  }

  // Merge a partial change into the active dashboard and persist it.
  async function patchActiveDash(patch: Partial<DashboardConfig>) {
    if (!activeDash) return;
    const updated = { ...dashBody(activeDash), ...patch };
    await updateDashboard(activeDash.id, updated);
    setDashboards(ds => ds.map(d => d.id === activeDash.id ? { ...d, ...updated } : d));
  }

  async function removeFromDashboard(role: Role, id: string) {
    if (!activeDash) return;
    const key = role === 'sensor' ? 'sensors' : role === 'actuator' ? 'actuators' : 'controllers';
    await patchActiveDash({ [key]: activeDash[key].filter(x => x !== id) } as Partial<DashboardConfig>);
  }

  // Cycles a widget's display mode (normal -> gauge -> compact -> normal) and
  // persists it. 'normal' is never stored — the key is simply removed.
  const MODE_ORDER: WidgetMode[] = ['normal', 'gauge', 'compact'];
  function cycleMode(mapKey: 'sensorModes' | 'controllerModes' | 'timerModes', id: string, current: WidgetMode) {
    const next = MODE_ORDER[(MODE_ORDER.indexOf(current) + 1) % MODE_ORDER.length];
    const modes = { ...(activeDash?.[mapKey] ?? {}) };
    if (next === 'normal') delete modes[id]; else modes[id] = next;
    patchActiveDash({ [mapKey]: modes } as Partial<DashboardConfig>);
  }

  // Renaming an item (delete+recreate under a new id) would otherwise silently
  // drop it from every dashboard that referenced the old id — including any
  // display mode it had, which lives in a sibling id-keyed map.
  function remapMode(modes: Record<string, WidgetMode> | undefined, oldId: string, newId: string): Record<string, WidgetMode> {
    if (!modes || !(oldId in modes)) return modes ?? {};
    const { [oldId]: v, ...rest } = modes;
    return { ...rest, [newId]: v };
  }

  async function handleRenamed(role: Role, oldId: string, newId: string) {
    const key = role === 'sensor' ? 'sensors' : role === 'actuator' ? 'actuators' : 'controllers';
    // A sensor can sit on a dashboard as its base id or as single channel ids
    // ("<old>.distance"); both follow the rename.
    const affected = (x: string) => x === oldId || (role === 'sensor' && x.startsWith(oldId + '.'));
    const renamed = (x: string) => newId + x.slice(oldId.length);
    for (const d of dashboards) {
      const hits = d[key].filter(affected);
      if (hits.length === 0) continue;
      let sensorModes = d.sensorModes ?? {};
      let layout = d.layout;
      for (const x of hits) {
        if (role === 'sensor') sensorModes = remapMode(sensorModes, x, renamed(x));
        // Without this the card would lose its place: reconcile() drops the old
        // ref and appends the new one at the end.
        layout = renameRef(layout, role + '/' + x, role + '/' + renamed(x));
      }
      const updated = {
        ...dashBody(d),
        sensorModes,
        controllerModes: role === 'controller' ? remapMode(d.controllerModes, oldId, newId) : (d.controllerModes ?? {}),
        layout,
        [key]: d[key].map(x => affected(x) ? renamed(x) : x),
      };
      await updateDashboard(d.id, updated);
      setDashboards(ds => ds.map(x => x.id === d.id ? { ...x, ...updated } : x));
    }
  }

  async function removeProgramRef(id: string) {
    await patchActiveDash({ programs: (activeDash?.programs ?? []).filter(p => p !== id) });
  }

  async function removeChartRef(id: string) {
    await patchActiveDash({ charts: (activeDash?.charts ?? []).filter(c => c !== id) });
  }

  async function removeTimerRef(id: string) {
    await patchActiveDash({ timers: (activeDash?.timers ?? []).filter(t => t !== id) });
  }

  // ── Programs (create / edit / delete) ─────────────────────────────────────
  const [progEditorOpen, setProgEditorOpen] = useState(false);
  const [editingProg, setEditingProg] = useState<ProgramConfig | null>(null);
  // Profile library — read-only here: fills a program's steps, and takes the
  // current steps back as a new profile. No poll, profiles have no run state.
  const [library, setLibrary] = useState<ProfileLibrary | null>(null);
  const [profileDraft, setProfileDraft] = useState<{ name: string; steps: ProgramStep[] } | null>(null);

  function refreshLibrary() { getProfiles().then(setLibrary).catch(() => {}); }
  useEffect(() => { refreshLibrary(); }, []);

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

  // ── Timers (create / edit / delete) ───────────────────────────────────────
  const [timerEditorOpen, setTimerEditorOpen] = useState(false);
  const [editingTimer, setEditingTimer] = useState<TimerConfig | null>(null);

  function openCreateTimer() { setEditingTimer(null); setTimerEditorOpen(true); }
  function openEditTimer(t: TimerConfig) { setEditingTimer(t); setTimerEditorOpen(true); }

  async function saveTimer(cfg: TimerSave) {
    if (editingTimer) await updateTimer(editingTimer.id, cfg);
    else await createTimer(cfg);
    setTimerEditorOpen(false);
    setEditingTimer(null);
    refreshTimers();
  }

  async function doDeleteTimer(id: string) {
    await deleteTimer(id);
    setTimerEditorOpen(false);
    setEditingTimer(null);
    refreshTimers();
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

  // ── Layout ────────────────────────────────────────────────────────────────
  // What this dashboard shows, and the arrangement holding it. The stored tree
  // is reconciled on every render: membership changes (content dialog, deleted
  // or renamed items) must not leave holes or orphans behind.
  const refs = activeDash ? memberRefs(activeDash, snap, logs, programs, timers) : [];
  const layout = activeDash ? reconcile(activeDash.layout, refs) : null;

  function labelOf(ref: string): string {
    const id = refId(ref);
    switch (refKind(ref)) {
      case 'chart':   return logs.find((l) => l.id === id)?.name ?? id;
      case 'program': return programs.find((p) => p.id === id)?.name ?? id;
      case 'timer':   return timers.find((t) => t.id === id)?.name ?? id;
      default:        return id;
    }
  }

  // Optimistic: a drop should feel immediate, the request is the slow part. On
  // failure the device stays the source of truth and the view is reloaded.
  async function saveLayout(next: LayoutNode) {
    if (!activeDash) return;
    const id = activeDash.id;
    const body = { ...dashBody(activeDash), layout: next };
    setDashboards((ds) => ds.map((d) => (d.id === id ? { ...d, layout: next } : d)));
    try {
      await updateDashboard(id, body);
    } catch {
      getDashboards().then(setDashboards).catch(() => {});
    }
  }

  // One layout ref -> its card(s). `fill` means the item is alone in its area.
  function renderItem(ref: string, fill: boolean): VNode | null {
    const id = refId(ref);
    switch (refKind(ref)) {
      case 'sensor': {
        // "sensor/<baseId>" renders all channel cards of a sensor together
        // (legacy refs); "sensor/<baseId>.<channel>" renders just that channel.
        // Edit/reset act on the sensor (base id), delete on the ref itself.
        const channels = (displaySnap?.sensors ?? []).filter(
          (s) => s.id === id || (s.id.includes('.') ? s.id.split('.')[0] : s.id) === id);
        if (channels.length === 0) return null;
        const baseId = id.includes('.') ? id.split('.')[0] : id;
        const mode = activeDash?.sensorModes?.[id] ?? 'normal';
        return (
          <div class={channels.length > 1 ? 'space-y-4' : ''}>
            {channels.map((s) => (
              <SensorCard key={s.id} sensor={s}
                alarm={alarmByRef?.get(`sensor/${s.id}`)}
                viewMode={mode}
                onEdit={editMode ? () => startEdit('sensor', baseId) : undefined}
                onDelete={editMode ? () => removeFromDashboard('sensor', id) : undefined}
                onReset={s.meta.kind === 'Cumulative' || s.meta.quantity === 'Mass'
                  ? () => resetSensor(baseId) : undefined}
                onCycleMode={editMode ? () => cycleMode('sensorModes', id, mode) : undefined}
              />
            ))}
          </div>
        );
      }
      case 'controller': {
        const c = (displaySnap?.controllers ?? []).find((x) => x.id === id);
        if (!c) return null;
        const mode = activeDash?.controllerModes?.[id] ?? 'normal';
        return (
          <ControllerCard controller={c}
            sensors={snap?.sensors ?? []}
            actuators={snap?.actuators ?? []}
            programs={programs}
            viewMode={mode}
            onEdit={editMode ? () => startEdit('controller', id) : undefined}
            onDelete={editMode ? () => removeFromDashboard('controller', id) : undefined}
            onCycleMode={editMode ? () => cycleMode('controllerModes', id, mode) : undefined}
          />
        );
      }
      case 'actuator': {
        const a = (displaySnap?.actuators ?? []).find((x) => x.id === id);
        if (!a) return null;
        return (
          <ActuatorCard actuator={a}
            controllers={snap?.controllers ?? []}
            programs={programs}
            alarm={alarmByRef?.get(`actuator/${id}`)}
            onEdit={editMode ? () => startEdit('actuator', id) : undefined}
            onDelete={editMode ? () => removeFromDashboard('actuator', id) : undefined}
          />
        );
      }
      case 'chart': {
        const log = logs.find((l) => l.id === id);
        if (!log) return null;
        // Only a chart that owns its area can stretch; in a card group it keeps
        // its fixed height.
        return (
          <ChartRow log={log} snap={snap} isDesktop={isDesktop && fill}
            editMode={editMode} onRemove={() => removeChartRef(id)} />
        );
      }
      case 'program': {
        const prog = programs.find((x) => x.id === id);
        if (!prog) return null;
        return (
          <ProgramCard program={prog} snap={snap}
            onChanged={refreshPrograms}
            onEdit={editMode ? () => openEditProgram(prog) : undefined}
            onDelete={editMode ? () => removeProgramRef(id) : undefined}
            fill={fill}
            onSheetHeight={setSheetH}
          />
        );
      }
      case 'timer': {
        const timer = timers.find((t) => t.id === id);
        if (!timer) return null;
        const mode = activeDash?.timerModes?.[id] ?? 'normal';
        return (
          <TimerCard timer={timer} programs={programs} viewMode={mode}
            onChanged={refreshTimers}
            onEdit={editMode ? () => openEditTimer(timer) : undefined}
            onDelete={editMode ? () => removeTimerRef(id) : undefined}
            onCycleMode={editMode ? () => cycleMode('timerModes', id, mode) : undefined}
          />
        );
      }
      default: return null;
    }
  }

  // Mobile: the areas collapse to one column in the desktop layout's reading
  // order. Runs of small cards keep the familiar responsive grid, large widgets
  // get a row of their own.
  function mobileBlocks(order: string[]): VNode[] {
    const out: VNode[] = [];
    let group: string[] = [];
    const flush = () => {
      if (group.length === 0) return;
      out.push(
        <div key={`group${out.length}`}
          class="grid grid-cols-1 gap-4 [grid-auto-flow:dense] [grid-auto-rows:minmax(72px,auto)] sm:grid-cols-2 md:grid-cols-3">
          {group.map((r) => <div key={r}>{renderItem(r, false)}</div>)}
        </div>,
      );
      group = [];
    };
    for (const ref of order) {
      if (isCardRef(ref)) { group.push(ref); continue; }
      flush();
      // A lone program keeps its fixed bottom sheet, as before.
      out.push(<div key={ref}>{renderItem(ref, refKind(ref) === 'program' && hasProgramSheet)}</div>);
    }
    flush();
    return out;
  }

  // ── Header ────────────────────────────────────────────────────────────────
  // Dashboard actions (Bearbeiten / Hinzufügen+Fertig): rendered in the header
  // on mobile (tab row is too cramped there for both tabs and buttons) and in
  // the tab row on desktop (lg:), where there's room to spare.
  // `alignEnd`: in the desktop tab row (items-end) the buttons need a bottom
  // margin to line up above the tab underline; in the header (items-center)
  // that same margin would push them off-center, so it's opt-in per call site.
  function dashActions(alignEnd: boolean) {
    if (!activeDash) return null;
    const m = alignEnd ? 'mb-2 ' : '';
    return editMode ? (
      <div class={`${m}flex shrink-0 items-center gap-1.5`}>
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
    ) : (
      <button type="button"
        class={`${m}flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 text-xs text-muted hover:bg-fg/10`}
        onClick={() => setEditMode(true)}
        title="Dashboard bearbeiten">
        <Pencil size={12} /> Bearbeiten
      </button>
    );
  }

  const header = (
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">BrewControl</h1>
      <div class="lg:hidden">{dashActions(false)}</div>
    </header>
  );

  // ── Tab bar ───────────────────────────────────────────────────────────────
  const tabBar = (
    <div class="my-4 flex items-end gap-2 border-b border-border lg:mb-0">
      <div class="flex flex-1 overflow-x-auto">
        {dashboards.map((d, i) => {
          const active = activeTab?.id === d.id;
          return (
            <TabBtn key={d.id} active={active}
              onClick={() => { if (!active) setActiveTab({ kind: 'dashboard', id: d.id }); }}>
              {editMode && active && (
                <button type="button" title="Nach links verschieben" disabled={i === 0}
                  onClick={(e) => { e.stopPropagation(); moveTab(d.id, 'left'); }}
                  class="mr-1 text-faint hover:text-fg disabled:opacity-30 disabled:hover:text-faint"><ChevronLeft size={12} /></button>
              )}
              {d.name}
              {editMode && active && (
                <button type="button" title="Nach rechts verschieben" disabled={i === dashboards.length - 1}
                  onClick={(e) => { e.stopPropagation(); moveTab(d.id, 'right'); }}
                  class="ml-1 text-faint hover:text-fg disabled:opacity-30 disabled:hover:text-faint"><ChevronRight size={12} /></button>
              )}
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
      <div class="hidden lg:contents">{dashActions(true)}</div>
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
        onRenamed={handleRenamed}
      />

      <NameModal
        open={meta !== null}
        title={meta === 'edit' ? 'Dashboard bearbeiten' : 'Neues Dashboard'}
        submitLabel={meta === 'edit' ? 'Speichern' : 'Erstellen'}
        placeholder="z.B. Maischen"
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
          timers={timers}
          dash={activeDash}
          onSave={(m) => { patchActiveDash(m); setContentOpen(false); }}
          onNewProgram={openCreateProgram}
          onNewTimer={openCreateTimer}
          onClose={() => setContentOpen(false)}
        />
      )}

      <ProgramEditorModal
        open={progEditorOpen}
        snap={snap}
        initial={editingProg ?? undefined}
        library={library ?? undefined}
        onSaveAsProfile={setProfileDraft}
        onSave={saveProgram}
        onDelete={editingProg ? () => doDeleteProgram(editingProg.id) : undefined}
        onClose={() => { setProgEditorOpen(false); setEditingProg(null); }}
      />

      <TimerEditorModal
        open={timerEditorOpen}
        initial={editingTimer ?? undefined}
        snap={snap}
        programs={programs}
        onSave={saveTimer}
        onDelete={editingTimer ? () => doDeleteTimer(editingTimer.id) : undefined}
        onClose={() => { setTimerEditorOpen(false); setEditingTimer(null); }}
      />

      {/* Rendered after the program editor so it stacks on top of it. */}
      <ProfileEditorModal
        open={profileDraft !== null}
        categories={library?.categories ?? []}
        snap={snap}
        initial={profileDraft ?? undefined}
        onSave={async (cfg) => {
          await createProfile(cfg);
          setProfileDraft(null);
          refreshLibrary();
        }}
        onClose={() => setProfileDraft(null)}
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
      <SkeletonList count={3} />
      {modals}
    </div>
  );

  const hasProgramSheet = (activeDash?.programs?.length ?? 0) === 1;

  return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6 lg:flex lg:h-full lg:flex-col lg:overflow-hidden lg:pb-0">
      {header}
      {tabBar}
      {editMode && (
        <p class="mt-3 shrink-0 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-muted lg:mt-4">
          Bearbeiten-Modus aktiv — Karten am Griff oben verschieben (an eine Kante andocken oder in eine Gruppe einsortieren), Trenner ziehen ändert die Größe. Mit dem Stift konfigurieren, mit × entfernen. Inhalte über „Hinzufügen“; Name & Löschen über den Stift am Tab.
        </p>
      )}
      {layout != null && (isDesktop ? (
        <div class="flex min-h-0 flex-1 flex-col pt-4 pb-6">
          <DashboardLayout layout={layout} editMode={editMode}
            renderItem={renderItem} labelOf={labelOf} onChange={saveLayout} />
        </div>
      ) : (
        <div class="mt-4 flex flex-col gap-4">
          {mobileBlocks(linearize(layout))}
          {hasProgramSheet && <div aria-hidden style={{ height: sheetH }} />}
        </div>
      ))}
      {modals}
    </div>
  );
}
