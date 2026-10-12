import { Fragment } from 'preact';
import type { CatalogIngredient } from '../../ingredientCatalog';
import { fieldsOf, formatField, getField } from '../../ingredientFields';
import { btnSecondary } from '../../ui';
import { Dialog } from './Dialog';

// Read-only view of an ingredient's values.
export function IngredientDetail({ entry, onClose }: { entry: CatalogIngredient; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Hersteller', entry.manufacturer ?? ''],
    ['Produktcode', entry.productCode ?? ''],
    ['Herkunft', entry.origin ?? ''],
    ...fieldsOf(entry).map((f): [string, string] => [f.label, formatField(f, getField(entry, f.key))]),
  ];
  return (
    <Dialog title={entry.name} onClose={onClose}
      footer={<button type="button" class={btnSecondary} onClick={onClose}>Schließen</button>}>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <Fragment key={k}>
            <dt class="text-muted">{k}</dt>
            <dd>{v}</dd>
          </Fragment>
        ))}
      </dl>
      {entry.notes && <p class="mt-3 text-sm text-muted">{entry.notes}</p>}
      {entry.source && (
        <p class="mt-3 text-xs text-muted">
          Quelle: {entry.source.url
            ? <a class="underline" href={entry.source.url} target="_blank" rel="noopener noreferrer">{entry.source.name}</a>
            : entry.source.name}
        </p>
      )}
    </Dialog>
  );
}
