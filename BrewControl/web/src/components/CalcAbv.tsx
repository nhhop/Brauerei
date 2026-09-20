import { useState } from 'preact/hooks';
import { Segmented } from './Segmented';
import { NumberField } from './NumberField';
import { GravityInput } from './GravityInput';
import { CalcResult } from './CalcResult';
import { ballingBeerAnalysis, originalExtractFromDualMeasurement } from '../brewMath';
import { convertGravity, type GravityUnit } from '../gravityUnits';

type Mode = 'known' | 'unknown';

export function CalcAbv() {
  const [mode, setMode] = useState<Mode>('known');
  const [unit, setUnit] = useState<GravityUnit>('plato');
  const [ogPlato, setOgPlato] = useState(12);
  const [fgSg, setFgSg] = useState(1.01);
  const [brix, setBrix] = useState(6.4);
  const [bcf, setBcf] = useState(1.03);

  const apparentExtractPlato = convertGravity(fgSg, 'sg', 'plato');
  const effectiveOgPlato = mode === 'known'
    ? ogPlato
    : originalExtractFromDualMeasurement(apparentExtractPlato, brix, bcf);
  const analysis = ballingBeerAnalysis(effectiveOgPlato, apparentExtractPlato);

  return (
    <div class="space-y-4">
      <Segmented value={mode}
        options={[{ value: 'known', label: 'Stammwürze bekannt' }, { value: 'unknown', label: 'Stammwürze unbekannt' }]}
        onChange={setMode} />
      <div class="space-y-2">
        {mode === 'known'
          ? <GravityInput label="Stammwürze (OG)" plato={ogPlato} onChange={setOgPlato} unit={unit} onUnitChange={setUnit} />
          : (
            <>
              <NumberField label="Refraktometer-Messung" value={brix} onChange={setBrix} unit="°Bx" />
              <NumberField label="Brix-Korrekturfaktor (BCF)" value={bcf} onChange={setBcf} step={0.01} />
            </>
          )}
        <NumberField label="Restextrakt (FG, Spindel)" value={fgSg} onChange={setFgSg} step={0.001} unit="SG" />
      </div>
      {mode === 'unknown' && (
        <CalcResult label="Geschätzte Stammwürze" value={effectiveOgPlato.toFixed(1)} unit="°P" />
      )}
      <div class="grid gap-3 sm:grid-cols-2">
        <CalcResult label="Alkohol" value={analysis.abvPercent.toFixed(1)} unit="% vol" />
        <CalcResult label="Alkohol" value={analysis.abwPercent.toFixed(1)} unit="% Gew." />
      </div>
    </div>
  );
}
