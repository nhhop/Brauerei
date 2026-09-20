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
import { btnPrimary, btnSecondary, dialogFrame, dialogFooter, dialogBtnRow, inp } from '../ui';

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

// Show the search field only once scrolling actually becomes a burden.
const SEARCH_THRESHOLD = 8;

const rowBase = 'flex items-center gap-3 border-b border-border px-5 py-2.5 text-left transition-colors';

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

  const q = query.trim().toLowerCase();
  const visible = q
    ? sections
        .map((s) => ({ ...s, rows: s.rows.filter((r) => r.label.toLowerCase().includes(q)) }))
        .filter((s) => s.rows.length > 0)
    : sections;

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
      <form onSubmit={handleSubmit} class={`flex max-h-[85vh] w-full max-w-md flex-col ${dialogFrame}`}>
        <div class="shrink-0 px-5 pb-3 pt-5">
          <h2 class="text-base font-medium text-fg">Dashboard-Inhalte</h2>
          <p class="mt-0.5 text-xs text-muted">{selected} von {total} ausgewählt</p>
          {total > SEARCH_THRESHOLD && (
            <div class="relative mt-3">
              <Search size={14} class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input type="search" value={query} placeholder="Suchen"
                onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                class={`${inp} w-full pl-8`} />
            </div>
          )}
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto border-t border-border">
          {visible.map((sec) => {
            const Icon = sec.icon;
            const hits = sec.rows.filter((r) => sec.sel.has(r.id)).length;
            return (
              <div key={sec.key}>
                <div class="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-1.5">
                  <span class="text-xs font-medium uppercase tracking-wide text-muted">{sec.title}</span>
                  <span class="text-xs tabular-nums text-faint">{hits}/{sec.rows.length}</span>
                </div>
                {sec.rows.map((r) => {
                  const on = sec.sel.has(r.id);
                  return (
                    <label key={r.id}
                      class={`${rowBase} cursor-pointer ${on ? 'bg-accent/10' : 'hover:bg-subtle-hover'}`}>
                      <Icon size={18} class={on ? 'text-accent' : 'text-faint'} />
                      <span class="min-w-0 flex-1 truncate text-sm text-fg">{r.label}</span>
                      {r.detail && (
                        <span class="shrink-0 font-mono text-xs tabular-nums text-muted">{r.detail}</span>
                      )}
                      <input type="checkbox" class="size-4 shrink-0 accent-accent"
                        checked={on} onChange={() => toggle(sec.sel, sec.setSel, r.id)} />
                    </label>
                  );
                })}
                {/* Creating is not a search result — hide it while filtering. */}
                {!q && sec.add && (
                  <button type="button" onClick={sec.add.onClick}
                    class={`${rowBase} w-full text-sm text-fg hover:bg-subtle-hover`}>
                    <Plus size={18} class="text-faint" />
                    {sec.add.label}
                  </button>
                )}
              </div>
            );
          })}

          {visible.length === 0 && (
            <p class="px-5 py-8 text-center text-sm text-muted">Keine Treffer</p>
          )}
        </div>

        <div class={`${dialogFooter} justify-end`}>
          <div class={dialogBtnRow}>
            <button type="button" onClick={onClose} class={btnSecondary}>Abbrechen</button>
            <button type="submit" class={btnPrimary}>Speichern</button>
          </div>
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
