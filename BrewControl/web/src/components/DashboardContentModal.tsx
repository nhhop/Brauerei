import { useState, useEffect } from 'preact/hooks';
import type { Snapshot, DashboardConfig, LogConfig, ProgramConfig } from '../types';
import { AddItemModal } from './AddItemModal';
import { btnPrimary, btnSecondary, dialogFrame, dialogFooter, dialogBtnRow } from '../ui';

export interface DashboardMembers {
  sensors: string[]; actuators: string[]; controllers: string[]; charts: string[]; programs: string[];
}

interface Props {
  open: boolean;
  snap: Snapshot | null;
  logs?: LogConfig[];
  programs?: ProgramConfig[];
  dash: DashboardConfig;                 // current membership to preselect
  onSave: (members: DashboardMembers) => void;
  onNewProgram?: () => void;
  onClose: () => void;
}

// Content picker: check which sensors / actuators / controllers / charts /
// programs the dashboard shows. Name & delete live in DashboardMetaModal.
export function DashboardContentModal({ open, snap, logs, programs, dash, onSave, onNewProgram, onClose }: Props) {
  const [sensors, setSensors] = useState<Set<string>>(new Set());
  const [actuators, setActuators] = useState<Set<string>>(new Set());
  const [controllers, setControllers] = useState<Set<string>>(new Set());
  const [charts, setCharts] = useState<Set<string>>(new Set());
  const [progs, setProgs] = useState<Set<string>>(new Set());
  const [subAddOpen, setSubAddOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSensors(new Set(dash.sensors));
      setActuators(new Set(dash.actuators));
      setControllers(new Set(dash.controllers));
      setCharts(new Set(dash.charts ?? []));
      setProgs(new Set(dash.programs ?? []));
    }
  }, [open, dash]);

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
    onSave({
      sensors: [...sensors], actuators: [...actuators], controllers: [...controllers],
      charts: [...charts], programs: [...progs],
    });
  }

  return (
    <>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} class={`flex max-h-[85vh] w-full max-w-md flex-col ${dialogFrame}`}>
        <div class="min-h-0 flex-1 overflow-y-auto p-6">
          <h2 class="mb-4 text-base font-medium text-fg">Dashboard-Inhalte</h2>

          {sensorIds.length > 0 && (
            <fieldset class="mb-3">
              <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Sensoren</legend>
              <div class="flex flex-wrap gap-x-4 gap-y-1.5">
                {sensorIds.map((id) => (
                  <label key={id} class="flex cursor-pointer items-center gap-1.5 text-sm text-fg">
                    <input type="checkbox" class="accent-accent"
                      checked={sensors.has(id)} onChange={() => toggle(sensors, setSensors, id)} />
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
                      checked={actuators.has(id)} onChange={() => toggle(actuators, setActuators, id)} />
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
                      checked={controllers.has(id)} onChange={() => toggle(controllers, setControllers, id)} />
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
                      checked={charts.has(l.id)} onChange={() => toggle(charts, setCharts, l.id)} />
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
                      checked={progs.has(p.id)} onChange={() => toggle(progs, setProgs, p.id)} />
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
        </div>

        <div class={`${dialogFooter} justify-end`}>
          <div class={dialogBtnRow}>
            <button type="button" onClick={onClose} class={btnSecondary}>Abbrechen</button>
            <button type="submit" class={btnPrimary}>Speichern</button>
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
