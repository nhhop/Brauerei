import type { BrewInputs } from '../../brewDay';
import { dryHops } from '../../brewPrograms';
import type { Brew } from '../../brews';
import type { Recipe } from '../../recipes';
import { inp } from '../../ui';
import { Card, Field } from '../recipe/fields';
import { DryHopList } from './DryHopList';
import type { Patch } from './PrepTab';
import { Readings, useReadings } from './Readings';

// Tab "Reifung": the dry hops of the maturation to tick off and the readings by
// hand. Values, carbonation and the bottling follow with 5c-5.
export function MaturationTab({ brew, recipe, inputs, editable, patch, og, notes, onNotes }: {
  brew: Brew;                  // as saved; the page keeps the head's draft
  recipe: Recipe;
  inputs: BrewInputs;
  editable: boolean;
  patch: Patch;
  og: number | undefined;      // gravity of the pitched wort, °P: what a refractometer reading is set against
  notes: string | undefined;
  onNotes: (text: string | undefined) => void;
}) {
  const hops = dryHops(recipe, inputs.entries, brew.rowAmounts).filter((h) => h.row.timing === 'maturation');
  const [readings, setReadings] = useReadings(brew.id);
  return (
    <>
      {!editable && <p class="mb-3 text-sm text-muted">Haken und Mengen lassen sich ab dem Brautag-Start eintragen.</p>}
      <Card title="Stopfen">
        {hops.length === 0 ? <p class="text-sm text-muted">Das Rezept hat keine Stopfgaben in der Reifung.</p> : (
          <DryHopList brew={brew} recipe={recipe} hops={hops} pitchedAt={brew.phaseStartedAt?.fermentation}
            editable={editable} patch={patch} />
        )}
      </Card>

      <Readings doc={readings} onDoc={setReadings} og={og} editable={editable} />

      <Card title="Notizen zur Reifung">
        <Field label="Gespeichert mit „Speichern“">
          <textarea class={`${inp} w-full`} rows={2} value={notes ?? ''}
            onInput={(e) => onNotes(e.currentTarget.value || undefined)} />
        </Field>
      </Card>
    </>
  );
}
