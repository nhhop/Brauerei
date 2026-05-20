import { useState } from 'preact/hooks';
import type { Controller } from '../types';
import { setControllerSetpoint, setControllerParams } from '../api';

export function ControllerCard({ controller, onDelete }: { controller: Controller; onDelete?: () => void }) {
  const { id, setpoint, params } = controller;
  // Local edit state intentionally not synced from server snapshots — once
  // the user starts typing, we don't clobber their input with incoming
  // pushes. Server value is reflected via the placeholder + initial value.
  const [sp, setSp] = useState(setpoint.toString());
  const [pj, setPj] = useState(params ? JSON.stringify(params, null, 2) : '');
  const [err, setErr] = useState<string | null>(null);

  async function applySp() {
    const n = parseFloat(sp);
    if (isNaN(n)) {
      setErr('invalid setpoint');
      return;
    }
    setErr(null);
    try { await setControllerSetpoint(id, n); }
    catch (e) { setErr(String(e)); }
  }

  async function applyParams() {
    try {
      const obj = JSON.parse(pj);
      setErr(null);
      await setControllerParams(id, obj);
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium text-stone-900">{id}</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-stone-500">live: {setpoint.toFixed(2)}</span>
          {onDelete && (
            <button type="button" onClick={onDelete} title="Delete"
              class="text-stone-400 hover:text-red-600 leading-none">×</button>
          )}
        </div>
      </div>

      <div class="mt-3">
        <label class="block text-xs text-stone-500">Setpoint</label>
        <div class="mt-1 flex gap-2">
          <input
            type="number"
            step="any"
            value={sp}
            onInput={(e) => setSp((e.target as HTMLInputElement).value)}
            class="w-full rounded border border-stone-300 px-2 py-1 font-mono text-sm"
          />
          <button
            onClick={applySp}
            class="rounded bg-stone-900 px-3 py-1 text-sm text-white"
          >
            Apply
          </button>
        </div>
      </div>

      {params && (
        <div class="mt-3">
          <label class="block text-xs text-stone-500">Params (JSON)</label>
          <textarea
            value={pj}
            onInput={(e) => setPj((e.target as HTMLTextAreaElement).value)}
            rows={Math.min(8, pj.split('\n').length + 1)}
            class="mt-1 w-full rounded border border-stone-300 px-2 py-1 font-mono text-xs"
          />
          <button
            onClick={applyParams}
            class="mt-2 rounded bg-stone-900 px-3 py-1 text-sm text-white"
          >
            Apply
          </button>
        </div>
      )}

      {err && <p class="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
