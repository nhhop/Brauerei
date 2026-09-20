import { useState, useEffect } from 'preact/hooks';
import {
  Gauge, Zap, SlidersHorizontal, LineChart, ListChecks, Timer as TimerIcon,
  Plus, Search, type LucideIcon,
} from 'lucide-preact';
import type {
  Snapshot, DashboardConfig, LogConfig, ProgramConfig, TimerConfig, ItemState,
} from '../types';
import { fmtDuration } from '../format';
import type { Role } from '../itemTypes';
import { AddItemModal } from './AddItemModal';
import { btnPrimary, btnSecondary, dialogFrame, inp } from '../ui';

export interface DashboardMembers {
  sensors: string[]; actuators: string[]; controllers: string[]; charts: string[]; programs: string[]; timers: string[];
}

interface Props {
  open: boolean;
  snap: Snapshot | null;
  logs?: LogConfig[];
  programs?: ProgramConfig[];
  timers?: TimerConfig[];
  dash: DashboardConfig;                 // current membership to preselect
  onSave: (members: DashboardMembers) => void;
  onNewProgram?: () => void;
  onNewTimer?: () => void;
  onClose: () => void;
}

// One selectable entry: `id` is what gets stored in the dashboard config,
// `detail` the right-aligned secondary text that tells two similar ids apart.
interface Row { id: string; label: string; detail?: string }

interface Section {
  key: string;
  title: string;
  icon: LucideIcon;
  rows: Row[];
  sel: Set<string>;
  setSel: (s: Set<string>) => void;
  // "+ Neuer ..." row at the end of this group. Charts have none: a chart is
  // configured on its own page, not from here.
  add?: { label: string; onClick: () => void };
}

function fmtValue(state: ItemState, unit: string): string {
  const v = state.v;
  if (!state.ok || v == null || !isFinite(v)) return '—';
  return `${v.toFixed(1)} ${unit}`.trim();
}

// Content picker: check which sensors / actuators / controllers / charts /
// programs the dashboard shows. Name & delete live in NameModal.
export function DashboardContentModal({ open, snap, logs, programs, timers, dash, onSave, onNewProgram, onNewTimer, onClose }: Props) {
  const [sensors, setSensors] = useState<Set<string>>(new Set());
  const [actuators, setActuators] = useState<Set<string>>(new Set());
  const [controllers, setControllers] = useState<Set<string>>(new Set());
  const [charts, setCharts] = useState<Set<string>>(new Set());
  const [progs, setProgs] = useState<Set<string>>(new Set());
  const [timerIds, setTimerIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [subAddOpen, setSubAddOpen] = useState(false);
  const [addRole, setAddRole] = useState<Role>('sensor');

  useEffect(() => {
    if (open) {
      setSensors(new Set(dash.sensors));
      setActuators(new Set(dash.actuators));
      setControllers(new Set(dash.controllers));
      setCharts(new Set(dash.charts ?? []));
      setProgs(new Set(dash.programs ?? []));
      setTimerIds(new Set(dash.timers ?? []));
      setQuery('');
      setCat('all');
    }
  }, [open, dash]);

  if (!open) return null;

  // Every channel of a multi-channel sensor (e.g. "flow.rate") is its own row and
  // its own card. A dashboard saved before that may still hold the bare base id
  // (all channels together); it stays listed so it can be unchecked.
  const snapSensors = snap?.sensors ?? [];
  const baseId = (id: string) => (id.includes('.') ? id.split('.')[0] : id);
  const sensorRows: Row[] = snapSensors.map((s) => ({
    id: s.id, label: s.id, detail: fmtValue(s.state, s.meta.unit),
  }));
  for (const id of new Set(snapSensors.map((s) => baseId(s.id)))) {
    if (sensors.has(id) && !sensorRows.some((r) => r.id === id))
      sensorRows.push({ id, label: id, detail: 'alle Kanäle' });
  }

  const actuatorRows: Row[] = (snap?.actuators ?? []).map((a) => ({
    id: a.id, label: a.id,
    detail: a.meta.kind === 'Binary'
      ? (a.enabled ? 'An' : 'Aus')
      : fmtValue(a.state, a.meta.unit),
  }));

  const controllerRows: Row[] = (snap?.controllers ?? []).map((c) => {
    const unit = snapSensors.find((s) => s.id === c.params?.sensor)?.meta.unit ?? '';
    return { id: c.id, label: c.id, detail: `→ ${c.setpoint.toFixed(1)} ${unit}`.trim() };
  });

  const chartRows: Row[] = (logs ?? []).map((l) => ({
    id: l.id, label: l.name,
    detail: l.series.length === 1 ? '1 Serie' : `${l.series.length} Serien`,
  }));

  const programRows: Row[] = (programs ?? []).map((p) => ({
    id: p.id, label: p.name,
    detail: p.steps.length === 1 ? '1 Schritt' : `${p.steps.length} Schritte`,
  }));

  const timerRows: Row[] = (timers ?? []).map((t) => ({
    id: t.id, label: t.name,
    detail: t.mode === 'clock' ? (t.timeOfDay ?? '') : fmtDuration(t.durationSec),
  }));

  const openAdd = (role: Role) => { setAddRole(role); setSubAddOpen(true); };

  const sections: Section[] = ([
    { key: 'sensors',     title: 'Sensoren',  icon: Gauge,             rows: sensorRows,     sel: sensors,     setSel: setSensors,
      add: { label: 'Neuer Sensor', onClick: () => openAdd('sensor') } },
    { key: 'actuators',   title: 'Aktoren',   icon: Zap,               rows: actuatorRows,   sel: actuators,   setSel: setActuators,
      add: { label: 'Neuer Aktor', onClick: () => openAdd('actuator') } },
    { key: 'controllers', title: 'Regler',    icon: SlidersHorizontal, rows: controllerRows, sel: controllers, setSel: setControllers,
      add: { label: 'Neuer Regler', onClick: () => openAdd('controller') } },
    { key: 'charts',      title: 'Charts',    icon: LineChart,         rows: chartRows,      sel: charts,      setSel: setCharts },
    { key: 'programs',    title: 'Programme', icon: ListChecks,        rows: programRows,    sel: progs,       setSel: setProgs,
      add: onNewProgram && { label: 'Neues Programm', onClick: onNewProgram } },
    { key: 'timers',      title: 'Timer',     icon: TimerIcon,         rows: timerRows,      sel: timerIds,    setSel: setTimerIds,
      add: onNewTimer && { label: 'Neuer Timer', onClick: onNewTimer } },
  ] as Section[])
    // An empty group stays visible when it can be filled from here, so the
    // first sensor of a fresh device is one click away.
    .filter((s) => s.rows.length > 0 || s.add);

  const total = sections.reduce((n, s) => n + s.rows.length, 0);
  const selected = sections.reduce((n, s) => n + s.rows.filter((r) => s.sel.has(r.id)).length, 0);

  // Delta against what the dashboard held when the dialog opened.
  const baseSets: Record<string, string[]> = {
    sensors: dash.sensors, actuators: dash.actuators, controllers: dash.controllers,
    charts: dash.charts ?? [], programs: dash.programs ?? [], timers: dash.timers ?? [],
  };
  let added = 0, removed = 0;
  for (const s of sections) {
    const base = new Set(baseSets[s.key]);
    for (const id of s.sel) if (!base.has(id)) added++;
    for (const id of base) if (!s.sel.has(id)) removed++;
  }
  const noChanges = added === 0 && removed === 0;

  const q = query.trim().toLowerCase();
  const visible = sections
    .filter((s) => cat === 'all' || s.key === cat)
    .map((s) => ({ ...s, rows: q ? s.rows.filter((r) => r.label.toLowerCase().includes(q)) : s.rows }))
    // While filtering, groups without hits disappear; otherwise an empty
    // group stays so its "+ Neu" button remains reachable.
    .filter((s) => !q || s.rows.length > 0);

  const tabs = [{ key: 'all', title: 'Alle', on: selected, of: total }].concat(
    sections.map((s) => ({
      key: s.key, title: s.title, on: s.rows.filter((r) => s.sel.has(r.id)).length, of: s.rows.length,
    })));

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFn(next);
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    onSave({
      sensors: [...sensors], actuators: [...actuators], controllers: [...controllers],
      charts: [...charts], programs: [...progs], timers: [...timerIds],
    });
  }

  return (
    <>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} class={`flex h-[640px] max-h-[90vh] w-full max-w-[720px] flex-col ${dialogFrame}`}>
        <div class="flex min-h-0 flex-1 flex-col px-6 pt-6">
          <h2 class="text-xl font-semibold text-fg">Widgets zum Dashboard hinzufügen</h2>
          <p class="mt-1.5 text-sm text-muted">Wähle die Widgets aus, die auf dem Dashboard angezeigt werden sollen.</p>

          <div class="relative mt-5">
            <input type="search" value={query} placeholder="Widgets durchsuchen" aria-label="Widgets durchsuchen"
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              class={`${inp} h-9 w-full pr-10`} />
            <Search size={16} class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          </div>

          <div role="tablist" class="mt-3.5 flex overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)]">
            {tabs.map((t) => {
              const active = cat === t.key;
              return (
                <button key={t.key} type="button" role="tab" aria-selected={active}
                  onClick={() => setCat(t.key)}
                  class={`relative flex h-10 shrink-0 items-center gap-1.5 rounded-t-md px-2.5 text-sm transition-colors hover:text-fg ${
                    active ? 'font-semibold text-fg' : 'text-muted'
                  }`}>
                  <span>{t.title}</span>
                  <span class="font-mono text-[11px] font-normal text-faint">{t.on}/{t.of}</span>
                  {active && <span class="absolute bottom-0 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-accent" />}
                </button>
              );
            })}
          </div>

          <div class="flex items-center justify-between px-1 pb-1.5 pt-2.5 text-xs text-muted">
            <span>{selected} von {total} ausgewählt</span>
            <span>{[added && `${added} hinzugefügt`, removed && `${removed} entfernt`].filter(Boolean).join(' · ')}</span>
          </div>

          <div class="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {visible.map((sec) => {
              const Icon = sec.icon;
              const hits = sec.rows.filter((r) => sec.sel.has(r.id)).length;
              return (
                <section key={sec.key}>
                  <div class="mb-1 mt-2.5 flex items-center justify-between pl-2">
                    <div class="flex items-baseline gap-2">
                      <span class="text-sm font-semibold text-fg">{sec.title}</span>
                      <span class="text-xs text-faint">{hits} von {sec.rows.length}</span>
                    </div>
                    {/* Creating is not a search result — hide it while filtering. */}
                    {!q && sec.add && (
                      <button type="button" onClick={sec.add.onClick}
                        class="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-accent transition-colors hover:bg-subtle-hover">
                        <Plus size={14} />
                        {sec.add.label}
                      </button>
                    )}
                  </div>
                  {sec.rows.map((r) => {
                    const on = sec.sel.has(r.id);
                    return (
                      <label key={r.id}
                        class={`mb-0.5 flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 transition-colors ${
                          on ? 'bg-subtle-hover' : 'hover:bg-subtle-hover'
                        }`}>
                        <input type="checkbox" class="size-4 shrink-0 accent-accent"
                          checked={on} onChange={() => toggle(sec.sel, sec.setSel, r.id)} />
                        <Icon size={18} class="shrink-0 text-muted" />
                        <span class="min-w-0 flex-1 truncate text-sm text-fg">{r.label}</span>
                        {r.detail && (
                          <span class="shrink-0 font-mono text-xs tabular-nums text-faint">{r.detail}</span>
                        )}
                      </label>
                    );
                  })}
                </section>
              );
            })}

            {visible.length === 0 && (
              <p class="px-5 py-14 text-center text-sm text-muted">Keine Widgets gefunden.</p>
            )}
          </div>
        </div>

        <div class="flex shrink-0 gap-2 border-t border-border bg-bg/60 p-6">
          <button type="submit" disabled={noChanges} class={`${btnPrimary} h-10 flex-1`}>Übernehmen</button>
          <button type="button" onClick={onClose} class={`${btnSecondary} h-10 flex-1`}>Abbrechen</button>
        </div>
      </form>
    </div>

    <AddItemModal open={subAddOpen} snap={snap} initialRole={addRole}
      onClose={() => setSubAddOpen(false)}
      onCreated={(role, id, dashboardIds) => {
        if (role === 'sensor') setSensors(new Set([...sensors, ...dashboardIds]));
        else if (role === 'actuator') toggle(actuators, setActuators, id);
        else toggle(controllers, setControllers, id);
      }} />
    </>
  );
}
