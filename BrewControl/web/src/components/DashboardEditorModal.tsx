import { useState, useEffect } from 'preact/hooks';
import type { Snapshot, DashboardConfig, LogConfig, ProgramConfig } from '../types';
import { AddItemModal } from './AddItemModal';

interface Props {
  open: boolean; snap: Snapshot | null; initial?: DashboardConfig; logs?: LogConfig[]; programs?: ProgramConfig[];
  onSave: (name: string, sensors: string[], actuators: string[], controllers: string[], charts: string[], programs: string[]) => void;
  onNewProgram?: () => void;
  onDelete?: () => void; onClose: () => void;
}

export function DashboardEditorModal({ open, snap, initial, logs, programs, onSave, onNewProgram, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [sensors, setSensors] = useState<Set<string>>(new Set());
  const [actuators, setActuators] = useState<Set<string>>(new Set());
  const [controllers, setControllers] = useState<Set<string>>(new Set());
  const [charts, setCharts] = useState<Set<string>>(new Set());
  const [progs, setProgs] = useState<Set<string>>(new Set());
  const [subAddOpen, setSubAddOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setSensors(new Set(initial?.sensors ?? []));
      setActuators(new Set(initial?.actuators ?? []));
      setControllers(new Set(initial?.controllers ?? []));
      setCharts(new Set(initial?.charts ?? []));
      setProgs(new Set(initial?.programs ?? []));
    }
  }, [open, initial]);

  if (!open) return null;

  const sensorIds = [...new Set(
    (snap?.sensors ?? []).map((s) => s.id.includes('.') ? s.id.split('.')[0] : s.id)
  )];
  const actuatorIds = (snap?.actuators ?? []).map((a) => a.id);
  const controllerIds = (snap?.controllers ?? []).map((c) => c.id);

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFn(next);
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), [...sensors], [...actuators], [...controllers], [...charts], [...progs]);
  }

  return (
    <>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} class="w-full max-w-md rounded-xl bg-surface p-6 shadow-lg">
        <h2 class="mb-4 text-base font-medium text-fg">
          {initial ? 'Dashboard bearbeiten' : 'Neues Dashboard'}
        </h2>

        <label class="mb-4 block">
          <span class="text-xs text-muted">Name</span>
          <input class="mt-1 w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border"
            value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="z.B. Maischen" autoFocus />
        </label>

        {sensorIds.length > 0 && (
          <fieldset class="mb-3">
            <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Sensoren</legend>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5">
              {sensorIds.map((id) => (
                <label key={id} class="flex cursor-pointer items-center gap-1.5 text-sm text-fg">
                  <input type="checkbox" class="accent-accent"
                    checked={sensors.has(id)}
                    onChange={() => toggle(sensors, setSensors, id)} />
                  {id}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {actuatorIds.length > 0 && (
          <fieldset class="mb-3">
            <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Aktoren</legend>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5">
              {actuatorIds.map((id) => (
                <label key={id} class="flex cursor-pointer items-center gap-1.5 text-sm text-fg">
                  <input type="checkbox" class="accent-accent"
                    checked={actuators.has(id)}
                    onChange={() => toggle(actuators, setActuators, id)} />
                  {id}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {controllerIds.length > 0 && (
          <fieldset class="mb-3">
            <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Regler</legend>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5">
              {controllerIds.map((id) => (
                <label key={id} class="flex cursor-pointer items-center gap-1.5 text-sm text-fg">
                  <input type="checkbox" class="accent-accent"
                    checked={controllers.has(id)}
                    onChange={() => toggle(controllers, setControllers, id)} />
                  {id}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {logs && logs.length > 0 && (
          <fieldset class="mb-3">
            <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Charts</legend>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5">
              {logs.map((l) => (
                <label key={l.id} class="flex cursor-pointer items-center gap-1.5 text-sm text-fg">
                  <input type="checkbox" class="accent-accent"
                    checked={charts.has(l.id)}
                    onChange={() => toggle(charts, setCharts, l.id)} />
                  {l.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {programs && programs.length > 0 && (
          <fieldset class="mb-3">
            <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Programme</legend>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5">
              {programs.map((p) => (
                <label key={p.id} class="flex cursor-pointer items-center gap-1.5 text-sm text-fg">
                  <input type="checkbox" class="accent-accent"
                    checked={progs.has(p.id)}
                    onChange={() => toggle(progs, setProgs, p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div class="mt-1 flex flex-col items-start gap-1">
          <button type="button" onClick={() => setSubAddOpen(true)}
            class="text-xs text-faint hover:text-fg">
            + Neues Gerät erstellen
          </button>
          {onNewProgram && (
            <button type="button" onClick={onNewProgram}
              class="text-xs text-faint hover:text-fg">
              + Neues Programm erstellen
            </button>
          )}
        </div>

        <div class="mt-4 flex items-center justify-between gap-2">
          {onDelete ? (
            <button type="button" onClick={onDelete} class="text-sm text-red-500 hover:text-red-700">
              Löschen
            </button>
          ) : <span />}
          <div class="flex gap-2">
            <button type="button" onClick={onClose}
              class="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:bg-fg/5">
              Abbrechen
            </button>
            <button type="submit" disabled={!name.trim()}
              class="rounded-md bg-fg px-3 py-1.5 text-sm text-bg hover:bg-fg/80 disabled:opacity-40">
              {initial ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </div>
      </form>
    </div>

    <AddItemModal open={subAddOpen} snap={snap}
      onClose={() => setSubAddOpen(false)}
      onCreated={(role, id) => {
        if (role === 'sensor') toggle(sensors, setSensors, id);
        else if (role === 'actuator') toggle(actuators, setActuators, id);
        else toggle(controllers, setControllers, id);
      }} />
    </>
  );
}
