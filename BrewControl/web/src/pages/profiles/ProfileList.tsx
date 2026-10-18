import { Fragment, type ComponentChildren } from 'preact';
import { Copy, Pencil, Trash2 } from 'lucide-preact';

// The tables of a profile tab, "Eigene" and "Mitgeliefert", in the style of the
// recipe list: own profiles can be edited and deleted, shipped ones only
// duplicated (the copy is an own profile); with `onView` a click on a shipped
// row shows it read-only. The section titles stand above the
// tables, `action` (the "new" button) beside "Eigene". Below lg each row shows
// the name and `mobile` instead of the columns. `builtinGroup` puts a heading
// over each run of shipped rows (the list must already be in group order).
export interface ProfileColumn<T> { label: string; cell: (r: T) => ComponentChildren; align?: 'right' | 'center' }

const iconBtn = 'rounded-md p-1.5 text-muted hover:bg-fg/10';
const frame = 'overflow-hidden rounded-md border border-card-border bg-card shadow-elev-2';
const title = 'text-sm font-semibold text-muted';
const alignCls = (a?: 'right' | 'center') => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : '');

export function ProfileList<T extends { id: string; name: string }>({
  own, builtin, builtinGroup, cols, columns, sub, mobile, ownEmpty, action, onEdit, onView, onDuplicate, onDelete, footnote,
}: {
  own: T[]; builtin: T[];
  builtinGroup?: (r: T) => string;
  cols: string;                          // lg:grid-cols-[…]: name, the columns, actions
  columns: ProfileColumn<T>[];
  sub?: (r: T) => string | undefined;    // second line under the name
  mobile: (r: T) => string;
  ownEmpty: string;
  action?: ComponentChildren;
  onEdit: (r: T) => void; onView?: (r: T) => void; onDuplicate: (r: T) => void; onDelete: (r: T) => void;
  footnote?: ComponentChildren;
}) {
  const table = (list: T[], isBuiltin: boolean) => (
    <div class={frame}>
      <div class={`hidden items-center gap-3 border-b border-card-border px-4 py-2 text-xs font-semibold text-muted lg:grid ${cols}`}>
        <span>Name</span>
        {columns.map((c) => <span key={c.label} class={alignCls(c.align)}>{c.label}</span>)}
        <span class="text-right">Aktionen</span>
      </div>
      {list.map((r, i) => (
        <Fragment key={r.id}>
          {isBuiltin && builtinGroup && (i === 0 || builtinGroup(list[i - 1]) !== builtinGroup(r)) && (
            <div class="border-b border-card-border bg-fg/5 px-4 py-1.5 text-xs font-semibold text-muted">{builtinGroup(r)}</div>
          )}
          <div onClick={isBuiltin ? onView && (() => onView(r)) : () => onEdit(r)}
            class={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-card-border px-4 py-2 last:border-b-0 ${isBuiltin && !onView ? '' : 'cursor-pointer hover:bg-fg/5'} ${cols}`}>
            <span class="flex min-w-0 flex-col">
              <span class="truncate font-semibold text-fg">{r.name || 'Ohne Namen'}</span>
              {sub?.(r) && <span class="truncate text-xs text-muted" title={sub(r)}>{sub(r)}</span>}
              <span class="text-xs tabular-nums text-muted lg:hidden">{mobile(r)}</span>
            </span>
            {columns.map((c) => (
              <span key={c.label} class={`hidden text-sm tabular-nums lg:block ${alignCls(c.align)}`}>{c.cell(r)}</span>
            ))}
            <span class="flex justify-end gap-0.5">
              {!isBuiltin && (
                <button type="button" title="Bearbeiten" aria-label={`${r.name || 'Profil'} bearbeiten`} class={iconBtn}
                  onClick={(e) => { e.stopPropagation(); onEdit(r); }}><Pencil size={16} /></button>
              )}
              <button type="button" title="Duplizieren" aria-label={`${r.name || 'Profil'} duplizieren`} class={iconBtn}
                onClick={(e) => { e.stopPropagation(); onDuplicate(r); }}><Copy size={16} /></button>
              {!isBuiltin && (
                <button type="button" title="Löschen" aria-label={`${r.name || 'Profil'} löschen`} class={`${iconBtn} text-critical`}
                  onClick={(e) => { e.stopPropagation(); onDelete(r); }}><Trash2 size={16} /></button>
              )}
            </span>
          </div>
        </Fragment>
      ))}
      {list.length === 0 && <p class="px-4 py-3 text-sm text-muted">{ownEmpty}</p>}
    </div>
  );

  return (
    <>
      <div class="mb-2 mt-6 flex min-h-9 items-center justify-between gap-3">
        <h2 class={title}>Eigene</h2>
        {action}
      </div>
      {table(own, false)}
      {builtin.length > 0 && (
        <>
          <h2 class={`mb-2 mt-6 ${title}`}>Mitgeliefert</h2>
          {table(builtin, true)}
        </>
      )}
      {footnote && <p class="mt-2 text-xs text-muted">{footnote}</p>}
    </>
  );
}
