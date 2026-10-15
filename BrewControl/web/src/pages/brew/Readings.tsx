import { useEffect, useState } from 'preact/hooks';
import { Segmented } from '../../components/Segmented';
import {
  addReading, entryToReading, getReadings, KIND_LABEL, readingText, removeReading, saveReadings,
  type BrewReadings, type EntryKind,
} from '../../brewReadings';
import type { GravityUnit } from '../../gravityUnits';
import { btnPrimary, inp, linkDanger } from '../../ui';
import { Card, Field } from '../recipe/fields';
import { toLocalInput } from './format';

const KINDS: { value: EntryKind; label: string }[] = [
  { value: 'gravity', label: 'Dichte' }, { value: 'temp', label: 'Temperatur' }, { value: 'ph', label: 'pH' },
];
const UNITS: { value: GravityUnit; label: string }[] = [
  { value: 'plato', label: '°P' }, { value: 'sg', label: 'SG' }, { value: 'brix', label: '°Bx' },
];
const HINT: Record<EntryKind, string> = { gravity: 'z. B. 4,5', temp: 'z. B. 18,5', ph: 'z. B. 4,45' };

const when = (ms: number) =>
  new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// The brew's readings from the device; null while they load. A brew whose
// readings cannot be read (no SD card) stays null.
export function useReadings(brewId: string): [BrewReadings | null, (d: BrewReadings) => void] {
  const [doc, setDoc] = useState<BrewReadings | null>(null);
  useEffect(() => {
    let alive = true;
    getReadings(brewId).then((d) => alive && setDoc(d)).catch(() => {});
    return () => { alive = false; };
  }, [brewId]);
  return [doc, setDoc];
}

// Card "Messungen": values the brewer measured by hand (hydrometer, refractometer,
// thermometer, pH meter), saved at once in a file of their own per brew. `og` is
// the original extract, °P, that turns a refractometer reading into a gravity.
export function Readings({ doc, onDoc, og, editable }: {
  doc: BrewReadings | null;
  onDoc: (d: BrewReadings) => void;
  og: number | undefined;
  editable: boolean;
}) {
  const [kind, setKind] = useState<EntryKind>('gravity');
  const [unit, setUnit] = useState<GravityUnit>('plato');
  const [text, setText] = useState('');
  const [time, setTime] = useState(() => toLocalInput(Date.now()));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  const save = async (next: BrewReadings) => {
    try {
      await saveReadings(next);
      onDoc(next);
      setError(undefined);
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    }
  };

  const add = async () => {
    if (!doc) return;
    const at = Date.parse(time);
    const reading = entryToReading(kind, unit, text, Number.isNaN(at) ? Date.now() : at, note);
    if (!reading) {
      setError('Der Wert fehlt oder liegt außerhalb des sinnvollen Bereichs.');
      return;
    }
    if (await save(addReading(doc, reading))) {
      setText('');
      setNote('');
      setTime(toLocalInput(Date.now()));
    }
  };

  return (
    <Card title="Messungen">
      <div class="flex flex-wrap items-center gap-2">
        <Segmented value={kind} options={KINDS} onChange={setKind} disabled={!editable} />
        {kind === 'gravity' && <Segmented value={unit} options={UNITS} onChange={setUnit} disabled={!editable} />}
      </div>
      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Wert">
          <input type="text" inputMode="decimal" class={`${inp} w-full`} placeholder={HINT[kind]} value={text} disabled={!editable || !doc}
            onInput={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
        </Field>
        <Field label="Zeit">
          <input type="datetime-local" class={`${inp} w-full`} value={time} disabled={!editable || !doc}
            onInput={(e) => setTime(e.currentTarget.value)} />
        </Field>
        <Field label="Notiz">
          <input type="text" class={`${inp} w-full`} value={note} disabled={!editable || !doc}
            onInput={(e) => setNote(e.currentTarget.value)} />
        </Field>
      </div>
      <div class="mt-3">
        <button type="button" class={btnPrimary} disabled={!editable || !doc} onClick={() => void add()}>Eintragen</button>
      </div>
      {error && <p class="mt-2 text-sm text-critical">{error}</p>}

      {doc && doc.readings.length === 0 && <p class="mt-3 text-sm text-muted">Noch keine Messung.</p>}
      {doc && doc.readings.length > 0 && (
        <ul class="mt-3">
          {doc.readings.map((r, i) => (
            <li key={`${r.at}-${i}`} class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-1 py-2 text-sm last:border-b-0">
              <span class="w-28 text-muted">{when(r.at)}</span>
              <span class="w-36 font-semibold">{readingText(r, og)}</span>
              <span class="min-w-0 flex-1 text-muted">{KIND_LABEL[r.kind]}{r.note ? ` · ${r.note}` : ''}</span>
              {editable && <button type="button" class={linkDanger} onClick={() => void save(removeReading(doc, i))}>Löschen</button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
