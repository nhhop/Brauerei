import { useEffect, useState } from 'preact/hooks';
import type { BusInfo, BusesInfo, BusType, PinsInfo, ScannedDevice } from '../types';
import { createBus, deleteBus, getBuses, getPins, scanBus, updateBus } from '../api';
import { BUS_TYPE_LABEL, busPinsText, pinLabel } from '../buses';
import { riskyPins } from '../pins';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { Breadcrumb } from '../components/Breadcrumb';
import { ConfirmModal } from '../components/ConfirmModal';
import { SettingsGroup } from '../components/SettingsCard';
import { PinHint } from '../components/PinHint';
import { Fab } from '../components/Fab';
import { Spinner } from '../components/Spinner';
import {
  btnPrimary, btnSecondary, badge, badgeAccent, dialogFrame, dialogFooter, dialogBtnRow, inp as inpBase,
} from '../ui';
import { Cable, Pencil, Plus, Search, Trash2 } from 'lucide-preact';

// Buses (BusConfig.h in the firmware): the lines several devices share. Items
// on a bus pick it in their form instead of repeating its pins. Fixed buses
// are wired by the board and shown read-only.

const inp = `${inpBase} w-full font-mono`;
const lbl = 'block text-xs text-muted mb-1';

const TYPE_HINT: Record<BusType, string> = {
  onewire: 'DS18B20-Temperaturfühler; mehrere teilen sich eine Leitung (4,7 kΩ Pull-up).',
  spi: 'MAX31865 mit eigenen SPI-Leitungen (Software-SPI); jeder Fühler hat zusätzlich seinen CS-Pin.',
  i2c: 'BME280, GY-521; Geräte werden über ihre Adresse unterschieden.',
};

// Which way each line is driven, for the pin hints (mirrors outputMask in BusConfig.h).
const OUTPUT_PINS = new Set(['pin', 'clk', 'mosi', 'sda', 'scl']);

interface EditorState {
  bus: BusInfo | null; // null = new bus
  type: BusType;
  label: string;
  pins: Record<string, string>;
}

export function BusesPage(_: { path?: string }) {
  const [info, setInfo] = useState<BusesInfo | null>(null);
  const [pins, setPins] = useState<PinsInfo | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BusInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState<string | null>(null);
  const [scans, setScans] = useState<Record<string, ScannedDevice[] | string>>({});

  function reload() {
    getBuses().then(setInfo).catch((e) => setLoadErr(String(e)));
    getPins().then(setPins).catch(() => setPins(null));
  }
  useEffect(reload, []);

  const typeInfo = (t: BusType) => info?.types.find((x) => x.type === t);
  const countOf = (t: BusType) => info?.buses.filter((b) => b.type === t).length ?? 0;
  const full = (t: BusType) => {
    const max = typeInfo(t)?.max;
    return max !== undefined && countOf(t) >= max;
  };

  function openNew() {
    const first = info?.types.find((t) => !full(t.type))?.type ?? 'onewire';
    setEditor({ bus: null, type: first, label: '', pins: {} });
  }

  function openEdit(b: BusInfo) {
    const values: Record<string, string> = {};
    for (const k of typeInfo(b.type)?.pins ?? []) {
      values[k] = String((b as unknown as Record<string, number>)[k] ?? '');
    }
    setEditor({ bus: b, type: b.type, label: b.label ?? '', pins: values });
  }

  async function runScan(b: BusInfo) {
    setScanning(b.id);
    try {
      const r = await scanBus(b.id);
      setScans((s) => ({ ...s, [b.id]: r.devices }));
    } catch (e) {
      setScans((s) => ({ ...s, [b.id]: String(e).replace(/^Error: /, '') }));
    }
    setScanning(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteErr(null);
    try {
      await deleteBus(deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } catch (e) {
      setDeleteErr(String(e).replace(/^Error: /, ''));
    } finally {
      setDeleting(false);
    }
  }

  const types = info?.types ?? [];

  return (
    <PageShell>
      <header class="mb-6 flex items-center gap-3">
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Bus-Schnittstellen' }]} />
        <span class="flex-1" />
        <button type="button" class={`${btnPrimary} hidden md:inline-flex`} disabled={!info} onClick={openNew}>
          + Neuer Bus
        </button>
      </header>

      <Fab icon={Plus} label="Neuer Bus" onClick={openNew} />

      <p class="mb-6 text-sm text-muted">
        Busse sind Leitungen, die sich mehrere Geräte teilen. Lege hier fest, an welchen
        Pins ein Bus liegt — beim Anlegen eines Sensors wählst du dann nur noch den Bus.
        Die Pins eines Busses lassen sich nur ändern, solange kein Gerät daran hängt.
      </p>

      {loadErr ? (
        <p class="text-sm text-critical">{loadErr}</p>
      ) : !info ? (
        <SkeletonList count={3} />
      ) : (
        <div class="space-y-6">
          {types.map((t) => {
            const list = info.buses.filter((b) => b.type === t.type);
            return (
              <SettingsGroup key={t.type} title={`${BUS_TYPE_LABEL[t.type]}${t.max ? ` · max. ${t.max}` : ''}`}>
                {list.length === 0 && (
                  <p class="px-1 text-sm text-faint">Keiner angelegt. {TYPE_HINT[t.type]}</p>
                )}
                {list.map((b) => (
                  <BusCard key={b.id} bus={b} scanning={scanning === b.id} scan={scans[b.id]}
                    onScan={b.type === 'spi' ? undefined : () => void runScan(b)}
                    onEdit={b.fixed ? undefined : () => openEdit(b)}
                    onDelete={b.fixed ? undefined : () => { setDeleteErr(null); setDeleteTarget(b); }} />
                ))}
              </SettingsGroup>
            );
          })}
        </div>
      )}

      {editor && info && (
        <BusEditor state={editor} info={info} pins={pins} full={full}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); reload(); }} />
      )}

      <ConfirmModal open={!!deleteTarget} title="Bus löschen?" destructive
        pending={deleting} confirmLabel="Löschen"
        onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)}>
        <p class="text-sm text-muted">
          „{deleteTarget?.label || deleteTarget?.id}" ({deleteTarget && busPinsText(deleteTarget)}) wird entfernt,
          die Pins werden wieder frei.
        </p>
        {deleteErr && <p class="mt-2 text-sm text-critical">{deleteErr}</p>}
      </ConfirmModal>
    </PageShell>
  );
}

function BusCard({ bus, scanning, scan, onScan, onEdit, onDelete }: {
  bus: BusInfo;
  scanning: boolean;
  scan?: ScannedDevice[] | string;
  onScan?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const inUse = bus.users.length > 0;
  const reservedNote = (addr: string) => bus.reserved?.find((r) => r.address === addr)?.note;
  const iconBtn = 'rounded border border-border px-2 py-1 transition-colors hover:bg-fg/10 disabled:opacity-40';

  return (
    <div class="rounded-md border border-card-border bg-card p-4 shadow-elev-2">
      <div class="flex items-start gap-3">
        <Cable size={18} class="mt-0.5 shrink-0 text-muted" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="truncate text-sm font-medium text-fg">{bus.label || bus.id}</span>
            {bus.label && <span class="font-mono text-xs text-faint">{bus.id}</span>}
            {bus.fixed && <span class={badgeAccent}>fest verdrahtet</span>}
            {bus.type === 'i2c' && bus.port !== undefined && (
              <span class={`${badge} bg-fg/10 text-muted`}>{bus.port === 1 ? 'Wire1' : 'Wire'}</span>
            )}
          </div>
          <p class="mt-0.5 font-mono text-xs text-muted">{busPinsText(bus)}</p>
          {bus.note && <p class="mt-1 text-xs text-muted">{bus.note}</p>}
          {bus.reserved && bus.reserved.length > 0 && (
            <p class="mt-1 text-xs text-faint">
              Belegte Adressen: {bus.reserved.map((r) => `${r.address} ${r.note}`).join(' · ')}
            </p>
          )}
          <p class="mt-1 text-xs text-faint">
            {inUse ? `Genutzt von ${bus.users.join(', ')}` : 'Noch kein Gerät an diesem Bus'}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2 text-xs">
          {onScan && (
            <button type="button" title="Scannen" onClick={onScan} disabled={scanning}
              class={`${iconBtn} text-muted`}>
              {scanning ? <Spinner size={14} /> : <Search size={14} />}
            </button>
          )}
          {onEdit && (
            <button type="button" title="Bearbeiten" onClick={onEdit} class={`${iconBtn} text-muted`}>
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button type="button" title={inUse ? 'Wird noch genutzt' : 'Löschen'} onClick={onDelete}
              disabled={inUse} class={`${iconBtn} text-critical`}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {typeof scan === 'string' && <p class="mt-3 text-xs text-critical">{scan}</p>}
      {Array.isArray(scan) && (
        <div class="mt-3 border-t border-border pt-2 text-xs">
          {scan.length === 0 ? (
            <p class="text-caution">Kein Gerät gefunden — Verkabelung und Pull-ups prüfen.</p>
          ) : (
            <ul class="space-y-0.5">
              {scan.map((d) => (
                <li key={d.address} class="font-mono text-fg">
                  {bus.type === 'onewire' ? d.address.match(/.{2}/g)!.join(':') : d.address}
                  {reservedNote(d.address) && (
                    <span class="ml-2 font-sans text-faint">{reservedNote(d.address)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function BusEditor({ state, info, pins, full, onChange, onClose, onSaved }: {
  state: EditorState;
  info: BusesInfo;
  pins: PinsInfo | null;
  full: (t: BusType) => boolean;
  onChange: (s: EditorState) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [riskyAck, setRiskyAck] = useState('');
  const [riskyWarn, setRiskyWarn] = useState<string[]>([]);

  const isNew = state.bus === null;
  const pinsLocked = !isNew && state.bus!.users.length > 0;
  const keys = info.types.find((t) => t.type === state.type)?.pins ?? [];
  const selfId = state.bus?.id;

  const setPin = (k: string, v: string) => onChange({ ...state, pins: { ...state.pins, [k]: v } });
  const picked = (except: string) =>
    keys.filter((k) => k !== except).map((k) => parseInt(state.pins[k] ?? '', 10)).filter((n) => !isNaN(n));

  async function save(e: Event) {
    e.preventDefault();
    const def: Record<string, unknown> = { type: state.type };
    for (const k of keys) {
      const n = parseInt(state.pins[k] ?? '', 10);
      if (isNaN(n) || n < 0) { setErr(`${pinLabel(k)}: GPIO fehlt`); return; }
      def[k] = n;
    }
    if (state.label.trim()) def.label = state.label.trim();
    const risky = riskyPins(pins, def);
    setRiskyWarn(risky);
    if (risky.length && riskyAck !== risky.join('|')) return;

    setPending(true); setErr(null);
    try {
      if (isNew) await createBus(def);
      else await updateBus(state.bus!.id, def);
      onSaved();
    } catch (e2) {
      setErr(String(e2).replace(/^Error: /, ''));
    } finally {
      setPending(false);
    }
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!pending) onClose(); }}>
      <form class={`w-full max-w-md ${dialogFrame}`} onClick={(e) => e.stopPropagation()} onSubmit={(e) => void save(e)}>
        <div class="space-y-4 p-5">
          <h2 class="text-base font-medium text-fg">{isNew ? 'Neuer Bus' : 'Bus bearbeiten'}</h2>

          {isNew ? (
            <div>
              <label class={lbl}>Typ</label>
              <select value={state.type} class={inp}
                onChange={(e) => onChange({ ...state, type: (e.target as HTMLSelectElement).value as BusType, pins: {} })}>
                {info.types.map((t) => (
                  <option key={t.type} value={t.type} disabled={full(t.type)}>
                    {BUS_TYPE_LABEL[t.type]}{full(t.type) ? ` (alle ${t.max} belegt)` : ''}
                  </option>
                ))}
              </select>
              <p class="mt-1 text-xs text-faint">{TYPE_HINT[state.type]}</p>
            </div>
          ) : (
            <p class="text-xs text-muted">{BUS_TYPE_LABEL[state.type]} · <span class="font-mono">{state.bus!.id}</span></p>
          )}

          <div>
            <label class={lbl}>Name (optional)</label>
            <input type="text" value={state.label} maxLength={32} class={inp}
              placeholder={state.type === 'i2c' ? 'z.B. Sensor-Stecker' : 'z.B. Kessel-Fühler'}
              onInput={(e) => onChange({ ...state, label: (e.target as HTMLInputElement).value })} />
          </div>

          <div class={`grid gap-3 ${keys.length === 3 ? 'grid-cols-3' : keys.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {keys.map((k) => (
              <div key={k}>
                <label class={lbl}>{pinLabel(k)} (GPIO)</label>
                <input type="number" value={state.pins[k] ?? ''} disabled={pinsLocked} class={inp}
                  onInput={(e) => setPin(k, (e.target as HTMLInputElement).value)} required />
                {!pinsLocked && (
                  <PinHint pins={pins} value={state.pins[k] ?? ''} selfId={selfId}
                    output={OUTPUT_PINS.has(k)} suggest exclude={picked(k)}
                    onPick={(g) => setPin(k, String(g))} />
                )}
              </div>
            ))}
          </div>
          {pinsLocked && (
            <p class="text-xs text-caution">
              An diesem Bus hängen {state.bus!.users.join(', ')} — die Pins lassen sich erst
              ändern, wenn kein Gerät mehr daran hängt. Der Name geht jederzeit.
            </p>
          )}

          {riskyWarn.length > 0 && (
            <label class="flex items-start gap-2 rounded-md border border-caution/40 bg-caution/10 p-2 text-xs text-caution">
              <input type="checkbox" checked={riskyAck === riskyWarn.join('|')}
                onChange={(e) => setRiskyAck((e.target as HTMLInputElement).checked ? riskyWarn.join('|') : '')} />
              <span>
                Trotzdem verwenden: {riskyWarn.join('; ')}
              </span>
            </label>
          )}
          {err && <p class="text-sm text-critical">{err}</p>}
        </div>
        <div class={dialogFooter}>
          <div class={`w-full ${dialogBtnRow}`}>
            <button type="button" class={btnSecondary} disabled={pending} onClick={onClose}>Abbrechen</button>
            <button type="submit" class={btnPrimary} disabled={pending}>
              {pending ? <><Spinner size={14} class="mr-1.5 -mt-0.5" />Speichern</> : 'Speichern'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
