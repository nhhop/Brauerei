import { convertGravity, type GravityUnit } from '../gravityUnits';
import { Segmented } from './Segmented';
import { inp } from '../ui';

const UNIT_OPTIONS: { value: GravityUnit; label: string }[] = [
  { value: 'plato', label: '°P' },
  { value: 'sg', label: 'SG' },
  { value: 'brix', label: '°Bx' },
];

// Gravity value input with a °Plato/SG/°Brix unit switcher — value is always
// carried as °Plato by the caller; this only converts for display/entry.
export function GravityInput({ label, plato, onChange, unit, onUnitChange }: {
  label: string;
  plato: number;
  onChange: (plato: number) => void;
  unit: GravityUnit;
  onUnitChange: (u: GravityUnit) => void;
}) {
  const displayValue = convertGravity(plato, 'plato', unit);
  const decimals = unit === 'sg' ? 3 : 1;

  return (
    <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span class="text-muted">{label}</span>
      <span class="flex items-center gap-2">
        <input type="number" step="any" class={`${inp} w-24`}
          value={Number.isFinite(displayValue) ? displayValue.toFixed(decimals) : ''}
          onInput={(e) => {
            const raw = parseFloat((e.target as HTMLInputElement).value);
            if (!Number.isNaN(raw)) onChange(convertGravity(raw, unit, 'plato'));
          }} />
        <Segmented value={unit} options={UNIT_OPTIONS} onChange={onUnitChange} />
      </span>
    </div>
  );
}
