import { useState, useEffect } from 'preact/hooks';
import type { Snapshot, DashboardConfig } from '../types';
import { AddItemModal } from './AddItemModal';

interface Props {
  open: boolean;
  snap: Snapshot | null;
  initial?: DashboardConfig;
  onSave: (name: string, sensors: string[], actuators: string[], controllers: string[]) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function DashboardEditorModal({ open, snap, initial, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [sensors, setSensors] = useState<Set<string>>(new Set());
  const [actuators, setActuators] = useState<Set<string>>(new Set());
  const [controllers, setControllers] = useState<Set<string>>(new Set());
  const [subAddOpen, setSubAddOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setSensors(new Set(initial?.sensors ?? []));
      setActuators(new Set(initial?.actuators ?? []));
      setControllers(new Set(initial?.controllers ?? []));
    }
  }, [open, initial]);

  if (!open) return null;

  // Deduplicate sensors by base ID (multi-channel sensors share a base)
  const sensorIds = [...new Set(
    (snap?.sensors ?? []).map(s => s.id.includes('.') ? s.id.split('.')[0] : s.id)
  )];
  const actuatorIds = (snap?.actuators ?? []).map(a => a.id);
  const controllerIds = (snap?.controllers ?? []).map(c => c.id);

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFn(next);
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), [...sensors], [...actuators], [...controllers]);
  }

  return (
    <>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit}
        class="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h2 class="mb-4 text-base font-medium text-stone-900">
          {initial ? 'Dashboard bearbeiten' : 'Neues Dashboard'}
        </h2>

        <label class="mb-4 block">
          <span class="text-xs text-stone-500">Name</span>
          <input
            class="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
            value={name}
            onInput={e => setName((e.target as HTMLInputElement).value)}
            placeholder="z.B. Maischen"
            autoFocus
          />
        </label>

        {sensorIds.length > 0 && (
          <fieldset class="mb-3">
            <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-500">
              Sensoren
            </legend>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5">
              {sensorIds.map(id => (
                <label key={id} class="flex cursor-pointer items-center gap-1.5 text-sm text-stone-800">
                  <input type="checkbox" class="accent-stone-800"
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
            <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-500">
              Aktoren
            </legend>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5">
              {actuatorIds.map(id => (
                <label key={id} class="flex cursor-pointer items-center gap-1.5 text-sm text-stone-800">
                  <input type="checkbox" class="accent-stone-800"
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
            <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-500">
              Regler
            </legend>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5">
              {controllerIds.map(id => (
                <label key={id} class="flex cursor-pointer items-center gap-1.5 text-sm text-stone-800">
                  <input type="checkbox" class="accent-stone-800"
                    checked={controllers.has(id)}
                    onChange={() => toggle(controllers, setControllers, id)} />
                  {id}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <button type="button" onClick={() => setSubAddOpen(true)}
          class="mt-1 text-xs text-stone-400 hover:text-stone-700">
          + Neues Gerät erstellen
        </button>

        <div class="mt-4 flex items-center justify-between gap-2">
          {onDelete ? (
            <button type="button" onClick={onDelete}
              class="text-sm text-red-500 hover:text-red-700">
              Löschen
            </button>
          ) : <span />}
          <div class="flex gap-2">
            <button type="button" onClick={onClose}
              class="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
              Abbrechen
            </button>
            <button type="submit" disabled={!name.trim()}
              class="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700 disabled:opacity-40">
              {initial ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </div>
      </form>
    </div>

    <AddItemModal
      open={subAddOpen}
      snap={snap}
      onClose={() => setSubAddOpen(false)}
      onCreated={(role, id) => {
        if (role === 'sensor') toggle(sensors, setSensors, id);
        else if (role === 'actuator') toggle(actuators, setActuators, id);
        else toggle(controllers, setControllers, id);
      }}
    />
    </>
  );
}
