import { useState } from 'preact/hooks';
import { Segmented } from './Segmented';
import { NumberField } from './NumberField';
import { CalcResult } from './CalcResult';
import { cylinderVolumeL, frustumVolumeL } from '../brewMath';

type Shape = 'cylinder' | 'frustum';

export function CalcVolume() {
  const [shape, setShape] = useState<Shape>('cylinder');
  const [diameter, setDiameter] = useState(40);
  const [diameterTop, setDiameterTop] = useState(40);
  const [diameterBottom, setDiameterBottom] = useState(15);
  const [height, setHeight] = useState(50);
  const [fillHeight, setFillHeight] = useState(30);

  const volume = shape === 'cylinder'
    ? cylinderVolumeL(diameter, fillHeight)
    : frustumVolumeL(diameterBottom, diameterTop, height, fillHeight);

  return (
    <div class="space-y-4">
      <Segmented value={shape}
        options={[{ value: 'cylinder', label: 'Zylinder' }, { value: 'frustum', label: 'Kegelstumpf' }]}
        onChange={setShape} />
      <div class="space-y-2">
        {shape === 'cylinder' ? (
          <NumberField label="Durchmesser" value={diameter} onChange={setDiameter} unit="cm" />
        ) : (
          <>
            <NumberField label="Durchmesser oben" value={diameterTop} onChange={setDiameterTop} unit="cm" />
            <NumberField label="Durchmesser unten" value={diameterBottom} onChange={setDiameterBottom} unit="cm" />
            <NumberField label="Gesamthöhe" value={height} onChange={setHeight} unit="cm" />
          </>
        )}
        <NumberField label="Füllhöhe (vom Boden)" value={fillHeight} onChange={setFillHeight} unit="cm" />
      </div>
      <CalcResult label="Volumen" value={volume.toFixed(2)} unit="L" />
    </div>
  );
}
