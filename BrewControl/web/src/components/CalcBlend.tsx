import { useState } from 'preact/hooks';
import { Segmented } from './Segmented';
import { NumberField } from './NumberField';
import { GravityInput } from './GravityInput';
import { CalcResult } from './CalcResult';
import { blendGravitySg, blendWeighted } from '../brewMath';
import { convertGravity, type GravityUnit } from '../gravityUnits';

type Mode = 'gravity' | 'temperature';

const UNIT_LABEL: Record<GravityUnit, string> = { plato: '°P', sg: 'SG', brix: '°Bx' };

export function CalcBlend() {
  const [mode, setMode] = useState<Mode>('gravity');
  const [unit, setUnit] = useState<GravityUnit>('plato');
  const [v1, setV1] = useState(10);
  const [v2, setV2] = useState(10);
  const [p1, setP1] = useState(10);
  const [p2, setP2] = useState(16);
  const [t1, setT1] = useState(20);
  const [t2, setT2] = useState(80);

  const resultGravitySg = blendGravitySg(v1, convertGravity(p1, 'plato', 'sg'), v2, convertGravity(p2, 'plato', 'sg'));
  const resultTemp = blendWeighted(v1, t1, v2, t2);

  return (
    <div class="space-y-4">
      <Segmented value={mode}
        options={[{ value: 'gravity', label: 'Stammwürze' }, { value: 'temperature', label: 'Temperatur' }]}
        onChange={setMode} />
      <div class="space-y-2">
        <NumberField label="Volumen 1" value={v1} onChange={setV1} unit="L" />
        {mode === 'gravity'
          ? <GravityInput label="Stammwürze 1" plato={p1} onChange={setP1} unit={unit} onUnitChange={setUnit} />
          : <NumberField label="Temperatur 1" value={t1} onChange={setT1} unit="°C" />}
        <NumberField label="Volumen 2" value={v2} onChange={setV2} unit="L" />
        {mode === 'gravity'
          ? <GravityInput label="Stammwürze 2" plato={p2} onChange={setP2} unit={unit} onUnitChange={setUnit} />
          : <NumberField label="Temperatur 2" value={t2} onChange={setT2} unit="°C" />}
      </div>
      {mode === 'gravity'
        ? <CalcResult label="Ergebnis-Stammwürze"
            value={convertGravity(resultGravitySg, 'sg', unit).toFixed(unit === 'sg' ? 3 : 1)}
            unit={UNIT_LABEL[unit]} />
        : <CalcResult label="Ergebnis-Temperatur" value={resultTemp.toFixed(1)} unit="°C" />}
    </div>
  );
}
