import { useState, useEffect } from 'preact/hooks';
import type { Snapshot, AlarmConfig, CondOp, Severity } from '../types';
import { btnPrimary, btnSecondary, dialogFrame, dialogFooter, dialogBtnRow, inp, linkDanger } from '../ui';
import { Segmented } from './Segmented';

type SaveCfg = Pick<AlarmConfig, 'name' | 'enabled' | 'severity' | 'forSec' | 'cond'>;

interface Props {
  open: boolean;
  snap: Snapshot | null;
  initial?: AlarmConfig;
  onSave: (cfg: SaveCfg) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warnung' },
  { value: 'critical', label: 'Kritisch' },
];

// Same grouping the log editor uses. Sensor ids already carry the sub-channel
// suffix (e.g. "bme280.temp"); a controller resolves to its setpoint, not to a
// process value, which the legend says out loud so nobody expects otherwise.
function refGroups(snap: Snapshot | null) {
  return [
    { legend: 'Sensoren', refs: (snap?.sensors ?? []).map((s) => `sensor/${s.id}`) },
    { legend: 'Aktoren', refs: (snap?.actuators ?? []).map((a) => `actuator/${a.id}`) },
    { legend: 'Regler (Sollwert)', refs: (snap?.controllers ?? []).map((c) => `controller/${c.id}`) },
  ];
}

// Unit of the referenced channel, for the field suffixes. "" when unknown.
function unitOf(snap: Snapshot | null, ref: string): string {
  if (!snap) return '';
  const slash = ref.indexOf('/');
  if (slash < 0) return '';
  const role = ref.slice(0, slash);
  const id = ref.slice(slash + 1);
  if (role === 'sensor') return snap.sensors.find((s) => s.id === id)?.meta.unit ?? '';
  if (role === 'actuator') return snap.actuators.find((a) => a.id === id)?.meta.unit ?? '';
  return '';
}

export function AlarmEditorModal({ open, snap, initial, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [ref, setRef] = useState('');
  const [op, setOp] = useState<CondOp>('gt');
  const [severity, setSeverity] = useState<Severity>('warning');
  // Numeric fields stay strings so in-progress input like "7," survives a
  // re-render; parsed with German-comma tolerance on submit.
  const [value, setValue] = useState('');
  const [hyst, setHyst] = useState('0');
  const [forSec, setForSec] = useState('0');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setRef(initial?.cond.ref ?? '');
    setOp(initial?.cond.op ?? 'gt');
    setSeverity(initial?.severity ?? 'warning');
    setValue(initial ? String(initial.cond.value) : '');
    setHyst(initial ? String(initial.cond.hyst) : '0');
    setForSec(initial ? String(initial.forSec) : '0');
  }, [open, initial]);

  if (!open) return null;

  const num = (s: string) => parseFloat(s.replace(',', '.'));
  const valid = name.trim() !== '' && ref !== '' && Number.isFinite(num(value));
  const groups = refGroups(snap);
  const unit = unitOf(snap, ref);
  // A ref saved earlier whose item is gone won't be in the snapshot — keep it
  // selectable so editing the rule doesn't silently retarget it.
  const refMissing = ref !== '' && !groups.some((g) => g.refs.includes(ref));

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!valid) return;
    onSave({
      name: name.trim(),
      enabled: initial?.enabled ?? true,
      severity,
      forSec: Math.max(0, Math.round(num(forSec) || 0)),
      cond: {
        ref,
        op,
        value: num(value),
        hyst: Math.max(0, num(hyst) || 0),
      },
    });
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} class={`max-h-[90vh] w-full max-w-md ${dialogFrame}`}>
        <div class="min-h-0 overflow-y-auto p-6">
          <h2 class="mb-4 text-base font-medium text-fg">
            {initial ? 'Alarm bearbeiten' : 'Neuer Alarm'}
          </h2>

          <label class="mb-4 block">
            <span class="text-xs text-muted">Name</span>
            <input class={`mt-1 ${inp}`} value={name} autoFocus
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="z.B. Sudpfanne zu heiß" />
          </label>

          <label class="mb-4 block">
            <span class="text-xs text-muted">Überwachter Wert</span>
            <select class={`mt-1 ${inp}`} value={ref}
              onChange={(e) => setRef((e.target as HTMLSelectElement).value)}>
              <option value="">— bitte wählen —</option>
              {refMissing && <option value={ref}>{ref} (nicht vorhanden)</option>}
              {groups.map((g) => (
                <optgroup key={g.legend} label={g.legend}>
                  {g.refs.map((r) => <option key={r} value={r}>{r}</option>)}
                </optgroup>
              ))}
            </select>
          </label>

          <div class="mb-4 flex gap-3">
            <label class="block w-36">
              <span class="text-xs text-muted">Bedingung</span>
              <select class={`mt-1 ${inp}`} value={op}
                onChange={(e) => setOp((e.target as HTMLSelectElement).value as CondOp)}>
                <option value="gt">größer als</option>
                <option value="lt">kleiner als</option>
              </select>
            </label>
            <label class="block flex-1">
              <span class="text-xs text-muted">Grenzwert{unit && ` (${unit})`}</span>
              <input class={`mt-1 ${inp}`} value={value} inputMode="decimal"
                onInput={(e) => setValue((e.target as HTMLInputElement).value)}
                placeholder="78" />
            </label>
          </div>

          <div class="mb-4 flex gap-3">
            <label class="block flex-1">
              <span class="text-xs text-muted">Hysterese{unit && ` (${unit})`}</span>
              <input class={`mt-1 ${inp}`} value={hyst} inputMode="decimal"
                onInput={(e) => setHyst((e.target as HTMLInputElement).value)} />
            </label>
            <label class="block flex-1">
              <span class="text-xs text-muted">Mindestdauer (s)</span>
              <input class={`mt-1 ${inp}`} value={forSec} inputMode="numeric"
                onInput={(e) => setForSec((e.target as HTMLInputElement).value)} />
            </label>
          </div>
          <p class="mb-4 text-xs text-muted">
            Die Hysterese ist das Rückfallband: der Alarm endet erst
            {op === 'gt' ? ' unterhalb' : ' oberhalb'} von Grenzwert
            {op === 'gt' ? ' minus' : ' plus'} Hysterese. Zusammen mit der
            Mindestdauer verhindert sie Flattern bei rauschenden Sensoren.
          </p>

          <div class="mb-2">
            <span class="text-xs text-muted">Stufe</span>
            <div class="mt-1">
              <Segmented value={severity} options={SEVERITIES}
                onChange={(v) => setSeverity(v as Severity)} />
            </div>
          </div>
        </div>

        <div class={`${dialogFooter} justify-between`}>
          {onDelete
            ? <button type="button" class={linkDanger} onClick={onDelete}>Löschen</button>
            : <span />}
          <div class={dialogBtnRow}>
            <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
            <button type="submit" class={btnPrimary} disabled={!valid}>Speichern</button>
          </div>
        </div>
      </form>
    </div>
  );
}
