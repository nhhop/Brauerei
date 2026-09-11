import type { ComponentChildren } from 'preact';
import type { Snapshot, ProgramStep, StepTarget, CondOp } from '../types';
import { inp } from '../ui';
import { ConditionFields } from './ConditionFields';
import { Segmented } from './Segmented';
import {
  targetKind, targetUnit, hasInterval, programIds,
  pickHoldUnit, holdUnitMultiplier, type HoldUnit,
} from '../program';
import { pickIntervalUnit, intervalUnitMultiplier, type IntervalUnit } from '../intervalUnit';

// The column + step editor shared by ProgramEditorModal and ProfileEditorModal.
// Columns are the controllers/actuators the program drives; every step has one
// cell per column, and an empty cell (or an empty field in it) means "leave this
// unchanged". On the wire only filled fields travel — see ProgramStep.targets.
//
// All inputs are raw strings so in-progress input like "7," survives a
// re-render; stepsFromDraft() parses them.

export interface Cell {
  enabled: '' | 'on' | 'off';   // '' = leave unchanged
  v: string;                    // '' = leave unchanged
  on: string;                   // duty cycle, in `unit`; both empty = leave unchanged
  period: string;
  unit: IntervalUnit;
}

export interface StepRow {
  name: string;
  cells: Cell[];                // aligned with StepsDraft.cols
  hold: string;
  holdUnit: HoldUnit;
  confirm: boolean;
  end: 'hold' | 'sensor';
  // Sensor-trigger condition (PR #35), strings like the other fields.
  ref: string;
  op: CondOp;
  value: string;
  hyst: string;
}

export interface StepsDraft {
  cols: string[];               // target ids; '' = not picked yet
  rows: StepRow[];
}

const num = (s: string) => parseFloat(s.replace(',', '.'));

function emptyCell(): Cell {
  return { enabled: '', v: '', on: '', period: '', unit: 'min' };
}

function cellIsEmpty(c: Cell): boolean {
  return c.enabled === '' && c.v.trim() === '' && c.on.trim() === '' && c.period.trim() === '';
}

function emptyRow(cols: number): StepRow {
  return {
    name: '', cells: Array.from({ length: cols }, emptyCell), hold: '', holdUnit: 'min',
    confirm: false, end: 'hold', ref: '', op: 'gt', value: '', hyst: '0',
  };
}

function cellFromTarget(t: StepTarget | undefined): Cell {
  const c = emptyCell();
  if (!t) return c;
  if (t.enabled !== undefined) c.enabled = t.enabled ? 'on' : 'off';
  if (t.v !== undefined) c.v = String(t.v);
  if (t.interval) {
    c.unit = pickIntervalUnit(t.interval.periodSec);
    const mult = intervalUnitMultiplier(c.unit);
    c.on = String(t.interval.onSec / mult);
    c.period = String(t.interval.periodSec / mult);
  }
  return c;
}

function targetFromCell(c: Cell): StepTarget | null {
  const t: StepTarget = {};
  if (c.enabled !== '') t.enabled = c.enabled === 'on';
  if (c.v.trim() !== '' && Number.isFinite(num(c.v))) t.v = num(c.v);
  if (c.on.trim() !== '' || c.period.trim() !== '') {
    const mult = intervalUnitMultiplier(c.unit);
    t.interval = {
      onSec: Math.round((num(c.on) || 0) * mult),
      periodSec: Math.round((num(c.period) || 0) * mult),
    };
  }
  return Object.keys(t).length > 0 ? t : null;
}

export function draftFromSteps(steps: ProgramStep[] | undefined): StepsDraft {
  const list = steps ?? [];
  const cols = programIds(list);
  const rows = list.map((s): StepRow => {
    const holdUnit = pickHoldUnit(s.holdSec);
    return {
      name: s.name ?? '',
      cells: cols.map((id) => cellFromTarget(s.targets[id])),
      hold: String(s.holdSec / holdUnitMultiplier(holdUnit)),
      holdUnit,
      confirm: s.confirm ?? false,
      end: s.end ?? 'hold',
      ref: s.cond?.ref ?? '',
      op: s.cond?.op ?? 'gt',
      value: s.cond ? String(s.cond.value) : '',
      hyst: s.cond ? String(s.cond.hyst) : '0',
    };
  });
  return { cols, rows: rows.length ? rows : [emptyRow(cols.length)] };
}

export function stepsFromDraft(d: StepsDraft): ProgramStep[] {
  return d.rows.map((r) => {
    const targets: Record<string, StepTarget> = {};
    d.cols.forEach((id, i) => {
      const t = targetFromCell(r.cells[i]);
      if (t) targets[id] = t;
    });
    const step: ProgramStep = {
      name: r.name.trim() || undefined,
      targets,
      holdSec: Math.max(0, Math.round((num(r.hold) || 0) * holdUnitMultiplier(r.holdUnit))),
      confirm: r.confirm,
    };
    if (r.end === 'sensor') {
      step.end = 'sensor';
      step.cond = { ref: r.ref, op: r.op, value: num(r.value), hyst: Math.max(0, num(r.hyst) || 0) };
    }
    return step;
  });
}

// True once anything was entered — decides whether replacing the steps with a
// profile's needs a confirmation.
export function draftHasContent(d: StepsDraft): boolean {
  return d.cols.length > 0 ||
    d.rows.some((r) => r.name.trim() !== '' || r.hold.trim() !== '' || r.end === 'sensor');
}

// Why the draft can't be saved yet, or null. requireExisting: a program may only
// name items that exist right now; a profile is a template and may name items
// this device doesn't have — but never leave a column unpicked.
export function draftProblem(d: StepsDraft, snap: Snapshot | null, requireExisting: boolean): string | null {
  if (d.rows.length === 0) return 'Mindestens ein Schritt ist nötig.';
  if (d.cols.some((id) => id === '')) return 'Jede Spalte braucht einen Regler oder Aktor.';
  if (requireExisting && d.cols.some((id) => targetKind(snap, id) === 'missing'))
    return 'Ein gewählter Regler oder Aktor existiert nicht (mehr).';
  for (const r of d.rows) {
    for (const c of r.cells) {
      if (c.v.trim() !== '' && !Number.isFinite(num(c.v))) return 'Ein Wert ist keine Zahl.';
      if (c.on.trim() !== '' || c.period.trim() !== '') {
        const period = num(c.period);
        const on = num(c.on) || 0;
        if (!(period > 0) || on < 0 || on > period)
          return 'Intervall: „an“ muss zwischen 0 und der Periode liegen, die Periode über 0.';
      }
    }
    if (r.end === 'hold' && r.hold.trim() !== '' && !(num(r.hold) >= 0)) return 'Eine Haltezeit ist ungültig.';
    if (r.end === 'sensor' && (r.ref === '' || !Number.isFinite(num(r.value))))
      return 'Ein Sensor-Schritt braucht einen überwachten Wert und einen Grenzwert.';
  }
  return null;
}

interface Props {
  snap: Snapshot | null;
  draft: StepsDraft;
  // Takes an updater so quick successive edits never work on a stale draft —
  // pass the useState setter straight through.
  onChange: (update: (d: StepsDraft) => StepsDraft) => void;
  stepsHeaderExtra?: ComponentChildren;   // e.g. the "Aus Profil befüllen" select
}

export function ProgramStepsEditor({ snap, draft, onChange, stepsHeaderExtra }: Props) {
  const { cols, rows } = draft;

  // Actuators a controller drives would be overwritten on its next tick, so
  // they aren't offered as targets.
  const bound = new Set<string>();
  for (const c of snap?.controllers ?? []) {
    for (const k of ['actuator', 'heatActuator', 'coolActuator'] as const) {
      const a = c.params?.[k];
      if (typeof a === 'string' && a) bound.add(a);
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────
  function setCol(i: number, id: string) {
    onChange((d) => ({ ...d, cols: d.cols.map((c, j) => (j === i ? id : c)) }));
  }
  function addCol() {
    onChange((d) => ({
      cols: [...d.cols, ''],
      rows: d.rows.map((r) => ({ ...r, cells: [...r.cells, emptyCell()] })),
    }));
  }
  function removeCol(i: number) {
    onChange((d) => ({
      cols: d.cols.filter((_, j) => j !== i),
      rows: d.rows.map((r) => ({ ...r, cells: r.cells.filter((_, j) => j !== i) })),
    }));
  }

  // ── Rows ───────────────────────────────────────────────────────────────────
  function patchRow(i: number, patch: Partial<StepRow>) {
    onChange((d) => ({ ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  }
  function patchCell(ri: number, ci: number, patch: Partial<Cell>) {
    onChange((d) => ({
      ...d,
      rows: d.rows.map((r, j) => {
        if (j !== ri) return r;
        const prev = r.cells[ci];
        let next = { ...prev, ...patch };
        // A value typed into an empty cell means "drive it": preselect Ein, or
        // a disabled item would silently ignore the value. An explicit choice
        // of the switch itself is left alone.
        if (cellIsEmpty(prev) && patch.enabled === undefined && !cellIsEmpty(next))
          next = { ...next, enabled: 'on' };
        return { ...r, cells: r.cells.map((c, k) => (k === ci ? next : c)) };
      }),
    }));
  }
  function addRow() {
    onChange((d) => ({ ...d, rows: [...d.rows, emptyRow(d.cols.length)] }));
  }
  function removeRow(i: number) {
    onChange((d) => ({ ...d, rows: d.rows.filter((_, j) => j !== i) }));
  }
  function moveRow(i: number, dir: -1 | 1) {
    onChange((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.rows.length) return d;
      const next = [...d.rows];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...d, rows: next };
    });
  }

  function colSelect(i: number) {
    const cur = cols[i];
    const used = new Set(cols.filter((_, j) => j !== i));
    const controllers = (snap?.controllers ?? []).map((c) => c.id).filter((id) => !used.has(id));
    const actuators = (snap?.actuators ?? []).map((a) => a.id).filter((id) => !used.has(id) && !bound.has(id));
    const listed = cur === '' || controllers.includes(cur) || actuators.includes(cur);
    return (
      <div key={i} class="flex items-center gap-1">
        <select class={`${inp} w-44!`} value={cur} title="Regler oder Aktor"
          onChange={(e) => setCol(i, (e.target as HTMLSelectElement).value)}>
          <option value="">— wählen —</option>
          {!listed && (
            <option value={cur}>{targetKind(snap, cur) === 'missing' ? `${cur} (fehlt)` : cur}</option>
          )}
          {controllers.length > 0 && (
            <optgroup label="Regler">
              {controllers.map((id) => <option key={id} value={id}>{id}</option>)}
            </optgroup>
          )}
          {actuators.length > 0 && (
            <optgroup label="Aktoren">
              {actuators.map((id) => <option key={id} value={id}>{id}</option>)}
            </optgroup>
          )}
        </select>
        <button type="button" onClick={() => removeCol(i)} title="Spalte entfernen"
          class="shrink-0 px-1 leading-none text-faint hover:text-critical">×</button>
      </div>
    );
  }

  function cellFields(ri: number, ci: number) {
    const id = cols[ci];
    const cell = rows[ri].cells[ci];
    const kind = targetKind(snap, id);
    const unit = targetUnit(snap, id);
    // An interval already stored stays visible even if the actuator lost its
    // schedule, so editing never hides (and silently keeps) a value.
    const showInterval = hasInterval(snap, id) || cell.on !== '' || cell.period !== '';
    return (
      <div key={ci} class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span title={id}
          class={`w-28 shrink-0 truncate font-mono text-xs ${kind === 'missing' ? 'text-critical' : 'text-muted'}`}>
          {id || '— Spalte wählen —'}
        </span>
        <select class={`${inp} w-20!`} value={cell.enabled} title="Schalter — leer lässt ihn unverändert"
          onChange={(e) => patchCell(ri, ci, { enabled: (e.target as HTMLSelectElement).value as Cell['enabled'] })}>
          <option value="">—</option>
          <option value="on">Ein</option>
          <option value="off">Aus</option>
        </select>
        {kind !== 'binary' && (
          <label class="flex items-center gap-1 text-xs text-muted"
            title={kind === 'impulse' ? 'Impulse bei Schrittbeginn — einmal pro Lauf' : 'Leer lässt den Wert unverändert'}>
            <input type="text" inputMode="decimal" placeholder="—"
              class={`${inp} w-20! text-right`}
              value={cell.v}
              onInput={(e) => patchCell(ri, ci, { v: (e.target as HTMLInputElement).value })} />
            {kind === 'impulse' ? 'Impulse' : unit}
          </label>
        )}
        {showInterval && (
          <span class="flex items-center gap-1 text-xs text-muted" title="Intervallbetrieb — leer lässt ihn unverändert">
            an
            <input type="text" inputMode="decimal" placeholder="—"
              class={`${inp} w-14! text-right`}
              value={cell.on}
              onInput={(e) => patchCell(ri, ci, { on: (e.target as HTMLInputElement).value })} />
            von
            <input type="text" inputMode="decimal" placeholder="—"
              class={`${inp} w-14! text-right`}
              value={cell.period}
              onInput={(e) => patchCell(ri, ci, { period: (e.target as HTMLInputElement).value })} />
            <select class={`${inp} w-16!`} value={cell.unit} title="Einheit"
              onChange={(e) => patchCell(ri, ci, { unit: (e.target as HTMLSelectElement).value as IntervalUnit })}>
              <option value="s">s</option>
              <option value="min">min</option>
              <option value="h">h</option>
            </select>
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <div class="mb-4">
        <div class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Steuert</div>
        <div class="flex flex-wrap items-center gap-2">
          {cols.map((_, i) => colSelect(i))}
          <button type="button" onClick={addCol} class="text-xs text-faint hover:text-fg">
            + Regler/Aktor
          </button>
        </div>
        {cols.length === 0 && (
          <p class="mt-1.5 text-xs text-muted">
            Wähle, welche Regler und Aktoren das Programm steuert. Jeder Schritt
            setzt dann nur, was du einträgst — leere Felder bleiben unverändert.
          </p>
        )}
      </div>

      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs font-medium uppercase tracking-wide text-muted">Schritte</span>
        {stepsHeaderExtra}
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
              {cols.length > 0 && (
                <div class="space-y-1.5">
                  {cols.map((_, ci) => cellFields(i, ci))}
                </div>
              )}
              <div class="flex flex-wrap items-center gap-3">
                <Segmented value={r.end}
                  options={[{ value: 'hold', label: 'Zeit' }, { value: 'sensor', label: 'Sensor' }]}
                  onChange={(v) => patchRow(i, { end: v })} />
                {r.end === 'hold' && (
                  <label class="flex items-center gap-1 text-xs text-muted">
                    Haltezeit
                    <input type="text" inputMode="decimal"
                      class={`${inp} w-20! text-right`}
                      value={r.hold}
                      onInput={(e) => patchRow(i, { hold: (e.target as HTMLInputElement).value })} />
                    <select class={`${inp} w-16!`} value={r.holdUnit} title="Einheit"
                      onChange={(e) => patchRow(i, { holdUnit: (e.target as HTMLSelectElement).value as HoldUnit })}>
                      <option value="min">min</option>
                      <option value="h">h</option>
                      <option value="d">d</option>
                    </select>
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
    </>
  );
}
