import { useState } from 'preact/hooks';
import { NumberField } from './NumberField';
import { GravityInput } from './GravityInput';
import { CalcResult } from './CalcResult';
import { apparentExtractFromRefractometer } from '../brewMath';
import { convertGravity, type GravityUnit } from '../gravityUnits';

export function CalcRefractometerCorrection() {
  const [unit, setUnit] = useState<GravityUnit>('plato');
  const [oePlato, setOePlato] = useState(12);
  const [brix, setBrix] = useState(6.4);
  const [bcf, setBcf] = useState(1.03);

  const aePlato = apparentExtractFromRefractometer(oePlato, brix, bcf);
  const aeSg = convertGravity(aePlato, 'plato', 'sg');

  return (
    <div class="space-y-4">
      <div class="space-y-2">
        <GravityInput label="Stammwürze (OG)" plato={oePlato} onChange={setOePlato} unit={unit} onUnitChange={setUnit} />
        <NumberField label="Aktuelle Messung" value={brix} onChange={setBrix} unit="°Bx" />
        <NumberField label="Brix-Korrekturfaktor (BCF)" value={bcf} onChange={setBcf} step={0.01} />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <CalcResult label="Scheinbarer Restextrakt" value={aePlato.toFixed(1)} unit="°P" />
        <CalcResult label="entspricht" value={aeSg.toFixed(3)} unit="SG" />
      </div>
    </div>
  );
}
