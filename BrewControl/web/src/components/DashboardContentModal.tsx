import { useState, useEffect } from 'preact/hooks';
import {
  Gauge, Zap, SlidersHorizontal, LineChart, ListChecks, Timer as TimerIcon,
  Plus, Search, type LucideIcon,
} from 'lucide-preact';
import type {
  Snapshot, DashboardConfig, LogConfig, ProgramConfig, TimerConfig, ItemState, Sensor,
} from '../types';
import { fmtDuration } from '../format';
import type { Role } from '../itemTypes';
import { AddItemModal } from './AddItemModal';
import { parseSensorEntry, sensorEntry } from '../dashboardLayout';
import { btnPrimary, btnSecondary, dialogFrame, dialogScrim, dialogSheet, inp } from '../ui';

// The dashboard lists an added widget's id under this key.
export type WidgetKind = 'sensors' | 'actuators' | 'controllers' | 'charts' | 'programs' | 'timers';

interface Props {
  open: boolean;
  snap: Snapshot | null;
  logs?: LogConfig[];
  programs?: ProgramConfig[];
  timers?: TimerConfig[];
  dash: DashboardConfig;                 // only to grey out what is already there
  onAdd: (kind: WidgetKind, id: string) => void;
  onNewProgram?: () => void;
  onNewTimer?: () => void;
  onClose: () => void;
}

// One widget in the list: `id` is what gets stored in the dashboard config,
// `detail` the right-aligned secondary text that tells two similar ids apart.
// `channels`: a multi-channel sensor, whose "Hinzufügen" asks for the card's
// channels first. `present`: already on the dashboard and only allowed once.
interface Row { id: string; label: string; detail?: string; channels?: Sensor[]; present?: boolean }

interface Section {
  key: WidgetKind;
  title: string;
  icon: LucideIcon;
  rows: Row[];
  // "+ Neuer ..." button of this group. Charts have none: a chart is
  // configured on its own page, not from here.
  add?: { label: string; onClick: () => void };
}

// Snapshot sensors grouped by their base id, in snapshot order.
function groupByBase(sensors: Sensor[], baseId: (id: string) => string): Map<string, Sensor[]> {
  const out = new Map<string, Sensor[]>();
  for (const s of sensors) {
    const base = baseId(s.id);
    const list = out.get(base);
    if (list) list.push(s); else out.set(base, [s]);
  }
  return out;
}

function fmtValue(state: ItemState, unit: string): string {
  const v = state.v;
  if (!state.ok || v == null || !isFinite(v)) return '—';
  return `${v.toFixed(1)} ${unit}`.trim();
}

// Keyless channels (a bare base channel) can't be listed in an entry; they
// only ever show on an "all channels" card.
const keyOf = (s: Sensor) => (s.id.includes('.') ? s.id.slice(s.id.indexOf('.') + 1) : '');

// Widget picker: one entry per widget with an "add" button. It deliberately
// doesn't mirror the dashboard — removing happens with × on the card. A
// multi-channel sensor may sit on a dashboard several times, each card with its
// own channels, so its button first opens the channel selection. Name & delete
// live in NameModal.
export function DashboardContentModal({ open, snap, logs, programs, timers, dash, onAdd, onNewProgram, onNewTimer, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<'all' | WidgetKind>('all');
  const [subAddOpen, setSubAddOpen] = useState(false);
  const [addRole, setAddRole] = useState<Role>('sensor');
  // The multi-channel sensor whose channels are being picked, and the picks.
  const [config, setConfig] = useState<{ base: string; channels: Sensor[] } | null>(null);
  const [cfgKeys, setCfgKeys] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCat('all');
      setConfig(null);
    }
  }, [open]);

  if (!open) return null;

  const snapSensors = snap?.sensors ?? [];
  const baseId = (id: string) => (id.includes('.') ? id.split('.')[0] : id);
  const sensorRows: Row[] = [];
  for (const [base, chs] of groupByBase(snapSensors, baseId)) {
    if (chs.length > 1) {
      sensorRows.push({ id: base, label: base, detail: `${chs.length} Kanäle`, channels: chs });
      continue;
    }
    const s = chs[0];
    sensorRows.push({
      id: s.id, label: s.id, detail: fmtValue(s.state, s.meta.unit),
      present: dash.sensors.some((e) => parseSensorEntry(e).base === base),
    });
  }

  const has = (list: string[] | undefined, id: string) => (list ?? []).includes(id);

  const actuatorRows: Row[] = (snap?.actuators ?? []).map((a) => ({
    id: a.id, label: a.id, present: has(dash.actuators, a.id),
    detail: a.meta.kind === 'Binary'
      ? (a.enabled ? 'An' : 'Aus')
      : fmtValue(a.state, a.meta.unit),
  }));

  const controllerRows: Row[] = (snap?.controllers ?? []).map((c) => {
    const unit = snapSensors.find((s) => s.id === c.params?.sensor)?.meta.unit ?? '';
    return {
      id: c.id, label: c.id, present: has(dash.controllers, c.id),
      detail: `→ ${c.setpoint.toFixed(1)} ${unit}`.trim(),
    };
  });

  const chartRows: Row[] = (logs ?? []).map((l) => ({
    id: l.id, label: l.name, present: has(dash.charts, l.id),
    detail: l.series.length === 1 ? '1 Serie' : `${l.series.length} Serien`,
  }));

  const programRows: Row[] = (programs ?? []).map((p) => ({
    id: p.id, label: p.name, present: has(dash.programs, p.id),
    detail: p.steps.length === 1 ? '1 Schritt' : `${p.steps.length} Schritte`,
  }));

  const timerRows: Row[] = (timers ?? []).map((t) => ({
    id: t.id, label: t.name, present: has(dash.timers, t.id),
    detail: t.mode === 'clock' ? (t.timeOfDay ?? '') : fmtDuration(t.durationSec),
  }));

  const openAdd = (role: Role) => { setAddRole(role); setSubAddOpen(true); };

  const sections: Section[] = ([
    { key: 'sensors',     title: 'Sensoren',  icon: Gauge,             rows: sensorRows,
      add: { label: 'Neuer Sensor', onClick: () => openAdd('sensor') } },
    { key: 'actuators',   title: 'Aktoren',   icon: Zap,               rows: actuatorRows,
      add: { label: 'Neuer Aktor', onClick: () => openAdd('actuator') } },
    { key: 'controllers', title: 'Regler',    icon: SlidersHorizontal, rows: controllerRows,
      add: { label: 'Neuer Regler', onClick: () => openAdd('controller') } },
    { key: 'charts',      title: 'Charts',    icon: LineChart,         rows: chartRows },
    { key: 'programs',    title: 'Programme', icon: ListChecks,        rows: programRows,
      add: onNewProgram && { label: 'Neues Programm', onClick: onNewProgram } },
    { key: 'timers',      title: 'Timer',     icon: TimerIcon,         rows: timerRows,
      add: onNewTimer && { label: 'Neuer Timer', onClick: onNewTimer } },
  ] as Section[])
    // An empty group stays visible when it can be filled from here, so the
    // first sensor of a fresh device is one click away.
    .filter((s) => s.rows.length > 0 || s.add);

  const q = query.trim().toLowerCase();
  const visible = sections
    .filter((s) => cat === 'all' || s.key === cat)
    .map((s) => ({ ...s, rows: q ? s.rows.filter((r) => r.label.toLowerCase().includes(q)) : s.rows }))
    // While filtering, groups without hits disappear; otherwise an empty
    // group stays so its "+ Neu" button remains reachable.
    .filter((s) => !q || s.rows.length > 0);

  const tabs: { key: 'all' | WidgetKind; title: string }[] =
    [{ key: 'all' as const, title: 'Alle' }, ...sections.map((s) => ({ key: s.key, title: s.title }))];

  function add(kind: WidgetKind, r: Row) {
    if (r.channels) {
      setConfig({ base: r.id, channels: r.channels });
      setCfgKeys(r.channels.map(keyOf).filter(Boolean));
      return;
    }
    onAdd(kind, r.id);
    onClose();
  }

  function addCard(e: Event) {
    e.preventDefault();
    if (!config || cfgKeys.length === 0) return;
    onAdd('sensors', sensorEntry(config.base, cfgKeys, config.channels.map(keyOf).filter(Boolean)));
    onClose();
  }

  function toggleKey(k: string) {
    setCfgKeys((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));
  }

  const frame = `flex h-[640px] max-h-[90vh] w-full max-w-[720px] flex-col ${dialogFrame} ${dialogSheet}`;

  return (
    <>
    <div class={dialogScrim}>
      {config ? (
        // Channel selection of a multi-channel sensor's new card.
        <form onSubmit={addCard} class={frame}>
          <div class="flex min-h-0 flex-1 flex-col px-6 pt-6">
            <h2 class="text-xl font-semibold text-fg">{config.base} hinzufügen</h2>
            <p class="mt-1.5 text-sm text-muted">Welche Kanäle soll die Karte zeigen?</p>
            <div class="-mx-2 mt-5 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              <div class="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
                {config.channels.filter((s) => keyOf(s)).map((s) => {
                  const k = keyOf(s);
                  return (
                    <label key={k} class="flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 transition-colors hover:bg-subtle-hover">
                      <input type="checkbox" class="size-4 shrink-0 accent-accent"
                        checked={cfgKeys.includes(k)} onChange={() => toggleKey(k)} />
                      <span class="min-w-0 flex-1 truncate text-sm text-fg">{k}</span>
                      <span class="shrink-0 font-mono text-xs tabular-nums text-faint">{fmtValue(s.state, s.meta.unit)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <div class="flex shrink-0 gap-2 border-t border-border bg-bg/60 p-6">
            <button type="submit" disabled={cfgKeys.length === 0} class={`${btnPrimary} h-10 flex-1`}>Übernehmen</button>
            <button type="button" onClick={() => setConfig(null)} class={`${btnSecondary} h-10 flex-1`}>Zurück</button>
          </div>
        </form>
      ) : (
        <div class={frame}>
          <div class="flex min-h-0 flex-1 flex-col px-6 pt-6">
            <h2 class="text-xl font-semibold text-fg">Widgets zum Dashboard hinzufügen</h2>
            <p class="mt-1.5 text-sm text-muted">Wähle ein Widget, das auf dem Dashboard erscheinen soll.</p>

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
                    class={`relative flex h-10 shrink-0 items-center rounded-t-md px-2.5 text-sm transition-colors hover:text-fg ${
                      active ? 'font-semibold text-fg' : 'text-muted'
                    }`}>
                    <span>{t.title}</span>
                    {active && <span class="absolute bottom-0 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-accent" />}
                  </button>
                );
              })}
            </div>

            <div class="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              {visible.map((sec) => {
                const Icon = sec.icon;
                return (
                  <section key={sec.key}>
                    <div class="mb-1 mt-2.5 flex items-center justify-between pl-2">
                      <span class="text-sm font-semibold text-fg">{sec.title}</span>
                      {/* Creating is not a search result — hide it while filtering. */}
                      {!q && sec.add && (
                        <button type="button" onClick={sec.add.onClick}
                          class="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-accent transition-colors hover:bg-subtle-hover">
                          <Plus size={14} />
                          {sec.add.label}
                        </button>
                      )}
                    </div>
                    {sec.rows.map((r) => (
                      <div key={r.id} class="mb-0.5 flex h-11 items-center gap-3 rounded-md px-3 transition-colors hover:bg-subtle-hover">
                        <Icon size={18} class="shrink-0 text-muted" />
                        <span class="min-w-0 flex-1 truncate text-sm text-fg">{r.label}</span>
                        {r.detail && (
                          <span class="shrink-0 font-mono text-xs tabular-nums text-faint">{r.detail}</span>
                        )}
                        <button type="button" disabled={r.present} onClick={() => add(sec.key, r)}
                          class="flex h-8 w-40 shrink-0 items-center justify-center gap-1.5 rounded-md text-[13px] text-accent transition-colors hover:bg-subtle-hover disabled:text-faint disabled:hover:bg-transparent">
                          {r.present ? 'Auf dem Dashboard' : <><Plus size={14} /> Hinzufügen</>}
                        </button>
                      </div>
                    ))}
                  </section>
                );
              })}

              {visible.length === 0 && (
                <p class="px-5 py-14 text-center text-sm text-muted">Keine Widgets gefunden.</p>
              )}
            </div>
          </div>

          <div class="flex shrink-0 gap-2 border-t border-border bg-bg/60 p-6">
            <button type="button" onClick={onClose} class={`${btnSecondary} h-10 flex-1`}>Schließen</button>
          </div>
        </div>
      )}
    </div>

    {/* A widget created from here lands on the dashboard right away; the
        dialog stays open behind the wizard's success screen. */}
    <AddItemModal open={subAddOpen} snap={snap} initialRole={addRole}
      onClose={() => setSubAddOpen(false)}
      onCreated={(role, id) => {
        onAdd(role === 'sensor' ? 'sensors' : role === 'actuator' ? 'actuators' : 'controllers', id);
      }} />
    </>
  );
}
