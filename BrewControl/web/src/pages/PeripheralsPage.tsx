import { useEffect, useState } from 'preact/hooks';
import type { BusesInfo, DeviceInfo, DeviceTypeInfo, PeripheralsInfo } from '../types';
import {
  createPeripheral, deletePeripheral, getBuses, getPeripherals, scanBus, updatePeripheral,
} from '../api';
import { BUS_TYPE_LABEL, busTitle } from '../buses';
import { DEVICE_ADDRESS_HINT, DEVICE_TYPE_HINT, DEVICE_TYPE_LABEL, hexAddr } from '../peripherals';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { Breadcrumb } from '../components/Breadcrumb';
import { ConfirmModal } from '../components/ConfirmModal';
import { SettingsGroup } from '../components/SettingsCard';
import { Fab } from '../components/Fab';
import { Spinner } from '../components/Spinner';
import {
  btnPrimary, btnSecondary, badge, badgeCritical, badgeSuccess, dialogFrame, dialogFooter, dialogBtnRow,
  inp as inpBase,
} from '../ui';
import { Microchip, Pencil, Plus, Search, Trash2 } from 'lucide-preact';

// Peripheral devices (DeviceConfig.h in the firmware): chips on a bus that offer
// items a capability — the MCP4728 with four DAC channels, the PCF8575 with
// sixteen digital pins. An AnalogOutput, DigitalOutput or DigitalInput picks a
// channel in its form; the device itself lives only here.

const inp = `${inpBase} w-full`;
const lbl = 'block text-xs text-muted mb-1';

interface EditorState {
  device: DeviceInfo | null; // null = new device
  type: string;
  bus: string;
  address: number;
  label: string;
}

// Result of "Prüfen": does the device answer on its bus?
type Check = 'ok' | 'none' | { error: string };

export function PeripheralsPage(_: { path?: string }) {
  const [info, setInfo] = useState<PeripheralsInfo | null>(null);
  const [buses, setBuses] = useState<BusesInfo | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, Check>>({});

  function reload() {
    getPeripherals().then(setInfo).catch((e) => setLoadErr(String(e)));
    getBuses().then(setBuses).catch(() => setBuses(null));
  }
  useEffect(reload, []);

  const typeInfo = (t: string) => info?.types.find((x) => x.type === t);

  // A new device of type t, on the first bus that fits and a free address.
  function newDevice(t: DeviceTypeInfo): EditorState {
    const bus = buses?.buses.find((b) => b.type === t.bus)?.id ?? '';
    return { device: null, type: t.type, bus, address: freeAddress(t, bus), label: '' };
  }

  function openNew() {
    const t = info?.types[0];
    if (t) setEditor(newDevice(t));
  }

  // The first address of the type that neither another device on that bus nor
  // the board itself (reserved addresses of a fixed bus) occupies.
  function freeAddress(t: DeviceTypeInfo, bus: string): number {
    for (let a = t.addrDefault; a <= t.addrLast; a++) {
      if (!info?.devices.some((d) => d.bus === bus && d.address === a) && !reservedNote(buses, bus, a)) return a;
    }
    return t.addrDefault;
  }

  function openEdit(d: DeviceInfo) {
    setEditor({ device: d, type: d.type, bus: d.bus, address: d.address, label: d.label ?? '' });
  }

  // The firmware has no status endpoint: scan the bus and look for the address.
  async function runCheck(d: DeviceInfo) {
    setChecking(d.id);
    let c: Check;
    try {
      const r = await scanBus(d.bus);
      c = r.devices.some((x) => x.address === hexAddr(d.address)) ? 'ok' : 'none';
    } catch (e) {
      c = { error: String(e).replace(/^Error: /, '') };
    }
    setChecks((s) => ({ ...s, [d.id]: c }));
    setChecking(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteErr(null);
    try {
      await deletePeripheral(deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } catch (e) {
      setDeleteErr(String(e).replace(/^Error: /, ''));
    } finally {
      setDeleting(false);
    }
  }

  const busName = (id: string) => {
    const b = buses?.buses.find((x) => x.id === id);
    return b ? busTitle(b) : id;
  };

  return (
    <PageShell>
      <header class="mb-6 flex items-center gap-3">
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Peripheriegeräte' }]} />
        <span class="flex-1" />
        <button type="button" class={`${btnPrimary} hidden md:inline-flex`} disabled={!info} onClick={openNew}>
          + Neues Gerät
        </button>
      </header>

      <Fab icon={Plus} label="Neues Gerät" onClick={openNew} />

      <p class="mb-6 text-sm text-muted">
        Peripheriegeräte sind Bausteine an einem Bus, die zusätzliche Ein- und Ausgänge
        bereitstellen — etwa ein DAC-Baustein für echte Analogspannung auf Boards ohne eigenen
        DAC oder ein Port-Expander für weitere Schaltausgänge und Eingänge. Ein Item wählt dann
        einen Kanal des Geräts statt eines GPIO.
      </p>

      {loadErr ? (
        <p class="text-sm text-critical">{loadErr}</p>
      ) : !info ? (
        <SkeletonList count={2} />
      ) : (
        <SettingsGroup title="Geräte">
          {info.devices.length === 0 && (
            <p class="px-1 text-sm text-faint">
              Noch keins angelegt. {info.types.map((t) => `${DEVICE_TYPE_LABEL[t.type] ?? t.type}: ${DEVICE_TYPE_HINT[t.type] ?? ''}`).join(' ')}
            </p>
          )}
          {info.devices.map((d) => (
            <DeviceCard key={d.id} device={d} busName={busName(d.bus)}
              checking={checking === d.id} check={checks[d.id]}
              onCheck={() => void runCheck(d)}
              onEdit={() => openEdit(d)}
              onDelete={() => { setDeleteErr(null); setDeleteTarget(d); }} />
          ))}
        </SettingsGroup>
      )}

      {editor && info && (
        <DeviceEditor state={editor} info={info} buses={buses}
          typeInfo={typeInfo(editor.type)}
          onChange={setEditor}
          onTypeChange={(t) => { const ti = typeInfo(t); if (ti) setEditor({ ...newDevice(ti), label: editor.label }); }}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); reload(); }} />
      )}

      <ConfirmModal open={!!deleteTarget} title="Gerät löschen?" destructive
        pending={deleting} confirmLabel="Löschen"
        onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)}>
        <p class="text-sm text-muted">
          „{deleteTarget?.label || deleteTarget?.id}" wird entfernt, seine Adresse am Bus wird wieder frei.
        </p>
        {deleteErr && <p class="mt-2 text-sm text-critical">{deleteErr}</p>}
      </ConfirmModal>
    </PageShell>
  );
}

function DeviceCard({ device, busName, checking, check, onCheck, onEdit, onDelete }: {
  device: DeviceInfo;
  busName: string;
  checking: boolean;
  check?: Check;
  onCheck: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const users = device.channels.flatMap((c) => c.users);
  const inUse = users.length > 0;
  const iconBtn = 'rounded border border-border px-2 py-1 transition-colors hover:bg-fg/10 disabled:opacity-40';

  return (
    <div class="rounded-md border border-card-border bg-card p-4 shadow-elev-2">
      <div class="flex items-start gap-3">
        <Microchip size={18} class="mt-0.5 shrink-0 text-muted" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="truncate text-sm font-medium text-fg">{device.label || device.id}</span>
            {device.label && <span class="font-mono text-xs text-faint">{device.id}</span>}
            <span class={`${badge} bg-fg/10 text-muted`}>{DEVICE_TYPE_LABEL[device.type] ?? device.type}</span>
            {check === 'ok' && <span class={badgeSuccess}>antwortet</span>}
            {check === 'none' && <span class={badgeCritical}>keine Antwort</span>}
          </div>
          <p class="mt-0.5 text-xs text-muted">
            {busName} · Adresse <span class="font-mono">{hexAddr(device.address)}</span>
          </p>
          <ul class="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
            {device.channels.map((c) => (
              <li key={c.index} class="flex gap-2">
                <span class="w-16 shrink-0 text-faint">{device.cap === 'dac' ? `Kanal ${c.name}` : c.name}</span>
                <span class={c.users.length ? 'truncate text-fg' : 'text-faint'}>
                  {c.users.length ? c.users.join(', ') : 'frei'}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div class="flex shrink-0 items-center gap-2 text-xs">
          <button type="button" title="Prüfen" onClick={onCheck} disabled={checking}
            class={`${iconBtn} text-muted`}>
            {checking ? <Spinner size={14} /> : <Search size={14} />}
          </button>
          <button type="button" title="Bearbeiten" onClick={onEdit} class={`${iconBtn} text-muted`}>
            <Pencil size={14} />
          </button>
          <button type="button" title={inUse ? 'Wird noch genutzt' : 'Löschen'} onClick={onDelete}
            disabled={inUse} class={`${iconBtn} text-critical`}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {check === 'none' && (
        <p class="mt-3 text-xs text-caution">
          Am Bus antwortet nichts auf {hexAddr(device.address)} — Verkabelung, Versorgung und Adresse prüfen.
        </p>
      )}
      {typeof check === 'object' && <p class="mt-3 text-xs text-critical">{check.error}</p>}
    </div>
  );
}

// Note of an address the board itself uses on a fixed bus, or undefined.
function reservedNote(buses: BusesInfo | null, bus: string, a: number): string | undefined {
  return buses?.buses.find((b) => b.id === bus)?.reserved?.find((r) => r.address === hexAddr(a))?.note;
}

function DeviceEditor({ state, info, buses, typeInfo, onChange, onTypeChange, onClose, onSaved }: {
  state: EditorState;
  info: PeripheralsInfo;
  buses: BusesInfo | null;
  typeInfo?: DeviceTypeInfo;
  onChange: (s: EditorState) => void;
  onTypeChange: (type: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isNew = state.device === null;
  const users = state.device?.channels.flatMap((c) => c.users) ?? [];
  const locked = users.length > 0;
  const busType = typeInfo?.bus ?? 'i2c';
  const busList = buses?.buses.filter((b) => b.type === busType) ?? [];
  const addresses: number[] = [];
  if (typeInfo) for (let a = typeInfo.addrFirst; a <= typeInfo.addrLast; a++) addresses.push(a);
  // Another device already on this bus and address (the firmware also refuses
  // the addresses of sensors there — that shows up as its error).
  const takenBy = (a: number) => info.devices.find((d) =>
    d.id !== state.device?.id && d.bus === state.bus && d.address === a);

  async function save(e: Event) {
    e.preventDefault();
    if (!state.bus) { setErr('Kein Bus gewählt'); return; }
    const def: Record<string, unknown> = { type: state.type, bus: state.bus, address: state.address };
    if (state.label.trim()) def.label = state.label.trim();
    setPending(true); setErr(null);
    try {
      if (isNew) await createPeripheral(def);
      else await updatePeripheral(state.device!.id, def);
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
          <h2 class="text-base font-medium text-fg">{isNew ? 'Neues Gerät' : 'Gerät bearbeiten'}</h2>

          {isNew ? (
            <div>
              <label class={lbl}>Typ</label>
              <select value={state.type} class={inp}
                onChange={(e) => onTypeChange((e.target as HTMLSelectElement).value)}>
                {info.types.map((t) => (
                  <option key={t.type} value={t.type}>{DEVICE_TYPE_LABEL[t.type] ?? t.type}</option>
                ))}
              </select>
              {DEVICE_TYPE_HINT[state.type] && <p class="mt-1 text-xs text-faint">{DEVICE_TYPE_HINT[state.type]}</p>}
            </div>
          ) : (
            <p class="text-xs text-muted">
              {DEVICE_TYPE_LABEL[state.type] ?? state.type} · <span class="font-mono">{state.device!.id}</span>
            </p>
          )}

          <div>
            <label class={lbl}>Name (optional)</label>
            <input type="text" value={state.label} maxLength={32} class={inp} placeholder="z.B. DAC Kessel"
              onInput={(e) => onChange({ ...state, label: (e.target as HTMLInputElement).value })} />
          </div>

          <div>
            <label class={lbl}>{BUS_TYPE_LABEL[busType]}-Bus</label>
            {busList.length === 0 ? (
              <p class="text-xs text-caution">
                Noch kein {BUS_TYPE_LABEL[busType]}-Bus angelegt — unter{' '}
                <a href="/settings/buses" class="underline">Einstellungen → Bus-Schnittstellen</a> anlegen.
              </p>
            ) : (
              <select value={state.bus} class={inp} disabled={locked}
                onChange={(e) => onChange({ ...state, bus: (e.target as HTMLSelectElement).value })}>
                {!busList.some((b) => b.id === state.bus) && <option value="">— wählen —</option>}
                {busList.map((b) => <option key={b.id} value={b.id}>{busTitle(b)}</option>)}
              </select>
            )}
          </div>

          <div>
            <label class={lbl}>Adresse</label>
            <div class="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
              {addresses.map((a) => {
                const other = takenBy(a);
                const board = reservedNote(buses, state.bus, a);
                const active = state.address === a;
                return (
                  <button key={a} type="button" disabled={locked || !!other || !!board}
                    title={other ? `belegt von ${other.label || other.id}` : board ? `vom Board belegt (${board})` : undefined}
                    onClick={() => onChange({ ...state, address: a })}
                    class={`rounded-md px-2 py-1.5 font-mono text-xs transition-colors disabled:cursor-not-allowed ${
                      active ? 'bg-accent text-accent-fg' : 'bg-fg/5 text-muted hover:bg-fg/10'
                    } ${other || board || (locked && !active) ? 'opacity-40' : ''}`}>
                    {hexAddr(a)}
                  </button>
                );
              })}
            </div>
            <p class="mt-1 text-xs text-faint">
              Ab Werk {typeInfo ? hexAddr(typeInfo.addrDefault) : ''}. {DEVICE_ADDRESS_HINT[state.type] ?? ''}
            </p>
          </div>

          {locked && (
            <p class="text-xs text-caution">
              Genutzt von {users.join(', ')} — Bus und Adresse lassen sich erst ändern, wenn
              kein Item mehr daran hängt. Der Name geht jederzeit.
            </p>
          )}
          {err && <p class="text-sm text-critical">{err}</p>}
        </div>
        <div class={dialogFooter}>
          <div class={`w-full ${dialogBtnRow}`}>
            <button type="button" class={btnSecondary} disabled={pending} onClick={onClose}>Abbrechen</button>
            <button type="submit" class={btnPrimary} disabled={pending || busList.length === 0}>
              {pending ? <><Spinner size={14} class="mr-1.5 -mt-0.5" />Speichern</> : 'Speichern'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
