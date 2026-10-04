import { useState } from 'preact/hooks';
import { Link2 } from 'lucide-preact';
import type { Recipe } from '../../recipes';
import { findStyles, useStyles } from '../../styleSource';
import { inp } from '../../ui';

// Style field with BJCP suggestions. Picking one links the recipe to the style
// (styleId) and fills the text with its name; typing afterwards makes it free text.
export function StylePicker({ recipe, onChange }: {
  recipe: Recipe;
  onChange: (p: Partial<Recipe>) => void;
}) {
  const guide = useStyles();
  const [open, setOpen] = useState(false);
  const hits = guide && open ? findStyles(guide.styles, recipe.style) : [];

  return (
    <div class="relative">
      <input class={`${inp} w-full ${recipe.styleId ? 'pr-7' : ''}`} placeholder="z.B. Altbier"
        value={recipe.style}
        onInput={(e) => { onChange({ style: e.currentTarget.value, styleId: undefined }); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)} />
      {recipe.styleId && (
        <Link2 size={14} class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
          aria-label="Mit BJCP-Stil verknüpft" />
      )}
      {hits.length > 0 && (
        <ul class="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-card-border bg-surface shadow-elev-2">
          {hits.map((h) => (
            // mousedown fires before the input's blur closes the list
            <li key={h.id}>
              <button type="button" class="block w-full px-3 py-1.5 text-left text-sm hover:bg-fg/10"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange({ style: h.name, styleId: h.id });
                  setOpen(false);
                }}>
                <span class="mr-2 text-xs text-muted">{h.id}</span>
                {h.name}
                <span class="ml-2 text-xs text-muted">{h.category}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
