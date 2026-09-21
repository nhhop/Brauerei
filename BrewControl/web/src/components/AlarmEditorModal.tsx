import { useState, useEffect } from 'preact/hooks';
import type { Snapshot, AlarmConfig, CondOp, Severity } from '../types';
import { btnPrimary, btnSecondary, dialogFrame, dialogScrim, dialogSheet, dialogFooter, dialogBtnRow, inp, linkDanger } from '../ui';
import { Segmented } from './Segmented';
import { ConditionFields } from './ConditionFields';

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
    <div class={dialogScrim}>
      <form onSubmit={handleSubmit} class={`max-h-[90vh] w-full max-w-md ${dialogFrame} ${dialogSheet}`}>
        <div class="min-h-0 flex-1 overflow-y-auto p-6">
          <h2 class="mb-4 text-base font-medium text-fg">
            {initial ? 'Alarm bearbeiten' : 'Neuer Alarm'}
          </h2>

          <label class="mb-4 block">
            <span class="text-xs text-muted">Name</span>
            <input class={`mt-1 w-full ${inp}`} value={name} autoFocus
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="z.B. Sudpfanne zu heiß" />
          </label>

          <div class="mb-4">
            <ConditionFields snap={snap} refValue={ref} op={op} value={value} hyst={hyst}
              onChange={(p) => {
                if (p.refValue !== undefined) setRef(p.refValue);
                if (p.op !== undefined) setOp(p.op);
                if (p.value !== undefined) setValue(p.value);
                if (p.hyst !== undefined) setHyst(p.hyst);
              }} />
          </div>

          <label class="mb-4 block w-36">
            <span class="text-xs text-muted">Mindestdauer (s)</span>
            <input class={`mt-1 w-full ${inp}`} value={forSec} inputMode="numeric"
              onInput={(e) => setForSec((e.target as HTMLInputElement).value)} />
          </label>
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
