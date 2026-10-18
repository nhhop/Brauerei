import { useState } from 'preact/hooks';
import { ConfirmModal } from '../../components/ConfirmModal';
import { uid } from '../../recipes';
import { STYLE_FIGURES } from '../../styleCompare';
import { deleteStyle, saveStyle, styleCode, useStyleSources, type BeerStyle, type Span } from '../../styleSource';
import { btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../../ui';
import { Field, OptNum } from '../recipe/fields';
import { fmtNum } from '../WaterProfiles';
import { ProfileList, type ProfileColumn } from './ProfileList';

type Key = (typeof STYLE_FIGURES)[number]['key'];

const span = (s: BeerStyle, key: Key, digits: number) => {
  const r = s[key];
  return r ? `${fmtNum(r[0], digits)}–${fmtNum(r[1], digits)}` : '–';
};
const COLUMNS: ProfileColumn<BeerStyle>[] = STYLE_FIGURES.map(({ key, label, digits }) =>
  ({ label: key === 'ibu' ? 'IBU' : key === 'ebc' ? 'EBC' : label, align: 'right', cell: (s) => span(s, key, digits) }));
const COLS = 'lg:grid-cols-[minmax(10rem,2fr)_repeat(5,96px)_92px]';

const summary = (s: BeerStyle) =>
  STYLE_FIGURES.filter(({ key }) => s[key]).map(({ key, unit, digits }) => `${span(s, key, digits)} ${unit}`).join(' · ')
  || 'ohne Kennwerte';

// The BJCP family with its number ("7 Amber Bitter European Beer"), the number
// from the style's ("7B"); the file lists the styles in this order.
const family = (s: BeerStyle) => `${/^\d+/.exec(s.id)?.[0] ?? ''} ${s.category}`.trim();

// A BJCP range converted to °P or EBC has more digits than anyone types.
const round = (r: Span | undefined, digits: number): Span | undefined => {
  const f = 10 ** digits;
  return r && [Math.round(r[0] * f) / f, Math.round(r[1] * f) / f];
};

// Tab "Bierstile" of the profile page: own styles, and the BJCP 2021 styles as
// shipped ones when their data is there (styleSource.ts); duplicating one takes
// it over as an own style.
export function BeerStylesTab() {
  const { sources, reload } = useStyleSources();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BeerStyle | null>(null);
  const [deleting, setDeleting] = useState<BeerStyle | null>(null);
  const [busy, setBusy] = useState(false);

  if (!sources) return <p class="text-sm text-muted">Lädt …</p>;
  const own = sources.find((s) => s.guide === 'own')!;
  const bjcp = sources.find((s) => s.guide === 'bjcp-2021');
  if (own.failed) return <p class="text-sm text-muted">Die eigenen Bierstile konnten nicht geladen werden.</p>;

  async function save(s: BeerStyle) {
    await saveStyle(s);
    reload();
    setEditing(null);
  }

  function duplicate(s: BeerStyle) {
    const copy: BeerStyle = {
      ...s, id: uid(), guide: 'own',
      ...(s.guide === 'own'
        ? { name: `${s.name} (Kopie)` }
        : { description: `Übernommen aus ${bjcp?.label} (${s.id}).` }),
    };
    for (const { key, digits } of STYLE_FIGURES) copy[key] = round(s[key], digits);
    delete copy.updatedAt;
    setEditing(copy);
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteStyle(deleting!.id);
      reload();
    } catch {
      setError('Löschen fehlgeschlagen.');
    }
    setBusy(false);
    setDeleting(null);
  }

  const families = [...new Set(own.styles.map((s) => s.category).filter(Boolean))].sort();
  return (
    <>
      <p class="text-sm text-muted">Stile mit ihren Kennwertbereichen für den Stilvergleich im Rezept.</p>
      {error && <p class="mt-3 text-sm text-critical">{error}</p>}
      <ProfileList own={own.styles} builtin={bjcp?.styles ?? []} builtinGroup={family} cols={COLS} columns={COLUMNS}
        sub={(s) => styleCode(s) || s.category} mobile={summary}
        action={<button type="button" class={btnPrimary} onClick={() => setEditing({ id: uid(), guide: 'own', name: '', category: '' })}>+ Neuer Stil</button>}
        ownEmpty={bjcp
          ? 'Noch kein eigener Stil. Ein BJCP-Stil lässt sich als Vorlage duplizieren.'
          : 'Noch kein eigener Stil angelegt.'}
        onEdit={setEditing} onDuplicate={duplicate} onDelete={setDeleting}
        footnote={<>
          Stammwürze und Restextrakt in °P, Alkohol in % vol, Farbe in EBC.
          {bjcp && <> BJCP-Stilwerte: {bjcp.label} Style Guidelines, {bjcp.copyright} Die aktuelle Fassung gibt es auf{' '}
            <a href="https://www.bjcp.org" target="_blank" rel="noopener noreferrer" class="underline">www.bjcp.org</a>.</>}
        </>} />
      {editing && <StyleEditor style={editing} families={families} onSave={save} onClose={() => setEditing(null)} />}
      <ConfirmModal open={deleting !== null} title="Bierstil löschen?"
        confirmLabel="Löschen" destructive pending={busy} onConfirm={confirmDelete} onCancel={() => setDeleting(null)}>
        „{deleting?.name || 'Ohne Namen'}“ wird dauerhaft entfernt. Rezepte mit diesem Stil behalten den Namen, aber
        nicht mehr den Vergleich.
      </ConfirmModal>
    </>
  );
}

// A range is either both limits or none; one limit alone or min above max cannot be saved.
function rangeError(r: [number | undefined, number | undefined]): string | undefined {
  if (r[0] === undefined && r[1] === undefined) return undefined;
  if (r[0] === undefined || r[1] === undefined) return 'Min und Max angeben';
  return r[0] > r[1] ? 'Min größer als Max' : undefined;
}

function StyleEditor({ style, families, onSave, onClose }: {
  style: BeerStyle; families: string[]; onSave: (s: BeerStyle) => Promise<void>; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [s, setS] = useState(style);
  // The limits as typed, so one of them can stay empty while editing.
  const [ranges, setRanges] = useState(() =>
    Object.fromEntries(STYLE_FIGURES.map(({ key }) => [key, [style[key]?.[0], style[key]?.[1]]])) as
      Record<Key, [number | undefined, number | undefined]>);
  const errors = STYLE_FIGURES.map(({ key }) => rangeError(ranges[key]));
  const setLimit = (key: Key, i: 0 | 1, n: number | undefined) => {
    const r: [number | undefined, number | undefined] = [...ranges[key]];
    r[i] = n;
    setRanges({ ...ranges, [key]: r });
  };

  function submit() {
    const out: BeerStyle = { ...s, name: s.name.trim(), category: s.category.trim(), description: s.description?.trim() || undefined };
    for (const { key } of STYLE_FIGURES) {
      const [lo, hi] = ranges[key];
      out[key] = lo === undefined || hi === undefined ? undefined : [lo, hi];
    }
    setBusy(true);
    setFailed(false);
    onSave(out).catch(() => { setFailed(true); setBusy(false); });
  }

  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-lg ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="mb-4 text-base font-medium text-fg">Bierstil</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input class={`${inp} w-full`} value={s.name} placeholder="z.B. Hausbier"
                onInput={(e) => setS({ ...s, name: e.currentTarget.value })} />
            </Field>
            <Field label="Familie">
              <input class={`${inp} w-full`} value={s.category} placeholder="z.B. Untergärig hell" list="style-families"
                onInput={(e) => setS({ ...s, category: e.currentTarget.value })} />
              <datalist id="style-families">{families.map((f) => <option key={f} value={f} />)}</datalist>
            </Field>
          </div>
          <div class="mt-3">
            <Field label="Beschreibung">
              <textarea class={`${inp} w-full`} rows={3} value={s.description ?? ''}
                onInput={(e) => setS({ ...s, description: e.currentTarget.value })} />
            </Field>
          </div>
          <div class="mt-4 space-y-3">
            {STYLE_FIGURES.map(({ key, label, unit }, i) => (
              <div key={key}>
                <span class="mb-1 block text-xs text-muted">{label}</span>
                <div class="flex flex-wrap items-center gap-2">
                  <OptNum value={ranges[key][0]} onChange={(n) => setLimit(key, 0, n)} unit={unit} placeholder="Min" class="w-32" />
                  <span class="text-muted">–</span>
                  <OptNum value={ranges[key][1]} onChange={(n) => setLimit(key, 1, n)} unit={unit} placeholder="Max" class="w-32" />
                  {errors[i] && <span class="text-xs text-caution">{errors[i]}</span>}
                </div>
              </div>
            ))}
          </div>
          <p class="mt-3 text-xs text-muted">Ein leerer Bereich zählt im Stilvergleich als unbekannt.</p>
          {failed && <p class="mt-3 text-sm text-critical">Speichern fehlgeschlagen.</p>}
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
          <button type="button" class={btnPrimary} disabled={busy || !s.name.trim() || errors.some(Boolean)} onClick={submit}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
