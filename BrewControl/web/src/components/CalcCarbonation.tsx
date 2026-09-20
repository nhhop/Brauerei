import { useState } from 'preact/hooks';
import { Segmented } from './Segmented';
import { NumberField } from './NumberField';
import { GravityInput } from './GravityInput';
import { CalcResult } from './CalcResult';
import { primingSugarGrams, speiseVolumeL, recommendedRackingGravityPlato, type SugarType } from '../brewMath';
import { convertGravity, type GravityUnit } from '../gravityUnits';

const SUGAR_OPTIONS: { value: SugarType; label: string }[] = [
  { value: 'saccharose', label: 'Saccharose' },
  { value: 'traubenzucker', label: 'Traubenzucker' },
  { value: 'dme', label: 'DME' },
];

const UNIT_LABEL: Record<GravityUnit, string> = { plato: '°P', sg: 'SG', brix: '°Bx' };

export function CalcCarbonation() {
  const [volume, setVolume] = useState(20);
  const [targetVolumes, setTargetVolumes] = useState(2.4);
  const [temp, setTemp] = useState(18);
  const [sugarType, setSugarType] = useState<SugarType>('saccharose');
  const [speiseUnit, setSpeiseUnit] = useState<GravityUnit>('plato');
  const [speisePlato, setSpeisePlato] = useState(11);
  const [attenuationPct, setAttenuationPct] = useState(75);
  const [rackUnit, setRackUnit] = useState<GravityUnit>('plato');
  const [ogPlato, setOgPlato] = useState(12);
  const [fgExpectedPlato, setFgExpectedPlato] = useState(3);

  const sugarGrams = primingSugarGrams(volume, targetVolumes, temp, sugarType);
  const speiseL = speiseVolumeL(volume, targetVolumes, temp, speisePlato, attenuationPct / 100);
  const rackingGravity = recommendedRackingGravityPlato(ogPlato, fgExpectedPlato);

  return (
    <div class="space-y-5">
      <div class="space-y-2">
        <NumberField label="Biermenge" value={volume} onChange={setVolume} unit="L" />
        <NumberField label="Ziel-Karbonisierung" value={targetVolumes} onChange={setTargetVolumes} step={0.1} unit="Vol. CO₂" />
        <NumberField label="Höchste Gärtemperatur" value={temp} onChange={setTemp} unit="°C" />
      </div>

      <section class="space-y-2 border-t border-border pt-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">Zucker</h3>
        <Segmented value={sugarType} options={SUGAR_OPTIONS} onChange={setSugarType} />
        <CalcResult label="Zuckermenge" value={sugarGrams.toFixed(1)} unit="g" />
      </section>

      <section class="space-y-2 border-t border-border pt-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">Speise (alternativ)</h3>
        <GravityInput label="Stammwürze der Speise" plato={speisePlato} onChange={setSpeisePlato} unit={speiseUnit} onUnitChange={setSpeiseUnit} />
        <NumberField label="Angenommener Vergärungsgrad der Speise" value={attenuationPct} onChange={setAttenuationPct} unit="%" />
        <CalcResult label="Speisemenge" value={speiseL.toFixed(2)} unit="L" />
      </section>

      <section class="space-y-2 border-t border-border pt-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">Grünschlauchen — Zeitpunkt</h3>
        <GravityInput label="Stammwürze (OG)" plato={ogPlato} onChange={setOgPlato} unit={rackUnit} onUnitChange={setRackUnit} />
        <GravityInput label="Erwarteter Endvergärungswert" plato={fgExpectedPlato} onChange={setFgExpectedPlato} unit={rackUnit} onUnitChange={setRackUnit} />
        <CalcResult label="Grünschlauchen bei ca."
          value={convertGravity(rackingGravity, 'plato', rackUnit).toFixed(rackUnit === 'sg' ? 3 : 1)}
          unit={UNIT_LABEL[rackUnit]}
          secondary="Erfahrungswert: bei ca. 85 % der erwarteten Vergärung, statt einer festen Zeitangabe — Gärtemperatur und Hefe beeinflussen die Dauer zu stark für eine verlässliche Zeitprognose." />
      </section>
    </div>
  );
}
