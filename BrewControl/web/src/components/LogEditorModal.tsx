import { useState, useEffect } from 'preact/hooks';
import type { Snapshot, LogConfig, CompAlgo } from '../types';

type SaveCfg = Omit<LogConfig, 'id' | 'session'>;

interface Props {
  open: boolean;
  snap: Snapshot | null;
  initial?: LogConfig;
  onSave: (cfg: SaveCfg) => void;
  onClose: () => void;
}

const ALGOS: { value: CompAlgo; label: string }[] = [
  { value: 'none', label: 'Keine (jeder Wert)' },
  { value: 'linear', label: 'Linear-Interpolation' },
  { value: 'swingingdoor', label: 'Swinging Door' },
];

// Builds the selectable series refs from the current snapshot, grouped by role.
// Sensor ids already carry the sub-channel suffix (e.g. "bme280.temp").
function refGroups(snap: Snapshot | null) {
  return [
    { legend: 'Sensoren', refs: (snap?.sensors ?? []).map((s) => `sensor/${s.id}`) },
    { legend: 'Aktoren', refs: (snap?.actuators ?? []).map((a) => `actuator/${a.id}`) },
    { legend: 'Regler (Sollwert)', refs: (snap?.controllers ?? []).map((c) => `controller/${c.id}`) },
  ];
}

export function LogEditorModal({ open, snap, initial, onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [intervalSec, setIntervalSec] = useState(5);
  const [algo, setAlgo] = useState<CompAlgo>('none');
  const [maxGapSec, setMaxGapSec] = useState(600);
  const [bindEnableTo, setBindEnableTo] = useState('');
  // ref → tolerance; presence in the map means the series is selected.
  const [tols, setTols] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setIntervalSec(initial?.intervalSec ?? 5);
      setAlgo(initial?.algo ?? 'none');
      setMaxGapSec(initial?.maxGapSec ?? 600);
      setBindEnableTo(initial?.bindEnableTo ?? '');
      setTols(new Map(initial?.series.map((s) => [s.ref, s.tol]) ?? []));
    }
  }, [open, initial]);

  if (!open) return null;

  function toggle(ref: string) {
    setTols((prev) => {
      const next = new Map(prev);
      if (next.has(ref)) next.delete(ref); else next.set(ref, 0);
      return next;
    });
  }

  function setTol(ref: string, v: number) {
    setTols((prev) => new Map(prev).set(ref, v));
  }

  // Controllers among the selected series — candidates for the enable binding.
  const boundControllers = [...tols.keys()]
    .filter((ref) => ref.startsWith('controller/'))
    .map((ref) => ref.slice('controller/'.length));

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim() || tols.size === 0) return;
    const series = [...tols].map(([ref, tol]) => ({ ref, tol }));
    const bind = boundControllers.includes(bindEnableTo) ? bindEnableTo : '';
    onSave({
      name: name.trim(),
      intervalSec: Math.max(1, intervalSec),
      algo,
      maxGapSec: Math.max(0, maxGapSec),
      enabled: initial?.enabled ?? true,
      bindEnableTo: bind,
      series,
    });
  }

  const showTol = algo !== 'none';
  const groups = refGroups(snap);

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-surface p-6 shadow-lg">
        <h2 class="mb-4 text-base font-medium text-fg">
          {initial ? 'Log bearbeiten' : 'Neues Log'}
        </h2>

        <div class="mb-4 flex gap-3">
          <label class="block flex-1">
            <span class="text-xs text-muted">Name</span>
            <input class="mt-1 w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border"
              value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="z.B. Maischen" autoFocus />
          </label>
          <label class="block w-24">
            <span class="text-xs text-muted">Intervall (s)</span>
            <input type="number" min={1}
              class="mt-1 w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border"
              value={intervalSec}
              onInput={(e) => setIntervalSec(Number((e.target as HTMLInputElement).value))} />
          </label>
        </div>

        <div class="mb-4 flex gap-3">
          <label class="block flex-1">
            <span class="text-xs text-muted">Kompression</span>
            <select class="mt-1 w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border"
              value={algo}
              onChange={(e) => setAlgo((e.target as HTMLSelectElement).value as CompAlgo)}>
              {ALGOS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
          {showTol && (
            <label class="block w-28">
              <span class="text-xs text-muted">Max. Lücke (s)</span>
              <input type="number" min={0}
                class="mt-1 w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border"
                value={maxGapSec}
                onInput={(e) => setMaxGapSec(Number((e.target as HTMLInputElement).value))} />
            </label>
          )}
        </div>

        {groups.map((g) => g.refs.length > 0 && (
          <fieldset key={g.legend} class="mb-3">
            <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{g.legend}</legend>
            <div class="space-y-1.5">
              {g.refs.map((ref) => {
                const sel = tols.has(ref);
                return (
                  <div key={ref} class="flex items-center gap-2">
                    <label class="flex flex-1 cursor-pointer items-center gap-1.5 text-sm text-fg">
                      <input type="checkbox" class="accent-accent"
                        checked={sel} onChange={() => toggle(ref)} />
                      {ref.slice(ref.indexOf('/') + 1)}
                    </label>
                    {sel && showTol && (
                      <label class="flex items-center gap-1 text-xs text-muted">
                        ±
                        <input type="number" step="any" min={0}
                          class="w-20 rounded border border-border bg-surface px-1.5 py-1 text-right text-fg focus:outline-none focus:ring-1 focus:ring-border"
                          value={tols.get(ref) ?? 0}
                          onInput={(e) => setTol(ref, Number((e.target as HTMLInputElement).value))} />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        {boundControllers.length > 0 && (
          <label class="mb-3 block">
            <span class="text-xs text-muted">Logging an Regler koppeln</span>
            <select class="mt-1 w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border"
              value={bindEnableTo}
              onChange={(e) => setBindEnableTo((e.target as HTMLSelectElement).value)}>
              <option value="">Nicht gekoppelt (manueller Schalter)</option>
              {boundControllers.map((id) => (
                <option key={id} value={id}>{id} (an/aus folgt Regler)</option>
              ))}
            </select>
          </label>
        )}

        <div class="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose}
            class="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:bg-fg/5">
            Abbrechen
          </button>
          <button type="submit" disabled={!name.trim() || tols.size === 0}
            class="rounded-md bg-fg px-3 py-1.5 text-sm text-bg hover:bg-fg/80 disabled:opacity-40">
            {initial ? 'Speichern' : 'Erstellen'}
          </button>
        </div>
      </form>
    </div>
  );
}
