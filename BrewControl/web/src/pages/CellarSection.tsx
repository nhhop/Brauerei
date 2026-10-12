import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Beer, Pencil, Plus, Thermometer, Trash2 } from 'lucide-preact';
import {
  CONTAINER_KINDS, FERMENTER_KINDS, TEMPERINGS, checkContainer, checkFermenter, containerLabel, deleteContainer,
  deleteFermenter, fermenterSummary, listContainers, listFermenters, newContainer, newFermenter, saveContainer,
  saveFermenter, setTempering, type Check, type Container, type ContainerKind, type Fermenter, type FermenterKind,
  type Tempering,
} from '../cellar';
import { ConfirmModal } from '../components/ConfirmModal';
import type { Snapshot } from '../types';
import { btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../ui';
import { Field, NumInput, OptNum, Select, TextInput, itemText, type Opt } from './recipe/fields';

const num = (n: number) => String(n).replace('.', ',');

// Settings › Brauanlage › Gärkeller: the fermenters and the containers. Each is
// edited in a dialog and saved on its own; the lists read the device again after
// every change.
export function CellarSection({ snap }: { snap: Snapshot | null }) {
  const [fermenters, setFermenters] = useState<Fermenter[] | null>(null);
  const [containers, setContainers] = useState<Container[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingF, setEditingF] = useState<Fermenter | null>(null);
  const [editingC, setEditingC] = useState<Container | null>(null);
  const [deleting, setDeleting] = useState<{ label: string; remove: () => Promise<void> } | null>(null);

  const refresh = () => Promise.all([listFermenters().then(setFermenters), listContainers().then(setContainers)]);

  useEffect(() => { refresh().catch(() => setError('Gärkeller konnte nicht geladen werden.')); }, []);

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await target.remove();
      await refresh();
    } catch { setError(`„${target.label}“ konnte nicht gelöscht werden.`); }
  }

  return (
    <>
      {error && <p class="mt-8 text-sm text-critical">{error}</p>}

      <GroupHeader title="Gärplätze" onAdd={() => setEditingF(newFermenter())} />
      <List items={fermenters} empty={
        'Noch kein Gärplatz. Der Sud wählt den Gärplatz später aus dieser Liste, das Rezept rechnet mit seinem Trubverlust.'
      }>
        {fermenters?.map((f) => (
          <Row key={f.id} icon={Thermometer} title={f.name || 'Ohne Namen'} sub={fermenterSummary(f)}
            onEdit={() => setEditingF(f)}
            onDelete={() => setDeleting({ label: f.name, remove: () => deleteFermenter(f.id) })} />
        ))}
      </List>

      <GroupHeader title="Gebinde" onAdd={() => setEditingC(newContainer())} />
      <List items={containers} empty="Noch kein Gebinde. Die Abfüllung rechnet mit Größe und Abfüllverlust.">
        {containers?.map((c) => (
          <Row key={c.id} icon={Beer} title={containerLabel(c)} sub={containerSummary(c)}
            onEdit={() => setEditingC(c)}
            onDelete={() => setDeleting({ label: containerLabel(c), remove: () => deleteContainer(c.id) })} />
        ))}
      </List>

      {editingF && (
        <FermenterDialog fermenter={editingF} snap={snap} onClose={() => setEditingF(null)}
          onSave={async (f) => { await saveFermenter(f); await refresh(); setEditingF(null); }} />
      )}
      {editingC && (
        <ContainerDialog container={editingC} snap={snap} onClose={() => setEditingC(null)}
          onSave={async (c) => { await saveContainer(c); await refresh(); setEditingC(null); }} />
      )}
      <ConfirmModal open={deleting !== null} title="Löschen?" confirmLabel="Löschen" destructive
        onConfirm={confirmDelete} onCancel={() => setDeleting(null)}>
        „{deleting?.label}“ wird dauerhaft entfernt.
      </ConfirmModal>
    </>
  );
}

function containerSummary(c: Container): string {
  const parts = [`${c.count} Stück`];
  if (c.fillLossL) parts.push(`Abfüllverlust ${num(c.fillLossL)} l`);
  if (c.maxPressureBar) parts.push(`bis ${num(c.maxPressureBar)} bar`);
  return parts.join(' · ');
}

function GroupHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div class="mb-3 mt-8 flex items-center justify-between gap-3">
      <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <button type="button" onClick={onAdd} class={`${btnSecondary} inline-flex items-center gap-1`}>
        <Plus size={14} /> Neu
      </button>
    </div>
  );
}

function List({ items, empty, children }: { items: unknown[] | null; empty: string; children: ComponentChildren }) {
  if (items === null) return <p class="text-sm text-muted">Lädt …</p>;
  if (items.length === 0) return <p class="text-sm text-muted">{empty}</p>;
  return <div class="space-y-1">{children}</div>;
}

function Row({ icon: Icon, title, sub, onEdit, onDelete }: {
  icon: typeof Thermometer; title: string; sub: string; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div onClick={onEdit}
      class="flex cursor-pointer items-center gap-4 rounded-md border border-card-border bg-card px-4 py-3 shadow-elev-2 hover:bg-subtle-hover">
      <Icon size={20} class="shrink-0 text-muted" />
      <div class="min-w-0 flex-1">
        <div class="truncate font-medium">{title}</div>
        <div class="truncate text-xs text-muted">{sub}</div>
      </div>
      <div class="flex shrink-0 items-center gap-2 text-xs">
        <button type="button" title="Bearbeiten" onClick={(e) => { e.stopPropagation(); onEdit(); }}
          class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
          <Pencil size={14} />
        </button>
        <button type="button" title="Löschen" onClick={(e) => { e.stopPropagation(); onDelete(); }}
          class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// Dialog frame with the check below the fields: errors block "Speichern", hints do not.
function EditDialog({ title, check, onSave, onClose, children }: {
  title: string; check: Check; onSave: () => Promise<void>; onClose: () => void; children: ComponentChildren;
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  async function save() {
    setState('saving');
    try { await onSave(); } catch { setState('error'); }
  }
  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-lg ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="mb-4 text-base font-medium text-fg">{title}</h2>
          <div class="grid gap-3 sm:grid-cols-2">{children}</div>
          {check.errors.map((t) => <p key={t} class="mt-2 text-xs text-critical">{t}</p>)}
          {check.hints.map((t) => <p key={t} class="mt-2 text-xs text-caution">{t}</p>)}
          {state === 'error' && <p class="mt-2 text-sm text-critical">Speichern fehlgeschlagen.</p>}
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
          <button type="button" class={btnPrimary} disabled={check.errors.length > 0 || state === 'saving'} onClick={save}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

const optionsOf = (items: { id: string; label?: string }[] | undefined): Opt[] =>
  (items ?? []).map((i) => ({ value: i.id, text: itemText(i) }));

function FermenterDialog({ fermenter, snap, onSave, onClose }: {
  fermenter: Fermenter; snap: Snapshot | null; onSave: (f: Fermenter) => Promise<void>; onClose: () => void;
}) {
  const [f, setF] = useState(fermenter);
  const set = (patch: Partial<Fermenter>) => setF({ ...f, ...patch });
  const connected = f.tempering !== 'none' && !f.manual;
  return (
    <EditDialog title="Gärplatz" check={checkFermenter(f, snap)} onSave={() => onSave(f)} onClose={onClose}>
      <Field label="Name">
        <TextInput value={f.name} placeholder="z.B. Gärschrank" onChange={(name) => set({ name })} />
      </Field>
      <Field label="Bauart">
        <select class={`${inp} w-full`} value={f.kind} onChange={(e) => set({ kind: e.currentTarget.value as FermenterKind })}>
          {FERMENTER_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </Field>
      <Field label="Volumen (l)"><NumInput value={f.volumeL} class="w-full" onChange={(volumeL) => set({ volumeL })} /></Field>
      <Field label="Trubverlust (l)">
        <OptNum value={f.trubLossL} placeholder="wie im Rezept" class="w-full" onChange={(trubLossL) => set({ trubLossL })} />
      </Field>
      <Field label="Druckfest bis (bar)">
        <OptNum value={f.maxPressureBar} placeholder="nicht druckfest" class="w-full"
          onChange={(maxPressureBar) => set({ maxPressureBar })} />
      </Field>
      <Field label="Temperierung">
        <select class={`${inp} w-full`} value={f.tempering}
          onChange={(e) => setF(setTempering(f, e.currentTarget.value as Tempering))}>
          {TEMPERINGS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Field>
      {f.tempering !== 'none' && (
        <Field label="Steuerung">
          <select class={`${inp} w-full`} value={f.manual ? 'manual' : 'connected'}
            onChange={(e) => set({ manual: e.currentTarget.value === 'manual' })}>
            <option value="manual">von Hand</option>
            <option value="connected">angeschlossen</option>
          </select>
        </Field>
      )}
      {connected && (
        <>
          <Field label="Regler">
            <Select value={f.controller ?? ''} groups={[{ opts: optionsOf(snap?.controllers) }]}
              onChange={(v) => set({ controller: v || undefined })} />
          </Field>
          <Field label="Aktor">
            <Select value={f.actuator ?? ''} groups={[{ opts: optionsOf(snap?.actuators) }]}
              onChange={(v) => set({ actuator: v || undefined })} />
          </Field>
        </>
      )}
      <Field label="Temperaturfühler">
        <Select value={f.sensor ?? ''} groups={[{ opts: optionsOf(snap?.sensors) }]}
          onChange={(v) => set({ sensor: v || undefined })} />
      </Field>
      {connected && (
        <p class="text-xs text-muted sm:col-span-2">
          Liegt das Gerät auf einem anderen Board, lege dort einen Remote-Sensor und einen Remote-Aktor an. Der Regler läuft dann
          auf diesem Board; ein Regler, der nur auf dem anderen Board läuft, lässt sich nicht verknüpfen.
        </p>
      )}
    </EditDialog>
  );
}

function ContainerDialog({ container, snap, onSave, onClose }: {
  container: Container; snap: Snapshot | null; onSave: (c: Container) => Promise<void>; onClose: () => void;
}) {
  const [c, setC] = useState(container);
  const set = (patch: Partial<Container>) => setC({ ...c, ...patch });
  return (
    <EditDialog title="Gebinde" check={checkContainer(c, snap)} onSave={() => onSave(c)} onClose={onClose}>
      <Field label="Art">
        <select class={`${inp} w-full`} value={c.kind} onChange={(e) => set({ kind: e.currentTarget.value as ContainerKind })}>
          {CONTAINER_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </Field>
      <Field label="Name (optional)">
        <TextInput value={c.name ?? ''} placeholder={containerLabel({ ...c, name: undefined })}
          onChange={(name) => set({ name: name || undefined })} />
      </Field>
      <Field label="Größe (l)"><NumInput value={c.sizeL} class="w-full" onChange={(sizeL) => set({ sizeL })} /></Field>
      <Field label="Anzahl"><NumInput value={c.count} class="w-full" onChange={(count) => set({ count })} /></Field>
      <Field label="Abfüllverlust (l)">
        <OptNum value={c.fillLossL} placeholder="0" class="w-full" onChange={(fillLossL) => set({ fillLossL })} />
      </Field>
      <Field label="Druckfest bis (bar)">
        <OptNum value={c.maxPressureBar} placeholder="nicht angegeben" class="w-full"
          onChange={(maxPressureBar) => set({ maxPressureBar })} />
      </Field>
    </EditDialog>
  );
}
