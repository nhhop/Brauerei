import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { UnitBox } from '../../components/UnitBox';
import { stepValue } from '../../numStep';
import { btnSecondary, inp, unitInput, unitInputMuted } from '../../ui';

export function Card({ title, action, children }: {
  title: string; action?: ComponentChildren; children: ComponentChildren;
}) {
  return (
    <section class="mb-4 rounded-md border border-card-border bg-card p-4 shadow-elev-2">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <label class="block text-xs text-muted">
      <span class="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

// A number <input>; with `unit` the unit sits inside the frame (see `unitBox`)
// with arrows at the left, and `cls` sizes the frame. The arrows step by `step`
// (default: 1 from 10 up, else 0.1; see numStep.ts), never below 0 unless the
// unit is °C or `min` says so. An empty field steps from its placeholder.
function NumBox({ unit, cls, text, placeholder, step, min, muted, onText }: {
  unit?: string; cls?: string; text: string; placeholder?: string; step?: number; min?: number; muted?: boolean;
  onText: (t: string) => void;
}) {
  const bump = (dir: 1 | -1) => {
    const n = parseFloat(text.trim() === '' ? placeholder ?? '' : text);
    onText(String(stepValue(n, dir, step, min ?? (unit === '°C' ? -Infinity : 0))));
  };
  const input = (c: string) => (
    <input type="number" step="any" inputMode="decimal" class={c} value={text} placeholder={placeholder}
      onInput={(e) => onText(e.currentTarget.value)}
      onKeyDown={unit ? (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        bump(e.key === 'ArrowUp' ? 1 : -1);
      } : undefined} />
  );
  if (!unit) return input(`${inp} ${cls ?? 'w-24'}`);
  return <UnitBox unit={unit} class={cls ?? 'w-28'} onStep={bump}>{input(muted ? unitInputMuted : unitInput)}</UnitBox>;
}

// Keeps the typed text locally so clearing the field doesn't snap back to 0;
// the parsed number is committed whenever the text is a valid number.
export function NumInput({ value, onChange, unit, step, min, muted, class: cls }: {
  value: number; onChange: (n: number) => void; unit?: string; step?: number; min?: number; muted?: boolean; class?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { if (parseFloat(text) !== value) setText(String(value)); }, [value]);
  return (
    <NumBox unit={unit} cls={cls} step={step} min={min} muted={muted} text={text}
      onText={(t) => {
        setText(t);
        const n = parseFloat(t);
        if (!Number.isNaN(n)) onChange(n);
      }} />
  );
}

// Like NumInput, but an empty field means "not set".
export function OptNum({ value, onChange, placeholder, unit, step, min, muted, class: cls }: {
  value: number | undefined; onChange: (n: number | undefined) => void; placeholder?: string; unit?: string;
  step?: number; min?: number; muted?: boolean; class?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    if ((text === '' ? undefined : parseFloat(text)) !== value) setText(value == null ? '' : String(value));
  }, [value]);
  return (
    <NumBox unit={unit} cls={cls} step={step} min={min} muted={muted} text={text} placeholder={placeholder}
      onText={(t) => {
        setText(t);
        const n = parseFloat(t);
        if (t.trim() === '') onChange(undefined);
        else if (!Number.isNaN(n)) onChange(n);
      }} />
  );
}

// A recipe value over the brewhouse's: the placeholder shows the brewhouse
// value, the button drops the override.
export function Override({ label, unit, value, brewhouse, onChange }: {
  label: string; unit?: string; value: number | undefined; brewhouse: number; onChange: (n: number | undefined) => void;
}) {
  return (
    <div class="flex items-end gap-1">
      <Field label={label}>
        <OptNum unit={unit} value={value} placeholder={String(brewhouse)} onChange={onChange} />
      </Field>
      {value !== undefined && (
        <button type="button" class={btnSecondary} title={`Sudhaus-Wert ${String(brewhouse).replace('.', ',')}`}
          onClick={() => onChange(undefined)}>
          Sudhaus-Wert
        </button>
      )}
    </div>
  );
}

// One entry of a drop-down menu (role="menu").
export function MenuItem({ label, sub, disabled, onClick }: {
  label: string; sub?: string; disabled?: boolean; onClick?: () => void;
}) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}
      class="flex w-full items-baseline justify-between gap-3 rounded px-2.5 py-2 text-left text-sm hover:bg-fg/5 disabled:text-faint disabled:hover:bg-transparent">
      <span>{label}</span>
      {sub && <span class="text-xs text-muted">{sub}</span>}
    </button>
  );
}

export function TextInput({ value, onChange, placeholder, list, class: cls = 'w-full' }: {
  value: string; onChange: (s: string) => void; placeholder?: string; list?: string; class?: string;
}) {
  return (
    <input class={`${inp} ${cls}`} value={value} placeholder={placeholder} list={list}
      onInput={(e) => onChange(e.currentTarget.value)} />
  );
}

export type Opt = { value: string; text: string };

// A <select> over `groups`; a value that is not among them stays selectable as
// "<value> (fehlt)", like the program editor's columns.
export function Select({ value, groups, onChange, empty = '— keins —', missing, class: cls = 'w-full' }: {
  value: string; groups: { label?: string; opts: Opt[] }[]; onChange: (v: string) => void;
  empty?: string | null; missing?: string; class?: string;
}) {
  const listed = groups.some((g) => g.opts.some((o) => o.value === value));
  return (
    <select class={`${inp} ${cls}`} value={value} onChange={(e) => onChange(e.currentTarget.value)}>
      {empty !== null && <option value="">{empty}</option>}
      {value !== '' && !listed && <option value={value}>{missing ?? `${value} (fehlt)`}</option>}
      {groups.map((g, i) => g.opts.length === 0 ? null : g.label
        ? <optgroup key={i} label={g.label}>{g.opts.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}</optgroup>
        : g.opts.map((o) => <option key={o.value} value={o.value}>{o.text}</option>))}
    </select>
  );
}

export const itemText = (item: { id: string; label?: string }) => (item.label ? `${item.label} (${item.id})` : item.id);
