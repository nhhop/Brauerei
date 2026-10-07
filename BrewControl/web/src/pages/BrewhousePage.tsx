import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { Copy, Factory, Pencil, Plus, Trash2 } from 'lucide-preact';
import {
  DEFAULT_BREWERY, TEMPLATES, brewhouseSummary, deleteBrewhouse, getBrewery, listBrewhouses, saveBrewery,
  type Brewery, type Brewhouse,
} from '../brewhouse';
import { Breadcrumb } from '../components/Breadcrumb';
import { ConfirmModal } from '../components/ConfirmModal';
import { Fab } from '../components/Fab';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { DEFAULT_PH_MODEL, type PhModel } from '../mashPh';
import { btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../ui';
import { Field, NumInput } from './recipe/fields';
import { WaterProfilesSection } from './WaterProfiles';

const editUrl = (id: string) => `/settings/anlage/sudhaus/${encodeURIComponent(id)}`;

// Settings › Brauanlage: the brewery's site values, then the brewhouses. A new
// or duplicated brewhouse opens in the editor as an unsaved draft.
export function BrewhousePage(_: { path?: string }) {
  const [brewhouses, setBrewhouses] = useState<Brewhouse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Brewhouse | null>(null);

  function refresh() {
    return listBrewhouses().then(setBrewhouses);
  }

  useEffect(() => { refresh().catch(() => setError('Sudhäuser konnten nicht geladen werden.')); }, []);

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteBrewhouse(target.id);
      await refresh();
    } catch { setError('Sudhaus konnte nicht gelöscht werden.'); }
  }

  return (
    <PageShell>
      <header class="mb-6">
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Brauanlage' }]} />
      </header>

      <BreweryCard />

      <div class="mb-3 mt-8 flex items-center justify-between gap-3">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">Sudhaus</h2>
        <button type="button" onClick={() => setPicking(true)} class={`${btnPrimary} hidden md:inline-flex`}>
          + Neu
        </button>
      </div>
      <Fab icon={Plus} label="Neues Sudhaus" onClick={() => setPicking(true)} />

      {error && <p class="mb-3 text-sm text-critical">{error}</p>}
      {brewhouses === null ? (
        !error && <SkeletonList count={2} />
      ) : brewhouses.length === 0 ? (
        <p class="text-sm text-muted">
          Noch kein Sudhaus. Lege über „+ Neu“ eines aus einer Vorlage an. Die Rezepte rechnen später mit
          seinen Verlusten und der Verdampfung.
        </p>
      ) : (
        <div class="space-y-1">
          {brewhouses.map((bh) => (
            <div key={bh.id} onClick={() => route(editUrl(bh.id))}
              class="flex cursor-pointer items-center gap-4 rounded-md border border-card-border bg-card px-4 py-3 shadow-elev-2 hover:bg-subtle-hover">
              <Factory size={20} class="shrink-0 text-muted" />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium">{bh.name || 'Ohne Namen'}</div>
                <div class="text-xs text-muted">{brewhouseSummary(bh)}</div>
              </div>
              <div class="flex shrink-0 items-center gap-2 text-xs">
                <button type="button" title="Sudhaus bearbeiten"
                  onClick={(e) => { e.stopPropagation(); route(editUrl(bh.id)); }}
                  class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
                  <Pencil size={14} />
                </button>
                <button type="button" title="Sudhaus duplizieren"
                  onClick={(e) => { e.stopPropagation(); route(`${editUrl('neu')}?von=${encodeURIComponent(bh.id)}`); }}
                  class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
                  <Copy size={14} />
                </button>
                <button type="button" title="Sudhaus löschen"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(bh); }}
                  class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {picking && <TemplateDialog onClose={() => setPicking(false)} />}

      <ConfirmModal open={deleteTarget !== null} title="Sudhaus löschen?" confirmLabel="Löschen" destructive
        onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)}>
        „{deleteTarget?.name}“ wird dauerhaft entfernt.
      </ConfirmModal>
    </PageShell>
  );
}

// Edited in place with its own save button; the values are defaults for recipe
// calculations and the brew day, which records the day's values as measurements.
function BreweryCard() {
  const [saved, setSaved] = useState<Brewery | null>(null);
  const [draft, setDraft] = useState<Brewery>(DEFAULT_BREWERY);
  const [state, setState] = useState<'idle' | 'saving' | 'error' | 'loadError'>('idle');

  useEffect(() => {
    getBrewery().then((b) => { setSaved(b); setDraft(b); }).catch(() => setState('loadError'));
  }, []);

  const dirty = saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  function save() {
    setState('saving');
    saveBrewery(draft).then(() => { setSaved(draft); setState('idle'); }).catch(() => setState('error'));
  }

  return (
    <section class="rounded-md border border-card-border bg-card p-4 shadow-elev-2">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 class="font-medium">Brauerei</h2>
          <p class="text-xs text-muted">Gilt für alle Sudhäuser am Standort.</p>
        </div>
        <button type="button" class={btnPrimary} disabled={!dirty || state === 'saving'} onClick={save}>
          Speichern{dirty ? ' •' : ''}
        </button>
      </div>
      <div class="flex flex-wrap gap-4">
        <Field label="Malztemperatur (°C)">
          <NumInput value={draft.grainTempC} onChange={(n) => setDraft({ ...draft, grainTempC: n })} />
        </Field>
        <Field label="Leitungswassertemperatur (°C)">
          <NumInput value={draft.tapWaterTempC} onChange={(n) => setDraft({ ...draft, tapWaterTempC: n })} />
        </Field>
        <Field label="pH-Modell (alle Rezepte)">
          <select class={inp} value={draft.phModel ?? DEFAULT_PH_MODEL}
            onChange={(e) => {
              const v = e.currentTarget.value as PhModel;
              setDraft({ ...draft, phModel: v === DEFAULT_PH_MODEL ? undefined : v });
            }}>
            <option value="troester">Troester: pH aus Malzdaten</option>
            <option value="kolbach">Kolbach: Restalkalität nach Bierfarbe</option>
          </select>
        </Field>
      </div>
      <WaterProfilesSection brewery={draft} onChange={setDraft} />
      {state === 'error' && <p class="mt-2 text-sm text-critical">Speichern fehlgeschlagen.</p>}
      {state === 'loadError' && <p class="mt-2 text-sm text-critical">Brauerei konnte nicht geladen werden.</p>}
    </section>
  );
}

function TemplateDialog({ onClose }: { onClose: () => void }) {
  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-md ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="mb-1 text-base font-medium text-fg">Vorlage wählen</h2>
          <p class="mb-4 text-sm text-muted">Die Vorlage füllt einen Entwurf, den du im Editor anpasst und speicherst.</p>
          <div class="space-y-1">
            {TEMPLATES.map((t) => (
              <button key={t.key} type="button"
                onClick={() => route(`${editUrl('neu')}?vorlage=${t.key}`)}
                class="block w-full rounded-md border border-card-border bg-card px-4 py-3 text-left hover:bg-subtle-hover active:bg-subtle-pressed">
                <div class="font-medium text-fg">{t.label}</div>
                <div class="text-xs text-muted">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
