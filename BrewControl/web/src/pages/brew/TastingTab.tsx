import { useEffect, useRef, useState } from 'preact/hooks';
import { ChevronDown, ChevronRight } from 'lucide-preact';
import {
  addTasting, customTerms, daysSinceBottling, emptyTasting, getTasting, removeTasting, saveTasting, updateTasting,
  type BrewTasting, type Tasting,
} from '../../brewTasting';
import type { Brew } from '../../brews';
import { ConfirmModal } from '../../components/ConfirmModal';
import { badgeCritical, btnPrimary, inp, linkDanger } from '../../ui';
import { Card, Field } from '../recipe/fields';
import { toLocalInput } from './format';
import { TastingForm } from './TastingForm';

const SAVE_DELAY_MS = 1000;
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// The brew's tastings from the device; null while they load. Every change shows
// at once and is saved a moment after the last one (one save at a time); what
// is still waiting goes out when the tab is left.
function useTastingDoc(brewId: string) {
  const [doc, setDoc] = useState<BrewTasting | null>(null);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string>();
  const latest = useRef<BrewTasting | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let alive = true;
    getTasting(brewId).then((d) => { if (alive) { latest.current = d; setDoc(d); } }).catch((e) => alive && setError(String(e)));
    return () => { alive = false; };
  }, [brewId]);

  const flush = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const next = latest.current;
    if (!dirty.current || !next) return queue.current;
    dirty.current = false;
    setState('saving');
    queue.current = queue.current.then(async () => {
      try {
        await saveTasting(next);
        setError(undefined);
        setState(dirty.current ? 'saving' : 'saved');
      } catch (e) {
        dirty.current = true;
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    });
    return queue.current;
  };

  useEffect(() => () => { void flush(); }, []);

  const change = (next: BrewTasting) => {
    latest.current = next;
    dirty.current = true;
    setDoc(next);
    setState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  return { doc, change, state, error, retry: flush };
}

const when = (ms: number) =>
  new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const ageText = (days: number) => (days === 0 ? 'am Abfülltag' : `${days} ${days === 1 ? 'Tag' : 'Tage'} nach der Abfüllung`);

// Tab "Verkostung": the tastings of the brew, newest on top, each with a form
// of its own. Saved by itself, not with "Speichern", in a file of its own per brew.
export function TastingTab({ brew, editable }: { brew: Brew; editable: boolean }) {
  const { doc, change, state, error, retry } = useTastingDoc(brew.id);
  const [open, setOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const bottledAt = brew.phaseStartedAt?.bottling;

  const add = () => {
    if (!doc) return;
    const t = emptyTasting(Date.now());
    change(addTasting(doc, t));
    setOpen(t.id);
  };

  return (
    <>
      {!editable && <p class="mb-3 text-sm text-muted">Verkostungen lassen sich ab dem Brautag-Start eintragen.</p>}
      <Card title="Verkostungen"
        action={<button type="button" class={btnPrimary} disabled={!editable || !doc} onClick={add}>Neue Verkostung</button>}>
        <p class="text-sm text-muted">
          Jede Probe für sich, zum Beispiel das Jungbier, die Flasche nach zwei Wochen und nach sechs.
          {state === 'saving' && ' Speichert …'}{state === 'saved' && ' Gespeichert.'}
        </p>
        {error && (
          <p class="mt-2 text-sm text-critical">
            {state === 'error' ? 'Speichern fehlgeschlagen: ' : ''}{error}{' '}
            {state === 'error' && <button type="button" class="underline" onClick={() => void retry()}>Nochmal versuchen</button>}
          </p>
        )}
        {!doc && !error && <p class="mt-2 text-sm text-muted">Lädt …</p>}
        {doc && doc.tastings.length === 0 && <p class="mt-2 text-sm text-muted">Noch keine Verkostung.</p>}
      </Card>

      {doc && [...doc.tastings].reverse().map((t) => (
        <TastingCard key={t.id} tasting={t} knownTerms={customTerms(doc.tastings)} bottledAt={bottledAt} editable={editable} open={open === t.id}
          onToggle={() => setOpen(open === t.id ? null : t.id)}
          onChange={(next) => change(updateTasting(doc, next))}
          onDelete={() => setDeleting(t.id)} />
      ))}

      <ConfirmModal open={deleting !== null} title="Verkostung löschen?" confirmLabel="Löschen" destructive
        onConfirm={() => { if (doc && deleting) change(removeTasting(doc, deleting)); setDeleting(null); }}
        onCancel={() => setDeleting(null)}>
        Die Verkostung wird dauerhaft entfernt.
      </ConfirmModal>
    </>
  );
}

function TastingCard({ tasting: t, knownTerms, bottledAt, editable, open, onToggle, onChange, onDelete }: {
  tasting: Tasting; knownTerms: string[]; bottledAt: number | undefined; editable: boolean; open: boolean;
  onToggle: () => void; onChange: (t: Tasting) => void; onDelete: () => void;
}) {
  const age = daysSinceBottling(t.at, bottledAt);
  return (
    <section class="mb-4 rounded-md border border-card-border bg-card p-4 shadow-elev-2">
      <button type="button" aria-expanded={open} class="flex w-full items-center gap-2 text-left" onClick={onToggle}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold">{when(t.at)}{t.taster ? ` · ${t.taster}` : ''}</span>
          {age !== undefined && <span class="block text-xs text-muted">{ageText(age)}</span>}
        </span>
        {t.faults.length > 0 && <span class={badgeCritical}>{t.faults.length === 1 ? '1 Fehlaroma' : `${t.faults.length} Fehlaromen`}</span>}
      </button>
      {open && (
        <fieldset disabled={!editable} class="m-0 mt-3 min-w-0 border-0 p-0">
          <div class="mb-3 grid gap-3 sm:grid-cols-2">
            <Field label="Zeitpunkt">
              <input type="datetime-local" class={`${inp} w-full`} value={toLocalInput(t.at)}
                onInput={(e) => { const at = Date.parse(e.currentTarget.value); if (!Number.isNaN(at)) onChange({ ...t, at }); }} />
            </Field>
            <Field label="Verkoster">
              <input class={`${inp} w-full`} value={t.taster ?? ''}
                onInput={(e) => onChange({ ...t, taster: e.currentTarget.value || undefined })} />
            </Field>
          </div>
          <TastingForm tasting={t} knownTerms={knownTerms} onChange={onChange} />
          <div class="mt-3 border-t border-border pt-3 text-right">
            <button type="button" class={linkDanger} onClick={onDelete}>Verkostung löschen</button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
