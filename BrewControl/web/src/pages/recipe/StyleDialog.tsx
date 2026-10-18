import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import type { Recipe } from '../../recipes';
import type { RecipeStats } from '../../recipeStats';
import { rankStyles, type StyleRow } from '../../styleCompare';
import { findStyles, styleCode, type StyleGuideId, type StyleSource } from '../../styleSource';
import { badgeSuccess, btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../../ui';
import { Field } from './fields';
import { deltaText } from './StyleCard';

export type StylePatch = Pick<Recipe, 'style' | 'styleId' | 'styleGuide'>;

const MATCHING = 4;

// Picks the recipe's style from one source (BJCP 2021 when its data is there,
// otherwise the own styles), sorted by how well the recipe fits. Also sets a
// name without figures (free text) or no style at all.
export function StyleDialog({ recipe, sources, stats, onPick, onClose }: {
  recipe: Recipe; sources: StyleSource[]; stats: RecipeStats | null;
  onPick: (p: StylePatch) => void; onClose: () => void;
}) {
  const linked = recipe.styleId ? (recipe.styleGuide ?? 'bjcp-2021') : undefined;
  const [guide, setGuide] = useState<StyleGuideId>(
    sources.find((s) => s.guide === linked)?.guide ?? sources[0].guide);
  const [family, setFamily] = useState('');
  const [query, setQuery] = useState('');
  const [onlyMatching, setOnlyMatching] = useState(false);
  const [selected, setSelected] = useState(guide === linked ? recipe.styleId : undefined);
  const [freeText, setFreeText] = useState(recipe.styleId ? '' : recipe.style);

  const source = sources.find((s) => s.guide === guide)!;
  const families = [...new Set(source.styles.map((s) => s.category).filter(Boolean))];
  const hits = findStyles(source.styles, query, Infinity).filter((s) => !family || s.category === family);
  const rows = rankStyles(stats ?? { notes: [] }, hits)
    .filter((r) => !onlyMatching || r.cmp.inCount >= MATCHING);
  const pick = source.styles.find((s) => s.id === selected);

  function changeGuide(g: StyleGuideId) {
    setGuide(g);
    setFamily('');
    setSelected(g === linked ? recipe.styleId : undefined);
  }

  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-2xl ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <div class="sticky top-0 z-10 space-y-3 border-b border-border bg-surface pb-3 pt-5">
            <h2 class="text-base font-medium text-fg">Stil wählen</h2>
            <div class="grid gap-3 sm:grid-cols-3">
              <Field label="Stilquelle">
                <select class={`${inp} w-full`} value={guide} onChange={(e) => changeGuide(e.currentTarget.value as StyleGuideId)}>
                  {sources.map((s) => <option key={s.guide} value={s.guide}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Familie">
                <select class={`${inp} w-full`} value={family} onChange={(e) => setFamily(e.currentTarget.value)}>
                  <option value="">Alle</option>
                  {families.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Suche">
                <input type="search" class={`${inp} w-full`} value={query} placeholder="Name oder Nummer"
                  onInput={(e) => setQuery(e.currentTarget.value)} />
              </Field>
            </div>
            <label class="flex items-center gap-2 text-sm">
              <ToggleSwitch checked={onlyMatching} onChange={setOnlyMatching} disabled={!stats} />
              <span>Nur passende (≥ {MATCHING} von 5)</span>
            </label>
          </div>

          {rows.length === 0 && (
            <p class="mt-4 text-sm text-muted">
              {source.failed ? 'Die eigenen Stile konnten nicht geladen werden.'
                : source.styles.length === 0 ? <>Noch keine eigenen Stile. Anlegen unter{' '}
                  <a href="/profile/stile" class="underline">Profile › Bierstile</a>.</>
                : 'Kein Stil passt zu Suche und Filtern.'}
            </p>
          )}
          <ul class="mt-2 divide-y divide-border">
            {rows.map(({ style: s, cmp }) => (
              <li key={s.id}>
                <button type="button" aria-pressed={s.id === selected} onClick={() => setSelected(s.id)}
                  class={`flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-fg/5 ${s.id === selected ? 'bg-accent/10' : ''}`}>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm">
                      {styleCode(s) && <span class="mr-2 text-xs text-muted">{styleCode(s)}</span>}
                      {s.name || 'Ohne Namen'}
                    </span>
                    <span class="block truncate text-xs text-muted">{s.category}</span>
                  </span>
                  {stats && (
                    <span class={cmp.inCount >= MATCHING ? badgeSuccess : 'whitespace-nowrap px-1.5 text-xs text-muted'}>
                      {cmp.inCount} von 5
                    </span>
                  )}
                </button>
                {s.id === selected && <Detail rows={cmp.rows} description={s.description} />}
              </li>
            ))}
          </ul>

          <div class="mt-5 border-t border-border pt-4">
            <Field label="Nur ein Name, ohne Kennwerte">
              <div class="flex gap-2">
                <input class={`${inp} min-w-0 flex-1`} value={freeText} placeholder="z.B. Hausbier"
                  onInput={(e) => setFreeText(e.currentTarget.value)} />
                <button type="button" class={btnSecondary} disabled={!freeText.trim()}
                  onClick={() => onPick({ style: freeText.trim(), styleId: undefined, styleGuide: undefined })}>
                  Übernehmen
                </button>
              </div>
            </Field>
          </div>
        </div>
        <div class={`${dialogFooter} justify-between`}>
          <button type="button" class={btnSecondary}
            onClick={() => onPick({ style: '', styleId: undefined, styleGuide: undefined })}>
            Kein Stil
          </button>
          <div class="flex gap-2">
            <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
            <button type="button" class={btnPrimary} disabled={!pick}
              onClick={() => pick && onPick({ style: pick.name, styleId: pick.id, styleGuide: pick.guide === 'own' ? 'own' : undefined })}>
              Übernehmen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const STATUS_TEXT: Record<StyleRow['status'], string> = {
  in: 'text-success', below: 'text-caution', above: 'text-caution', unknown: 'text-muted',
};

// Each figure of the selected style: its range, the recipe's value and whether it fits.
function Detail({ rows, description }: { rows: StyleRow[]; description?: string }) {
  const range = (r: StyleRow) =>
    (r.min === undefined || r.max === undefined ? '–' : `${r.min.toFixed(r.digits)}–${r.max.toFixed(r.digits)} ${r.unit}`);
  const status = (r: StyleRow) =>
    (r.status === 'in' ? 'im Stil'
      : r.status === 'unknown' ? 'unbekannt'
      : `${r.status === 'above' ? '+' : '−'}${deltaText(r)} ${r.status === 'above' ? 'über' : 'unter'}`);
  return (
    <div class="mb-2 rounded bg-fg/5 px-3 py-2 text-xs">
      {description && <p class="mb-2 text-muted">{description}</p>}
      <dl class="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-1 tabular-nums">
        {rows.map((r) => (
          <Fragment key={r.key}>
            <dt class="text-muted">{r.label}</dt>
            <dd>{range(r)}</dd>
            <dd class="text-right">{r.value === undefined ? '–' : r.value.toFixed(r.digits)}</dd>
            <dd class={`text-right ${STATUS_TEXT[r.status]}`}>{status(r)}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
