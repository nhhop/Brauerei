import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { inp } from '../../ui';

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

// Keeps the typed text locally so clearing the field doesn't snap back to 0;
// the parsed number is committed whenever the text is a valid number.
export function NumInput({ value, onChange, class: cls = 'w-24' }: {
  value: number; onChange: (n: number) => void; class?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { if (parseFloat(text) !== value) setText(String(value)); }, [value]);
  return (
    <input type="number" inputMode="decimal" class={`${inp} ${cls}`} value={text}
      onInput={(e) => {
        const t = e.currentTarget.value;
        setText(t);
        const n = parseFloat(t);
        if (!Number.isNaN(n)) onChange(n);
      }} />
  );
}

// Like NumInput, but an empty field means "not set".
export function OptNum({ value, onChange, placeholder, class: cls = 'w-24' }: {
  value: number | undefined; onChange: (n: number | undefined) => void; placeholder?: string; class?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    if ((text === '' ? undefined : parseFloat(text)) !== value) setText(value == null ? '' : String(value));
  }, [value]);
  return (
    <input type="number" inputMode="decimal" class={`${inp} ${cls}`} value={text} placeholder={placeholder}
      onInput={(e) => {
        const t = e.currentTarget.value;
        setText(t);
        const n = parseFloat(t);
        if (t.trim() === '') onChange(undefined);
        else if (!Number.isNaN(n)) onChange(n);
      }} />
  );
}
