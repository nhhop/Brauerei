import { useState } from 'preact/hooks';
import { Link2 } from 'lucide-preact';
import type { Ingredient } from '../../recipes';
import { findIngredients, useCatalog } from '../../ingredientSource';
import { inp } from '../../ui';

// Name field with catalog suggestions. Picking a suggestion links the row to the
// catalog entry (ingredientId); typing afterwards makes it free text again.
export function IngredientPicker({ ingredient, onChange }: {
  ingredient: Ingredient;
  onChange: (p: Partial<Ingredient>) => void;
}) {
  const catalog = useCatalog();
  const [open, setOpen] = useState(false);
  const hits = catalog && open ? findIngredients(catalog.ingredients, ingredient.kind, ingredient.name) : [];

  return (
    <div class="relative min-w-0 flex-1 basis-40">
      <input class={`${inp} w-full ${ingredient.ingredientId ? 'pr-7' : ''}`} placeholder="Name"
        value={ingredient.name}
        onInput={(e) => onChange({ name: e.currentTarget.value, ingredientId: undefined })}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)} />
      {ingredient.ingredientId && (
        <Link2 size={14} class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
          aria-label="Mit Katalog verknüpft" />
      )}
      {hits.length > 0 && (
        <ul class="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-card-border bg-surface shadow-elev-2">
          {hits.map((h) => (
            // mousedown fires before the input's blur closes the list
            <li key={h.id}>
              <button type="button" class="block w-full px-3 py-1.5 text-left text-sm hover:bg-fg/10"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange({ name: h.name, ingredientId: h.id });
                  setOpen(false);
                }}>
                {h.name}
                {h.manufacturer && <span class="ml-2 text-xs text-muted">{h.manufacturer}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
