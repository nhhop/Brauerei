import { useState } from 'preact/hooks';
import { NumberField } from './NumberField';
import { CalcResult } from './CalcResult';
import { hydrometerCorrectedSg } from '../brewMath';

export function CalcHydrometerCorrection() {
  const [measuredSg, setMeasuredSg] = useState(1.05);
  const [measuredTemp, setMeasuredTemp] = useState(25);
  const [calibrationTemp, setCalibrationTemp] = useState(20);

  const corrected = hydrometerCorrectedSg(measuredSg, measuredTemp, calibrationTemp);

  return (
    <div class="space-y-4">
      <div class="space-y-2">
        <NumberField label="Gemessene Dichte" value={measuredSg} onChange={setMeasuredSg} step={0.001} unit="SG" />
        <NumberField label="Temperatur der Messung" value={measuredTemp} onChange={setMeasuredTemp} unit="°C" />
        <NumberField label="Kalibriertemperatur der Spindel" value={calibrationTemp} onChange={setCalibrationTemp} unit="°C" />
      </div>
      <CalcResult label="Korrigierte Dichte" value={corrected.toFixed(3)} unit="SG" />
    </div>
  );
}
