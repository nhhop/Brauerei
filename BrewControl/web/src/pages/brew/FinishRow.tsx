import type { BrewTargets } from '../../brewDay';
import { lastGravity, readingText, type BrewReadings } from '../../brewReadings';
import { setMeasurement, type Brew, type MeasureId } from '../../brews';
import { MeasureRow } from './MeasureRow';
import type { Patch } from './PrepTab';

// The final gravity is suggested from the last gravity reading by hand.
export function finalGravitySuggestion(readings: BrewReadings | null, og: number | undefined): { v: number; text: string } | undefined {
  const last = lastGravity(readings, og);
  if (!last) return undefined;
  const day = new Date(last.reading.at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return { v: last.plato, text: `Letzte Messung: ${readingText(last.reading, og)} am ${day}` };
}

const LABEL: Partial<Record<MeasureId, [label: string, sub?: string]>> = {
  finalGravity: ['Restextrakt', 'scheinbar'],
  maxTempAfter: ['Höchsttemperatur nach dem Gärende', 'für die Restkohlensäure'],
  bottledVolume: ['Abgefüllte Menge'],
  dilutionVolume: ['Verschnitt', 'entgastes Wasser im Keg'],
};

// A measurement after the fermentation (5c-5), by hand: the final gravity, the
// highest temperature after its end, the volume filled, the water a dilution
// in the keg adds. Both the maturation and
// the bottling tab show the first two, with the same state.
export function FinishRow({ id, brew, targets, editable, patch, suggest }: {
  id: 'finalGravity' | 'maxTempAfter' | 'bottledVolume' | 'dilutionVolume';
  brew: Brew;
  targets: BrewTargets;
  editable: boolean;
  patch: Patch;
  suggest?: { v: number; text: string };
}) {
  const [label, sub] = LABEL[id]!;
  return (
    <MeasureRow id={id} label={label} sub={sub} soll={targets.values[id]} value={brew.measurements?.[id]} suggest={suggest}
      disabled={!editable} onSave={(m) => patch((b) => setMeasurement(b, id, m))} />
  );
}
