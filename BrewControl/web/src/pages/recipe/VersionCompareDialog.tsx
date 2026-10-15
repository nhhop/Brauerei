import { useEffect, useState } from 'preact/hooks';
import type { Brewery, Brewhouse } from '../../brewhouse';
import { listContainers, type Container } from '../../cellar';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { useCatalog } from '../../ingredientSource';
import { deriveRecipe, diffRecipes, type DiffLine, type DiffRow, type DiffState } from '../../recipeDiff';
import { getRecipe, versionOf, type Recipe, type RecipeSummary } from '../../recipes';
import type { TimeSettings } from '../../types';
import { badgeAccent, badgeCritical, badgeSuccess, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../../ui';
import { dateOf, statusText, useTimeSettings } from './Versions';

const STATE_BADGE: Record<Exclude<DiffState, 'same'>, [string, string]> = {
  added: [badgeSuccess, 'neu'], changed: [badgeAccent, 'geändert'], removed: [badgeCritical, 'entfernt'],
};

// Label | left | right from md up; below, the label gets a line of its own.
const GRID = 'grid grid-cols-2 gap-x-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]';
const LABEL = 'col-span-2 md:col-span-1';

// Compares two versions of a recipe. The open one (`recipe`) comes with its
// editor state, unsaved edits included; the others are loaded as saved.
// `versions` is ordered oldest first and has at least two entries.
export function VersionCompareDialog({ versions, recipe, dirty, brewhouses, brewery, onClose }: {
  versions: RecipeSummary[]; recipe: Recipe; dirty: boolean;
  brewhouses: Brewhouse[] | null; brewery: Brewery | null; onClose: () => void;
}) {
  const time = useTimeSettings();
  const catalog = useCatalog();
  // The predecessor against the open version; version 1 against version 2.
  const at = versions.findIndex((v) => v.id === recipe.id);
  const [left, setLeft] = useState(versions[Math.max(at - 1, 0)].id);
  const [right, setRight] = useState(versions[Math.max(at, 1)].id);
  const [diffOnly, setDiffOnly] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, Recipe | 'error'>>({});
  const [containers, setContainers] = useState<Container[] | null>(null);

  useEffect(() => {
    let alive = true;
    listContainers().then((l) => alive && setContainers(l)).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    for (const id of [left, right]) {
      if (id === recipe.id || loaded[id]) continue;
      getRecipe(id)
        .then((r) => alive && setLoaded((l) => ({ ...l, [id]: r ?? 'error' })))
        .catch(() => alive && setLoaded((l) => ({ ...l, [id]: 'error' })));
    }
    return () => { alive = false; };
  }, [left, right]);

  const sideOf = (id: string) => (id === recipe.id ? recipe : loaded[id]);
  const a = sideOf(left), b = sideOf(right);
  const ready = !!a && !!b && a !== 'error' && b !== 'error';
  const sections = ready
    ? diffRecipes(a, b, deriveRecipe(a, catalog?.entries ?? null, brewhouses, brewery),
      deriveRecipe(b, catalog?.entries ?? null, brewhouses, brewery), { brewhouses, brewery, containers })
    : [];
  const count = sections.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.rows.filter((r) => r.state !== 'same').length, 0), 0);

  const select = (value: string, other: string, set: (id: string) => void, label: string) => (
    <select class={`${inp} w-full min-w-0 py-1`} value={value} aria-label={label} onChange={(e) => set(e.currentTarget.value)}>
      {versions.map((v) => (
        <option key={v.id} value={v.id} disabled={v.id === other}>
          {versionLabel(v, time)}{v.id === recipe.id && dirty ? ' · ungespeichert' : ''}
        </option>
      ))}
    </select>
  );

  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-3xl ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-2 pt-5">
            <h2 class="text-base font-medium text-fg">Versionen vergleichen</h2>
            <div class="flex items-center gap-2 text-sm">
              {ready && <span class="mr-2 text-xs text-muted">{count === 1 ? '1 Unterschied' : `${count} Unterschiede`}</span>}
              <ToggleSwitch checked={diffOnly} onChange={setDiffOnly} />
              <span>Nur Unterschiede</span>
            </div>
          </div>
          <div class={`${GRID} sticky top-0 z-10 items-center border-b border-border bg-surface py-2`}>
            <span class="hidden md:block" />
            {select(left, right, setLeft, 'Linke Version')}
            {select(right, left, setRight, 'Rechte Version')}
          </div>
          {!ready ? (
            <p class="mt-4 text-sm text-muted">
              {a === 'error' || b === 'error' ? 'Version konnte nicht geladen werden.' : 'Lädt …'}
            </p>
          ) : (
            <>
              {!catalog && <p class="mt-3 text-xs text-muted">Katalog nicht geladen, Kennwerte nicht verfügbar.</p>}
              {sections.map((s) => {
                const groups = s.groups
                  .map((g) => ({ ...g, rows: diffOnly ? g.rows.filter((r) => r.state !== 'same').map(changedLines) : g.rows }))
                  .filter((g) => g.rows.length > 0);
                return (
                  <section key={s.id} class="mt-5">
                    <h3 class="mb-1 text-sm font-semibold">{s.title}</h3>
                    {groups.length === 0 && <p class="text-xs text-muted">Keine Unterschiede</p>}
                    {groups.map((g) => (
                      <div key={g.title ?? ''}>
                        {g.title && <h4 class="mt-3 text-xs font-medium uppercase tracking-wide text-muted">{g.title}</h4>}
                        <div class="divide-y divide-border">
                          {g.rows.map((r, i) => <Row key={i} row={r} />)}
                        </div>
                      </div>
                    ))}
                  </section>
                );
              })}
            </>
          )}
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

// A changed entry reduced to the lines that differ.
const changedLines = (r: DiffRow): DiffRow =>
  (r.state === 'changed' ? { ...r, lines: r.lines.filter((l) => l.changed) } : r);

const versionLabel = (v: RecipeSummary, time?: TimeSettings) => `v${versionOf(v)} · ${dateOf(v, time)} · ${statusText(v)}`;

function Row({ row }: { row: DiffRow }) {
  const head = (
    <span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span class={row.lines[0]?.label === undefined ? 'text-muted' : 'font-medium'}>{row.title}</span>
      {row.computed && <span class="text-xs text-faint">berechnet</span>}
      {row.state !== 'same' && <span class={STATE_BADGE[row.state][0]}>{STATE_BADGE[row.state][1]}</span>}
    </span>
  );
  // A field: one line next to its title.
  if (row.lines.length === 1 && row.lines[0].label === undefined) {
    return (
      <div class={`${GRID} gap-y-0.5 py-1.5 text-sm`}>
        <div class={LABEL}>{head}</div>
        <Values line={row.lines[0]} state={row.state} />
      </div>
    );
  }
  return (
    <div class="py-1.5 text-sm">
      {head}
      {row.lines.map((l, i) => (
        <div key={i} class={`${GRID} mt-0.5`}>
          <div class={`${LABEL} text-xs text-muted md:pl-3 md:text-sm`}>{l.label}</div>
          <Values line={l} state={row.state} />
        </div>
      ))}
    </div>
  );
}

function Values({ line, state }: { line: DiffLine; state: DiffState }) {
  const cls = (side: 'a' | 'b') => {
    if (state === 'removed') return side === 'a' ? 'text-critical' : 'text-faint';
    if (state === 'added') return side === 'b' ? 'text-success' : 'text-faint';
    return line.changed ? 'font-medium' : 'text-muted';
  };
  return (
    <>
      <div class={`min-w-0 break-words ${cls('a')}`}>{line.a ?? '—'}</div>
      <div class={`min-w-0 break-words ${cls('b')}`}>
        {line.b ?? '—'}
        {line.delta && <span class="ml-1.5 whitespace-nowrap text-xs font-normal text-muted">{line.delta}</span>}
      </div>
    </>
  );
}
