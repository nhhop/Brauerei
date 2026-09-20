import { useState } from 'preact/hooks';
import { NumberField } from './NumberField';
import { CalcResult } from './CalcResult';
import { overrangeConcentration } from '../brewMath';

export function CalcOverrangeDilution() {
  const [undilutedMass, setUndilutedMass] = useState(100);
  const [waterMass, setWaterMass] = useState(100);
  const [dilutedConcentration, setDilutedConcentration] = useState(15);

  const trueConcentration = overrangeConcentration(undilutedMass, waterMass, dilutedConcentration);

  return (
    <div class="space-y-4">
      <div class="space-y-2">
        <NumberField label="Menge unverdünnte Würze" value={undilutedMass} onChange={setUndilutedMass} unit="g" />
        <NumberField label="Zugegebenes Wasser" value={waterMass} onChange={setWaterMass} unit="g" />
        <NumberField label="Messung nach Verdünnung" value={dilutedConcentration} onChange={setDilutedConcentration} unit="°P / °Bx" />
      </div>
      <CalcResult label="Konzentration unverdünnt" value={trueConcentration.toFixed(1)} unit="°P / °Bx" />
    </div>
  );
}
