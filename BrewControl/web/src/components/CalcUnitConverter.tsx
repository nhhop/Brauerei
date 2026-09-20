import { useState } from 'preact/hooks';
import { GravityInput } from './GravityInput';
import { CalcResult } from './CalcResult';
import { convertGravity, type GravityUnit } from '../gravityUnits';

export function CalcUnitConverter() {
  const [plato, setPlato] = useState(12);
  const [unit, setUnit] = useState<GravityUnit>('plato');

  return (
    <div class="space-y-4">
      <GravityInput label="Wert" plato={plato} onChange={setPlato} unit={unit} onUnitChange={setUnit} />
      <div class="grid gap-3 sm:grid-cols-3">
        <CalcResult label="°Plato" value={plato.toFixed(1)} />
        <CalcResult label="SG" value={convertGravity(plato, 'plato', 'sg').toFixed(3)} />
        <CalcResult label="°Brix" value={convertGravity(plato, 'plato', 'brix').toFixed(1)} />
      </div>
    </div>
  );
}
