import { useState } from 'preact/hooks';
import { Link2 } from 'lucide-preact';
import type { CatalogIngredient } from '../../ingredientCatalog';
import type { Ingredient } from '../../recipes';
import { findIngredients, findLots, lotSummary, useCatalog } from '../../ingredientSource';
import { badge, inp } from '../../ui';

// Name field with catalog suggestions, the matching stock lots first. Picking a
// suggestion links the row to the catalog entry (ingredientId), a lot also to
// the lot (stockLotId); typing afterwards makes it free text again. Either way
// the concentration of the addition falls back to the new entry's.
export function IngredientPicker({ ingredient, onChange, only }: {
  ingredient: Ingredient;
  onChange: (p: Partial<Ingredient>) => void;
  only?: (c: CatalogIngredient) => boolean;
}) {
  const catalog = useCatalog();
  const [open, setOpen] = useState(false);
  const hits = catalog && open ? findIngredients(catalog.ingredients, ingredient.kind, ingredient.name, 8, only) : [];
  const lots = catalog && open ? findLots(catalog, ingredient.kind, ingredient.name, only) : [];
  const lot = ingredient.stockLotId ? catalog?.stock.find((l) => l.id === ingredient.stockLotId) : undefined;
  const pick = (p: Partial<Ingredient>) => { onChange({ strengthPct: undefined, ...p }); setOpen(false); };
  const item = 'block w-full px-3 py-1.5 text-left text-sm hover:bg-fg/10';

  return (
    <div class="relative min-w-0 flex-1 basis-40">
      <input class={`${inp} w-full ${ingredient.ingredientId ? 'pr-7' : ''}`} placeholder="Name"
        value={ingredient.name}
        onInput={(e) => {
          onChange({ name: e.currentTarget.value, ingredientId: undefined, stockLotId: undefined, strengthPct: undefined });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)} />
      {ingredient.ingredientId && (
        <Link2 size={14} class={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${lot ? 'text-accent' : 'text-muted'}`}
          aria-label={lot ? 'Mit Lagerposten verknüpft' : 'Mit Katalog verknüpft'} />
      )}
      {(lots.length > 0 || hits.length > 0) && (
        <ul class="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-card-border bg-surface shadow-elev-2">
          {/* mousedown fires before the input's blur closes the list */}
          {lots.map(({ lot: l, entry }) => (
            <li key={l.id}>
              <button type="button" class={item}
                onMouseDown={(e) => { e.preventDefault(); pick({ name: entry.name, ingredientId: entry.id, stockLotId: l.id }); }}>
                <span class={`${badge} mr-2 bg-fg/10 text-muted`}>Lager</span>
                {entry.name}
                <span class="ml-2 text-xs text-muted">{lotSummary(l, entry)}</span>
              </button>
            </li>
          ))}
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" class={item}
                onMouseDown={(e) => { e.preventDefault(); pick({ name: h.name, ingredientId: h.id, stockLotId: undefined }); }}>
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
