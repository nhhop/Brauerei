import { useState, useEffect } from 'preact/hooks';
import type { Snapshot, ProgramConfig, ProgramStep, ProfileLibrary, CondOp } from '../types';
import { btnPrimary, btnSecondary, linkDanger, dialogFrame, dialogFooter, dialogBtnRow, inp } from '../ui';
import { ConfirmModal } from './ConfirmModal';
import { ConditionFields } from './ConditionFields';
import { Segmented } from './Segmented';

type SaveCfg = Pick<ProgramConfig, 'name' | 'controller' | 'steps'>;

interface Props {
  open: boolean;
  snap: Snapshot | null;
  initial?: ProgramConfig;
  // Profile library, for filling the steps from a saved template and for
  // saving the current steps back as one. Both optional — without them the
  // dialog behaves exactly as before.
  library?: ProfileLibrary;
  onSaveAsProfile?: (draft: { name: string; steps: ProgramStep[] }) => void;
  onSave: (cfg: SaveCfg) => void;
  onDelete?: () => void;
  onClose: () => void;
}

// Step row in edit form: values kept as strings so in-progress input survives
// re-renders; parsed on submit. Hold time is entered in minutes (decimals
// allowed → short values usable for testing) and stored as seconds.
interface Row {
  name: string;
  setpoint: string;
  holdMin: string;
  confirm: boolean;
  end: 'hold' | 'sensor';
  // Sensor-trigger condition, kept as strings like the other row fields.
  ref: string;
  op: CondOp;
  value: string;
  hyst: string;
}

function toRow(s: ProgramStep): Row {
  return {
    name: s.name ?? '',
    setpoint: String(s.setpoint),
    holdMin: String(s.holdSec / 60),
    confirm: s.confirm ?? false,
    end: s.end ?? 'hold',
    ref: s.cond?.ref ?? '',
    op: s.cond?.op ?? 'gt',
    value: s.cond ? String(s.cond.value) : '',
    hyst: s.cond ? String(s.cond.hyst) : '0',
  };
}

function emptyRow(): Row {
  return { name: '', setpoint: '', holdMin: '', confirm: false,
    end: 'hold', ref: '', op: 'gt', value: '', hyst: '0' };
}

export function ProgramEditorModal({ open, snap, initial, library, onSaveAsProfile, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [controller, setController] = useState('');
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  // Profile whose steps are waiting for a replace confirmation.
  const [pendingProfile, setPendingProfile] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setController(initial?.controller ?? '');
      setRows(initial?.steps.length ? initial.steps.map(toRow) : [emptyRow()]);
      setPendingProfile(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const controllerIds = (snap?.controllers ?? []).map((c) => c.id);

  function patchRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((prev) => [...prev, emptyRow()]); }
  function removeRow(i: number) { setRows((prev) => prev.filter((_, j) => j !== i)); }
  function moveRow(i: number, dir: -1 | 1) {
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // Applying a profile copies its steps — the program stays independent of the
  // library afterwards. Replaces what's there, after asking if anything is.
  function applyProfile(id: string) {
    const p = library?.profiles.find((x) => x.id === id);
    if (!p) return;
    setRows(p.steps.length ? p.steps.map(toRow) : [emptyRow()]);
  }

  function pickProfile(id: string) {
    if (!id) return;
    const filled = rows.some((r) => r.name.trim() !== '' || r.setpoint.trim() !== '' || r.holdMin.trim() !== '');
    if (filled) setPendingProfile(id);
    else applyProfile(id);
  }

  const num = (s: string) => parseFloat(s.replace(',', '.'));

  const steps: ProgramStep[] = rows
    .filter((r) => isFinite(num(r.setpoint)))
    .map((r) => {
      const step: ProgramStep = {
        name: r.name.trim() || undefined,
        setpoint: num(r.setpoint),
        holdSec: Math.max(0, Math.round((num(r.holdMin) || 0) * 60)),
        confirm: r.confirm,
      };
      if (r.end === 'sensor') {
        step.end = 'sensor';
        step.cond = { ref: r.ref, op: r.op, value: num(r.value), hyst: Math.max(0, num(r.hyst) || 0) };
      }
      return step;
    });

  // A sensor step needs a picked ref and a finite threshold.
  const stepsValid = rows
    .filter((r) => isFinite(num(r.setpoint)) && r.end === 'sensor')
    .every((r) => r.ref !== '' && Number.isFinite(num(r.value)));

  const valid = name.trim() !== '' && controller !== '' && steps.length > 0 && stepsValid;

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!valid) return;
    onSave({ name: name.trim(), controller, steps });
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} class={`max-h-[90vh] w-full max-w-lg ${dialogFrame}`}>
        <div class="min-h-0 overflow-y-auto p-6">
        <h2 class="mb-4 text-base font-medium text-fg">
          {initial ? 'Programm bearbeiten' : 'Neues Programm'}
        </h2>

        <div class="mb-4 flex gap-3">
          <label class="block flex-1">
            <span class="text-xs text-muted">Name</span>
            <input class={`mt-1 ${inp}`}
              value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="z.B. Pils-Maische" autoFocus />
          </label>
          <label class="block flex-1">
            <span class="text-xs text-muted">Regler</span>
            <select class={`mt-1 ${inp}`}
              value={controller}
              onChange={(e) => setController((e.target as HTMLSelectElement).value)}>
              <option value="">— wählen —</option>
              {controllerIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
        </div>

        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs font-medium uppercase tracking-wide text-muted">Schritte</span>
          {library && library.profiles.length > 0 && (
            <label class="flex items-center gap-1.5 text-xs text-muted">
              Aus Profil befüllen
              <select class={`${inp} w-48`} value=""
                onChange={(e) => {
                  const sel = e.target as HTMLSelectElement;
                  pickProfile(sel.value);
                  sel.value = '';
                }}>
                <option value="">— wählen —</option>
                {library.categories.map((c) => {
                  const inCat = library.profiles.filter((p) => p.category === c.id);
                  if (inCat.length === 0) return null;
                  return (
                    <optgroup key={c.id} label={c.name}>
                      {inCat.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </label>
          )}
        </div>
        <div class="space-y-2">
          {rows.map((r, i) => (
            <div key={i} class="rounded-md border border-border p-2">
              <div class="flex items-center gap-2">
                <span class="w-5 shrink-0 text-center text-xs text-faint">{i + 1}</span>
                <input class={`${inp} min-w-0 flex-1`}
                  value={r.name} placeholder="Name (optional, z.B. Maltoserast)"
                  onInput={(e) => patchRow(i, { name: (e.target as HTMLInputElement).value })} />
                <div class="flex shrink-0 flex-col gap-0.5">
                  <button type="button" onClick={() => moveRow(i, -1)} disabled={i === 0}
                    class="text-xs leading-none text-faint hover:text-fg disabled:opacity-30" title="nach oben">▲</button>
                  <button type="button" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1}
                    class="text-xs leading-none text-faint hover:text-fg disabled:opacity-30" title="nach unten">▼</button>
                </div>
                <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                  class="shrink-0 leading-none text-faint hover:text-critical disabled:opacity-30" title="Schritt entfernen">×</button>
              </div>
              <div class="mt-2 space-y-2 pl-7">
                <div class="flex flex-wrap items-center gap-3">
                  <label class="flex items-center gap-1 text-xs text-muted">
                    Sollwert
                    <input type="text" inputMode="decimal"
                      class={`${inp} w-20 text-right`}
                      value={r.setpoint}
                      onInput={(e) => patchRow(i, { setpoint: (e.target as HTMLInputElement).value })} />
                  </label>
                  <Segmented value={r.end}
                    options={[{ value: 'hold', label: 'Zeit' }, { value: 'sensor', label: 'Sensor' }]}
                    onChange={(v) => patchRow(i, { end: v })} />
                  {r.end === 'hold' && (
                    <label class="flex items-center gap-1 text-xs text-muted">
                      Haltezeit (min)
                      <input type="text" inputMode="decimal"
                        class={`${inp} w-20 text-right`}
                        value={r.holdMin}
                        onInput={(e) => patchRow(i, { holdMin: (e.target as HTMLInputElement).value })} />
                    </label>
                  )}
                </div>
                {r.end === 'sensor' && (
                  <ConditionFields snap={snap} refValue={r.ref} op={r.op} value={r.value} hyst={r.hyst}
                    onChange={(p) => patchRow(i, {
                      ...(p.refValue !== undefined && { ref: p.refValue }),
                      ...(p.op !== undefined && { op: p.op }),
                      ...(p.value !== undefined && { value: p.value }),
                      ...(p.hyst !== undefined && { hyst: p.hyst }),
                    })} />
                )}
                <label class="flex cursor-pointer items-center gap-1.5 text-xs text-fg">
                  <input type="checkbox" class="accent-accent"
                    checked={r.confirm}
                    onChange={(e) => patchRow(i, { confirm: (e.target as HTMLInputElement).checked })} />
                  Freigabe abwarten
                </label>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addRow}
          class="mt-2 text-xs text-faint hover:text-fg">
          + Schritt hinzufügen
        </button>

        </div>

        <div class={`${dialogFooter} justify-between`}>
          <div class="flex items-center gap-4">
            {onDelete && (
              <button type="button" onClick={onDelete} class={linkDanger}>
                Löschen
              </button>
            )}
            {onSaveAsProfile && (
              <button type="button" disabled={steps.length === 0}
                onClick={() => onSaveAsProfile({ name: name.trim(), steps })}
                class="text-sm text-muted transition-colors hover:text-fg disabled:opacity-40">
                Als Profil speichern
              </button>
            )}
          </div>
          <div class={dialogBtnRow}>
            <button type="button" onClick={onClose} class={btnSecondary}>
              Abbrechen
            </button>
            <button type="submit" disabled={!valid} class={btnPrimary}>
              {initial ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </div>
      </form>

      <ConfirmModal
        open={pendingProfile !== null}
        title="Schritte ersetzen?"
        confirmLabel="Ersetzen"
        onConfirm={() => { if (pendingProfile) applyProfile(pendingProfile); setPendingProfile(null); }}
        onCancel={() => setPendingProfile(null)}>
        Die vorhandenen Schritte werden durch die des Profils ersetzt.
      </ConfirmModal>
    </div>
  );
}
