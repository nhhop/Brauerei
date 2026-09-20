import { useState } from 'preact/hooks';
import { NumberField } from './NumberField';
import { GravityInput } from './GravityInput';
import { CalcResult } from './CalcResult';
import { extractEfficiencyPercent } from '../brewMath';
import type { GravityUnit } from '../gravityUnits';

export function CalcMashEfficiency() {
  const [grainKg, setGrainKg] = useState(5);
  const [potential, setPotential] = useState(80);
  const [volume, setVolume] = useState(25);
  const [plato, setPlato] = useState(12);
  const [unit, setUnit] = useState<GravityUnit>('plato');

  const efficiency = extractEfficiencyPercent(grainKg, potential, volume, plato);

  return (
    <div class="space-y-4">
      <div class="space-y-2">
        <NumberField label="Schüttungsmenge" value={grainKg} onChange={setGrainKg} unit="kg" />
        <NumberField label="Extraktpotential (100 %)" value={potential} onChange={setPotential} unit="%" />
        <NumberField label="Volumen nach dem Läutern" value={volume} onChange={setVolume} unit="L" />
        <GravityInput label="Stammwürze nach dem Läutern" plato={plato} onChange={setPlato} unit={unit} onUnitChange={setUnit} />
      </div>
      <CalcResult label="Maischeeffizienz" value={efficiency.toFixed(1)} unit="%" />
    </div>
  );
}
