import { useState } from 'preact/hooks';
import { NumberField } from './NumberField';
import { GravityInput } from './GravityInput';
import { CalcResult } from './CalcResult';
import { ballingBeerAnalysis } from '../brewMath';
import { convertGravity, type GravityUnit } from '../gravityUnits';

export function CalcAttenuation() {
  const [unit, setUnit] = useState<GravityUnit>('plato');
  const [ogPlato, setOgPlato] = useState(12);
  const [fgSg, setFgSg] = useState(1.01);

  const apparentExtractPlato = convertGravity(fgSg, 'sg', 'plato');
  const { apparentAttenuationPercent, realAttenuationPercent } = ballingBeerAnalysis(ogPlato, apparentExtractPlato);

  return (
    <div class="space-y-4">
      <div class="space-y-2">
        <GravityInput label="Stammwürze (OG)" plato={ogPlato} onChange={setOgPlato} unit={unit} onUnitChange={setUnit} />
        <NumberField label="Restextrakt (FG, Spindel)" value={fgSg} onChange={setFgSg} step={0.001} unit="SG" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <CalcResult label="Scheinbarer Vergärungsgrad" value={apparentAttenuationPercent.toFixed(1)} unit="%" />
        <CalcResult label="Realer Vergärungsgrad" value={realAttenuationPercent.toFixed(1)} unit="%" />
      </div>
    </div>
  );
}
