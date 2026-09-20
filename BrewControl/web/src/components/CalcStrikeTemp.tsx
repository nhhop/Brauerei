import { useState } from 'preact/hooks';
import { NumberField } from './NumberField';
import { CalcResult } from './CalcResult';
import { strikeWaterTempC } from '../brewMath';

export function CalcStrikeTemp() {
  const [waterL, setWaterL] = useState(20);
  const [grainKg, setGrainKg] = useState(5);
  const [grainTemp, setGrainTemp] = useState(20);
  const [targetTemp, setTargetTemp] = useState(66);

  const strikeTemp = strikeWaterTempC(waterL, grainKg, grainTemp, targetTemp);

  return (
    <div class="space-y-4">
      <div class="space-y-2">
        <NumberField label="Hauptguss-Volumen" value={waterL} onChange={setWaterL} unit="L" />
        <NumberField label="Schüttungsmenge" value={grainKg} onChange={setGrainKg} unit="kg" />
        <NumberField label="Schüttungstemperatur" value={grainTemp} onChange={setGrainTemp} unit="°C" />
        <NumberField label="Ziel-Einmaischtemperatur" value={targetTemp} onChange={setTargetTemp} unit="°C" />
      </div>
      <CalcResult label="Hauptguss-Temperatur" value={strikeTemp.toFixed(1)} unit="°C" />
    </div>
  );
}
