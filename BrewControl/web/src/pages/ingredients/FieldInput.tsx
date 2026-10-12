import type { Range } from '../../ingredientCatalog';
import type { FieldDef } from '../../ingredientFields';
import { inp } from '../../ui';
import { Field, OptNum } from '../recipe/fields';

// "von–bis" of a range. Only "von" is one value ([x, x]); only "bis" is an
// upper limit ([null, x]), as data sheets write "max. 5".
function RangeInput({ value, onChange, placeholder }: {
  value: Range | undefined; onChange: (r: Range | undefined) => void; placeholder?: Range;
}) {
  const lo = value?.[0] ?? undefined;
  const hi = value && value[1] !== value[0] ? value[1] ?? undefined : undefined;
  const set = (a: number | undefined, b: number | undefined) =>
    onChange(a === undefined && b === undefined ? undefined : [a ?? null, b ?? a ?? null]);
  // The value underneath only shows while this one is empty, else "bis" would
  // look like it kept the ingredient's upper end.
  const under = value ? undefined : placeholder;
  const ph = (n: number | null | undefined) => (n == null ? undefined : String(n));
  return (
    <div class="flex items-center gap-1">
      <OptNum value={lo} onChange={(a) => set(a, hi)} placeholder={ph(under?.[0]) ?? 'von'} class="w-20" />
      <span class="text-muted">–</span>
      <OptNum value={hi} onChange={(b) => set(lo, b)}
        placeholder={(under && under[1] !== under[0] ? ph(under[1]) : undefined) ?? 'bis'} class="w-20" />
    </div>
  );
}

// One value of the field table. `placeholder` shows the value underneath (the
// ingredient's, when a stock lot overrides it).
export function FieldInput({ def, value, onChange, placeholder }: {
  def: FieldDef; value: unknown; onChange: (v: unknown) => void; placeholder?: unknown;
}) {
  const label = `${def.label}${def.unit ? ` (${def.unit})` : ''}${def.required ? ' *' : ''}`;
  return (
    <Field label={label}>
      {def.type === 'enum' ? (
        <select class={`${inp} w-full`} value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.currentTarget.value || undefined)}>
          <option value="">–</option>
          {def.options!.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      ) : def.type === 'range' ? (
        <RangeInput value={value as Range | undefined} onChange={onChange}
          placeholder={Array.isArray(placeholder) ? (placeholder as Range) : undefined} />
      ) : (
        <OptNum value={value as number | undefined} onChange={onChange} class="w-24"
          placeholder={typeof placeholder === 'number' ? String(placeholder) : undefined} />
      )}
    </Field>
  );
}
