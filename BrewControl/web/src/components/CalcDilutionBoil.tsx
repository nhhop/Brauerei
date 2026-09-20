import { useState } from 'preact/hooks';
import { Segmented } from './Segmented';
import { NumberField } from './NumberField';
import { GravityInput } from './GravityInput';
import { CalcResult } from './CalcResult';
import { dilutionVolumeL, boilDownResult } from '../brewMath';
import { convertGravity, type GravityUnit } from '../gravityUnits';

type Mode = 'dilute' | 'boil';

export function CalcDilutionBoil() {
  const [mode, setMode] = useState<Mode>('dilute');
  const [unit, setUnit] = useState<GravityUnit>('plato');
  const [volume, setVolume] = useState(20);
  const [currentPlato, setCurrentPlato] = useState(14);
  const [targetPlato, setTargetPlato] = useState(12);
  const [blendPlato, setBlendPlato] = useState(0);
  const [evapRate, setEvapRate] = useState(3);

  const currentSg = convertGravity(currentPlato, 'plato', 'sg');
  const targetSg = convertGravity(targetPlato, 'plato', 'sg');
  const blendSg = convertGravity(blendPlato, 'plato', 'sg');

  const addVolume = mode === 'dilute' ? dilutionVolumeL(volume, currentSg, targetSg, blendSg) : null;
  const boil = mode === 'boil' ? boilDownResult(volume, currentSg, targetSg, evapRate) : null;

  return (
    <div class="space-y-4">
      <Segmented value={mode}
        options={[{ value: 'dilute', label: 'Verdünnen' }, { value: 'boil', label: 'Einkochen' }]}
        onChange={setMode} />
      <div class="space-y-2">
        <NumberField label="Aktuelles Volumen" value={volume} onChange={setVolume} unit="L" />
        <GravityInput label="Aktuelle Stammwürze" plato={currentPlato} onChange={setCurrentPlato} unit={unit} onUnitChange={setUnit} />
        <GravityInput label="Ziel-Stammwürze" plato={targetPlato} onChange={setTargetPlato} unit={unit} onUnitChange={setUnit} />
        {mode === 'dilute' && (
          <GravityInput label="Stammwürze der Mischflüssigkeit" plato={blendPlato} onChange={setBlendPlato} unit={unit} onUnitChange={setUnit} />
        )}
        {mode === 'boil' && (
          <NumberField label="Verdampfungsrate" value={evapRate} onChange={setEvapRate} unit="L/h" />
        )}
      </div>
      {mode === 'dilute' && addVolume !== null && (
        <CalcResult label="Zuzugebende Menge" value={addVolume.toFixed(2)} unit="L" />
      )}
      {mode === 'boil' && boil && (
        <div class="grid gap-3 sm:grid-cols-3">
          <CalcResult label="Endvolumen" value={boil.finalVolumeL.toFixed(2)} unit="L" />
          <CalcResult label="Verdampfte Menge" value={boil.removedVolumeL.toFixed(2)} unit="L" />
          <CalcResult label="Kochzeit" value={boil.boilTimeH.toFixed(1)} unit="h" />
        </div>
      )}
    </div>
  );
}
