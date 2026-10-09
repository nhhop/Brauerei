import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { route } from 'preact-router';
import { Check, Plus, Trash2 } from 'lucide-preact';
import {
  CHILLER_TYPES, DEFAULT_GRAIN_ABSORPTION, DEVICE_KINDS, DRIVES, MEASUREMENTS, STEPS, TEMPLATES, VESSEL_PRESETS,
  addDevice, anchor, assignStep, brewhouseSummary, checkBrewhouse, decoctionVesselOf, duplicateBrewhouse, heatingOf, heatingText, listBrewhouses,
  newDevice, removeDevice, removeVessel, saveBrewhouse, stepLabel, stepsOf, vesselLabel, vesselPreset,
  type Brewhouse, type Device, type DeviceKind, type Issue, type StepConfig, type StepKey, type Transfer, type Vessel,
} from '../brewhouse';
import { uid } from '../recipes';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageShell } from '../components/PageShell';
import { Segmented } from '../components/Segmented';
import { TabBtn } from '../components/TabBtn';
import type { Snapshot } from '../types';
import { badgeAccent, badgeCaution, badgeCritical, btnPrimary, inp } from '../ui';
import { BrewhouseSchema } from './BrewhouseSchema';
import { Card, Field, NumInput, OptNum } from './recipe/fields';

const LIST_URL = '/settings/anlage';
const LAUTER_METHODS = ['Senkboden', 'Schlitzrohr', 'Malzrohr', 'Malzkorb', 'Sack', 'Ablassen in Zwischenbehälter'];

// Where a new device of a kind most likely sits: the vessel of this step.
const HOME_STEP: Partial<Record<DeviceKind, StepKey>> = {
  heater: 'mash', agitator: 'mash', condenser: 'boil', chiller: 'chill', coil: 'strike', valve: 'strike',
};

type Props = { path?: string; id?: string; vorlage?: string; von?: string; snap: Snapshot | null };

// Brewhouse editor. /settings/anlage/sudhaus/neu?vorlage=<key> starts from a
// template, ?von=<id> from a copy; both are drafts until "Speichern".
export function BrewhouseEditPage({ id, vorlage, von, snap }: Props) {
  const [saved, setSaved] = useState<Brewhouse | null>(null);
  const [draft, setDraft] = useState<Brewhouse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'missing' | 'error'>('loading');
  const [saveError, setSaveError] = useState(false);
  const [tab, setTab] = useState<TabId>('overview');
  const [scrollTo, setScrollTo] = useState<string | null>(null);

  // A jump switches the tab first; the target exists only after that render.
  useEffect(() => {
    if (!scrollTo) return;
    document.getElementById(scrollTo)?.scrollIntoView({ block: 'start' });
    setScrollTo(null);
  }, [scrollTo, tab]);

  useEffect(() => {
    if (draft && draft.id === id) return;  // just saved a new draft under its id
    let alive = true;
    setLoadState('loading');
    const template = id === 'neu' && vorlage ? TEMPLATES.find((t) => t.key === vorlage) : undefined;
    if (template) {
      setSaved(null);
      setDraft(template.build());
      return;
    }
    listBrewhouses()
      .then((list) => {
        if (!alive) return;
        const source = list.find((b) => b.id === (id === 'neu' ? von : id));
        if (id === 'neu') {
          setSaved(null);
          setDraft(source ? duplicateBrewhouse(source) : null);
        } else {
          setSaved(source ?? null);
          setDraft(source ?? null);
        }
        setLoadState('missing');
      })
      .catch(() => alive && setLoadState('error'));
    return () => { alive = false; };
  }, [id, vorlage, von]);

  if (!draft) {
    const [crumb, text] = {
      loading: ['Lädt …', 'Lädt …'],
      missing: ['Nicht gefunden', 'Sudhaus nicht gefunden.'],
      error: ['Fehler', 'Sudhaus konnte nicht geladen werden.'],
    }[loadState];
    return (
      <PageShell>
        <Breadcrumb trail={[{ label: 'Brauanlage', href: LIST_URL }, { label: crumb }]} />
        <p class="mt-4 text-sm text-muted">{text}</p>
      </PageShell>
    );
  }

  const bh = draft;
  const set = (next: Brewhouse) => setDraft(next);
  const { errors, hints } = checkBrewhouse(bh, snap);
  // updatedAt only changes on save, so it must not count as an edit.
  const dirty = !saved || JSON.stringify({ ...bh, updatedAt: 0 }) !== JSON.stringify({ ...saved, updatedAt: 0 });

  function save() {
    setSaveError(false);
    saveBrewhouse(bh)
      .then((s) => {
        setSaved(s);
        setDraft(s);
        if (id !== s.id) route(`/settings/anlage/sudhaus/${encodeURIComponent(s.id)}`, true);
      })
      .catch(() => setSaveError(true));
  }

  function jump(at: string) {
    setTab(tabOf(at));
    setScrollTo(at);
  }

  const present = STEPS.filter((s) => bh.steps[s.key]);
  const measures = MEASUREMENTS.filter((m) => bh.steps[m.step]);
  const counts: Record<TabId, string> = {
    overview: '',
    vessels: String(bh.vessels.length),
    devices: String(bh.devices.length),
    steps: String(present.length),
    transfers: String(bh.transfers.length),
    measurements: `${measures.filter((m) => bh.measurements[m.key]).length} / ${measures.length}`,
  };
  const errorAt = new Set(errors.map((e) => e.at));

  return (
    // @container: the schema bleeds out of the column to the window edges (cqw).
    <div class="@container">
      <PageShell>
        <header class="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb trail={[{ label: 'Brauanlage', href: LIST_URL }, { label: bh.name || 'Ohne Namen' }]} />
          <div class="flex items-center gap-2">
            {errors.length > 0 && (
              <button type="button" class={badgeCritical} onClick={() => jump(errors[0].at)}>
                {errors.length} Fehler
              </button>
            )}
            <button type="button" class={btnPrimary} disabled={!dirty || errors.length > 0} onClick={save}>
              Speichern{dirty ? ' •' : ''}
            </button>
          </div>
        </header>
        {saveError && <p class="mt-2 text-sm text-critical">Speichern fehlgeschlagen. Die Änderungen sind nur im Browser vorhanden, bis gespeichert ist.</p>}

        <div class="my-4 flex overflow-x-auto border-b border-border">
          {TABS.map((t) => {
            const n = errors.filter((e) => tabOf(e.at) === t.id).length;
            return (
              <TabBtn key={t.id} active={t.id === tab} onClick={() => setTab(t.id)}>
                {t.label}
                {counts[t.id] && <span class="ml-1.5 text-xs text-faint">{counts[t.id]}</span>}
                {n > 0 && (
                  <span class="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[11px] font-bold text-white"
                    title={`${n} Fehler`}>{n}</span>
                )}
              </TabBtn>
            );
          })}
        </div>

        {tab === 'overview' && (
          <>
            <GeneralSection bh={bh} set={set} />
            <CheckSection errors={errors} hints={hints} onJump={jump} />
            <Group id="bh-schema" title="Anlagenschema"
              action={<span class="text-xs text-muted">{brewhouseSummary(bh)}</span>}>
              <BrewhouseSchema bh={bh} errorAt={errorAt} onJump={jump} />
            </Group>
          </>
        )}
        {tab === 'vessels' && <VesselsSection bh={bh} set={set} />}
        {tab === 'devices' && <DevicesSection bh={bh} set={set} snap={snap} />}
        {tab === 'steps' && <StepsSection bh={bh} set={set} />}
        {tab === 'transfers' && <TransfersSection bh={bh} set={set} />}
        {tab === 'measurements' && <MeasurementsSection bh={bh} set={set} snap={snap} />}
      </PageShell>
    </div>
  );
}

type TabId = 'overview' | 'vessels' | 'devices' | 'steps' | 'transfers' | 'measurements';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'vessels', label: 'Behälter' },
  { id: 'devices', label: 'Geräte' },
  { id: 'steps', label: 'Schritte' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'measurements', label: 'Messungen' },
];

// The tab that holds an anchor (see `anchor` in brewhouse.ts).
function tabOf(at: string): TabId {
  if (at === anchor.vessels || at.startsWith('bh-vessel-')) return 'vessels';
  if (at.startsWith('bh-device-')) return 'devices';
  if (at.startsWith('bh-step-')) return 'steps';
  if (at.startsWith('bh-transfer-')) return 'transfers';
  if (at.startsWith('bh-measure-')) return 'measurements';
  return 'overview';
}

type SectionProps = { bh: Brewhouse; set: (bh: Brewhouse) => void };

// ── Inputs ─────────────────────────────────────────────────────────────────────

function TextInput({ value, onChange, placeholder, list, class: cls = 'w-full' }: {
  value: string; onChange: (s: string) => void; placeholder?: string; list?: string; class?: string;
}) {
  return (
    <input class={`${inp} ${cls}`} value={value} placeholder={placeholder} list={list}
      onInput={(e) => onChange(e.currentTarget.value)} />
  );
}

type Opt = { value: string; text: string };

// A <select> over `groups`; a value that is not among them stays selectable as
// "<value> (fehlt)", like the program editor's columns.
function Select({ value, groups, onChange, empty = '— keins —', missing, class: cls = 'w-full' }: {
  value: string; groups: { label?: string; opts: Opt[] }[]; onChange: (v: string) => void;
  empty?: string | null; missing?: string; class?: string;
}) {
  const listed = groups.some((g) => g.opts.some((o) => o.value === value));
  return (
    <select class={`${inp} ${cls}`} value={value} onChange={(e) => onChange(e.currentTarget.value)}>
      {empty !== null && <option value="">{empty}</option>}
      {value !== '' && !listed && <option value={value}>{missing ?? `${value} (fehlt)`}</option>}
      {groups.map((g, i) => g.opts.length === 0 ? null : g.label
        ? <optgroup key={i} label={g.label}>{g.opts.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}</optgroup>
        : g.opts.map((o) => <option key={o.value} value={o.value}>{o.text}</option>))}
    </select>
  );
}

const itemText = (item: { id: string; label?: string }) => (item.label ? `${item.label} (${item.id})` : item.id);

function RemoveButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick}
      class="shrink-0 rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
      <Trash2 size={14} />
    </button>
  );
}

function AddButton({ children, onClick }: { children: ComponentChildren; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} class="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
      <Plus size={12} /> {children}
    </button>
  );
}

// Settings-style group: a small label above the cards it holds.
function Group({ id, title, action, children }: { id?: string; title: string; action?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section id={id} class="mb-6 scroll-mt-4">
      <div class="mb-1.5 flex items-center justify-between gap-3 px-1">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const card = 'scroll-mt-4 rounded-md border border-card-border bg-card p-4 shadow-elev-2';

// ── 1. General ─────────────────────────────────────────────────────────────────

function GeneralSection({ bh, set }: SectionProps) {
  return (
    <Group id={anchor.general} title="Allgemein">
      <div class={`${card} grid gap-3 sm:grid-cols-2`}>
        <Field label="Name"><TextInput value={bh.name} onChange={(name) => set({ ...bh, name })} /></Field>
        <div class="flex flex-wrap gap-4">
          <Field label="Konversion (%)">
            <NumInput value={bh.mashEfficiencyPct} onChange={(n) => set({ ...bh, mashEfficiencyPct: n })} />
          </Field>
          <Field label="Abkühlschwund (%)">
            <NumInput value={bh.coolingShrinkPct} onChange={(n) => set({ ...bh, coolingShrinkPct: n })} />
          </Field>
          <Field label="Läutereffizienz Fly Sparge (%)">
            <OptNum value={bh.lauterEfficiencyPct} placeholder="geschätzt"
              onChange={(n) => set({ ...bh, lauterEfficiencyPct: n })} />
          </Field>
        </div>
        <p class="text-xs text-muted sm:col-span-2">
          Konversion: Anteil des Extraktpotenzials, der sich in der Maische löst (gut sind 95–100 %).
          Die Läutereffizienz rechnet das Rezept aus Vollguss oder Batch Sparge; für Fly Sparge gibt es kein Modell,
          ohne Festwert gilt Batch Sparge mit 2 Gaben.
        </p>
        <div class="sm:col-span-2">
          <Field label="Beschreibung">
            <textarea class={`${inp} w-full`} rows={2} value={bh.description}
              onInput={(e) => set({ ...bh, description: e.currentTarget.value })} />
          </Field>
        </div>
      </div>
    </Group>
  );
}

// ── 2. Vessels ─────────────────────────────────────────────────────────────────

function VesselsSection({ bh, set }: SectionProps) {
  function addVessel() {
    set({ ...bh, vessels: [...bh.vessels, { id: uid(), name: `Behälter ${bh.vessels.length + 1}`, volumeL: 50, deadSpaceL: 1 }] });
  }
  return (
    <Group id={anchor.vessels} title="Behälter" action={<AddButton onClick={addVessel}>Behälter</AddButton>}>
      {bh.vessels.length === 0 && <p class="px-1 text-sm text-muted">Noch keine Behälter. Jeder Behälter übernimmt die Schritte, die du anhakst.</p>}
      <div class="space-y-2">
        {bh.vessels.map((v) => <VesselCard key={v.id} bh={bh} set={set} vessel={v} />)}
      </div>
      <datalist id="bh-lauter-methods">{LAUTER_METHODS.map((m) => <option key={m} value={m} />)}</datalist>
    </Group>
  );
}

function VesselCard({ bh, set, vessel: v }: SectionProps & { vessel: Vessel }) {
  const steps = stepsOf(bh, v.id);
  const preset = vesselPreset(bh, v);
  const patch = (p: Partial<Vessel>) => set({ ...bh, vessels: bh.vessels.map((x) => (x.id === v.id ? { ...x, ...p } : x)) });
  // The vessel boils: the wort, a decoction, or the mash itself when it is
  // heated directly (Kochrast).
  const boils = steps.includes('boil') || decoctionVesselOf(bh)?.vessel.id === v.id
    || (steps.includes('mash') && heatingOf(bh, 'mash').direct);

  // A preset only ticks steps; steps ticked elsewhere move here.
  function applyPreset(i: number) {
    const preset = VESSEL_PRESETS[i];
    let next = bh;
    for (const s of STEPS) next = assignStep(next, v.id, s.key, preset.steps.includes(s.key));
    set(next);
  }

  return (
    <div id={anchor.vessel(v.id)} class={card}>
      <div class="mb-3 flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <TextInput value={v.name} onChange={(name) => patch({ name })} />
        </div>
        <RemoveButton title="Behälter löschen" onClick={() => set(removeVessel(bh, v.id))} />
      </div>
      <div class="mb-3 flex flex-wrap gap-4">
        <Field label="Volumen (l)"><NumInput value={v.volumeL} onChange={(volumeL) => patch({ volumeL })} /></Field>
        <Field label="Totraum (l)"><NumInput value={v.deadSpaceL} onChange={(deadSpaceL) => patch({ deadSpaceL })} /></Field>
        {boils && (
          <Field label="Verdampfung (l/h)">
            <OptNum value={v.evaporationLPerH} onChange={(evaporationLPerH) => patch({ evaporationLPerH })} />
          </Field>
        )}
        {steps.includes('mash') && (
          <Field label="Wärmeverlust (K/h)">
            <OptNum value={v.heatLossKPerH} placeholder="0" onChange={(heatLossKPerH) => patch({ heatLossKPerH })} />
          </Field>
        )}
        {steps.includes('lauter') && (
          <Field label="Läutermethode">
            <TextInput class="w-44" list="bh-lauter-methods" value={v.lauterMethod ?? ''}
              onChange={(m) => patch({ lauterMethod: m || undefined })} />
          </Field>
        )}
        {steps.includes('lauter') && (
          <Field label="Treberverlust (l/kg)">
            <OptNum value={v.grainAbsorptionLPerKg} placeholder={String(DEFAULT_GRAIN_ABSORPTION)}
              onChange={(grainAbsorptionLPerKg) => patch({ grainAbsorptionLPerKg })} />
          </Field>
        )}
        <Field label="Art (hakt die Schritte vor)">
          <select class={`${inp} w-80`} value={preset ? String(VESSEL_PRESETS.indexOf(preset)) : ''}
            onChange={(e) => { const i = parseInt(e.currentTarget.value, 10); if (!Number.isNaN(i)) applyPreset(i); }}>
            {!preset && <option value="" disabled>eigene Zusammenstellung</option>}
            {VESSEL_PRESETS.map((p, i) => <option key={p.label} value={i}>{p.heated ? `${p.label} / ${p.heated}` : p.label}</option>)}
          </select>
        </Field>
      </div>
      <div class="text-xs text-muted">Übernimmt</div>
      <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {STEPS.map((s) => {
          const other = bh.steps[s.key] && bh.steps[s.key]!.vesselId !== v.id
            ? bh.vessels.find((x) => x.id === bh.steps[s.key]!.vesselId) : undefined;
          return (
            <label key={s.key} class="flex items-center gap-1.5 text-sm"
              title={other ? `Bisher bei „${other.name}“, wandert beim Anhaken hierher` : undefined}>
              <input type="checkbox" checked={steps.includes(s.key)}
                onChange={(e) => set(assignStep(bh, v.id, s.key, e.currentTarget.checked))} />
              {s.label}
              {other && <span class="text-xs text-faint">({other.name})</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── 3. Devices ─────────────────────────────────────────────────────────────────

function DevicesSection({ bh, set, snap }: SectionProps & { snap: Snapshot | null }) {
  function add(kind: DeviceKind) {
    const home = HOME_STEP[kind];
    const vesselId = kind === 'pump' ? undefined : (home && bh.steps[home]?.vesselId) || bh.vessels[0]?.id;
    set(addDevice(bh, newDevice(kind, vesselId)));
  }
  return (
    <div id="bh-devices">
      {DEVICE_KINDS.map((k) => (
        <Group key={k.kind} title={k.group} action={<AddButton onClick={() => add(k.kind)}>{k.label}</AddButton>}>
          <div class="space-y-2">
            {bh.devices.filter((d) => d.kind === k.kind)
              .map((d) => <DeviceRow key={d.id} bh={bh} set={set} snap={snap} device={d} />)}
          </div>
        </Group>
      ))}
    </div>
  );
}

function DeviceRow({ bh, set, snap, device: d }: SectionProps & { snap: Snapshot | null; device: Device }) {
  const patch = (p: Partial<Device>) => set({ ...bh, devices: bh.devices.map((x) => (x.id === d.id ? { ...x, ...p } : x)) });
  const kind = DEVICE_KINDS.find((k) => k.kind === d.kind)!;
  const actuators: Opt[] = (snap?.actuators ?? []).map((a) => ({ value: a.id, text: itemText(a) }));
  const controllers: Opt[] = (snap?.controllers ?? []).map((c) => ({ value: c.id, text: itemText(c) }));

  return (
    <div id={anchor.device(d.id)} class={card}>
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-40 flex-1">
          <Field label="Name"><TextInput value={d.name} onChange={(name) => patch({ name })} /></Field>
        </div>
        <Field label="Ort">
          <Select class="w-48" value={d.vesselId ?? ''} empty="inline / ohne Behälter" missing="gelöschter Behälter"
            groups={[{ opts: bh.vessels.map((v) => ({ value: v.id, text: v.name })) }]}
            onChange={(v) => patch({ vesselId: v || undefined })} />
        </Field>
        {d.kind === 'heater' && (
          <Field label="Leistung (W)"><OptNum value={d.powerW} onChange={(powerW) => patch({ powerW })} /></Field>
        )}
        {d.kind === 'pump' && (
          <Field label="Förderleistung (l/min)"><OptNum value={d.flowLPerMin} onChange={(flowLPerMin) => patch({ flowLPerMin })} /></Field>
        )}
        {d.kind === 'chiller' && (
          <Field label="Bauart">
            <Select class="w-44" value={d.chillerType ?? 'immersion'} empty={null}
              groups={[{ opts: CHILLER_TYPES.map((t) => ({ value: t.value, text: t.label })) }]}
              onChange={(v) => patch({ chillerType: v as Device['chillerType'] })} />
          </Field>
        )}
        <RemoveButton title="Gerät löschen" onClick={() => set(removeDevice(bh, d.id))} />
      </div>
      <div class="mt-3 flex flex-wrap items-end gap-3">
        <Segmented value={d.manual ? 'manual' : 'linked'}
          options={[{ value: 'manual', label: 'von Hand' }, { value: 'linked', label: 'angeschlossen' }]}
          onChange={(v) => patch({ manual: v === 'manual' })} />
        {!d.manual && (d.kind === 'heater' ? (
          <Field label={kind.actuator}>
            <Select class="w-56" value={d.controller ? `c:${d.controller}` : d.actuator ? `a:${d.actuator}` : ''}
              empty="— wählen —" missing={`${d.controller ?? d.actuator} (fehlt)`}
              groups={[
                { label: 'Regler', opts: controllers.map((o) => ({ ...o, value: `c:${o.value}` })) },
                { label: 'Aktoren', opts: actuators.map((o) => ({ ...o, value: `a:${o.value}` })) },
              ]}
              onChange={(v) => patch(v.startsWith('c:')
                ? { controller: v.slice(2), actuator: undefined }
                : { controller: undefined, actuator: v.slice(2) || undefined })} />
          </Field>
        ) : (
          <Field label={kind.actuator}>
            <Select class="w-56" value={d.actuator ?? ''} empty="— wählen —" groups={[{ opts: actuators }]}
              onChange={(v) => patch({ actuator: v || undefined })} />
          </Field>
        ))}
      </div>
    </div>
  );
}

// ── 4. Steps ───────────────────────────────────────────────────────────────────

const withLabel = (name: string, label: string) => (label && label !== name ? `${name} (${label})` : name);

function StepsSection({ bh, set }: SectionProps) {
  const present = STEPS.filter((s) => bh.steps[s.key]);
  return (
    <Group id="bh-steps" title="Prozessschritte">
      {present.length === 0 && <p class="px-1 text-sm text-muted">Noch kein Schritt. Schritte entstehen, wenn ein Behälter sie übernimmt.</p>}
      <div class="space-y-2">
        {present.map((s) => <StepRow key={s.key} bh={bh} set={set} step={s.key} heated={!!s.heated} />)}
      </div>
    </Group>
  );
}

function StepRow({ bh, set, step, heated }: SectionProps & { step: StepKey; heated: boolean }) {
  const cfg = bh.steps[step]!;
  const vessel = bh.vessels.find((v) => v.id === cfg.vesselId);
  const patch = (p: Partial<StepConfig>) => set({ ...bh, steps: { ...bh.steps, [step]: { ...cfg, ...p } } });
  const of = (kind: DeviceKind, here = false) => bh.devices
    .filter((d) => d.kind === kind && (!here || d.vesselId === cfg.vesselId))
    .map((d) => ({ value: d.id, text: d.name || d.id }));
  const where = (d: Device) => (d.vesselId ? bh.vessels.find((v) => v.id === d.vesselId)?.name ?? '?' : 'inline');
  const heaters = bh.devices.filter((d) => d.kind === 'heater').map((d) => ({ value: d.id, text: `${d.name} (${where(d)})` }));
  const pumps = of('pump');
  const agitators = of('agitator', true);
  const valves = bh.devices.filter((d) => d.kind === 'valve');
  const h = heatingOf(bh, step);

  return (
    <div id={anchor.step(step)} class={card}>
      <div class="mb-2 flex flex-wrap items-baseline gap-2">
        <span class="font-medium">{stepLabel(step)}</span>
        <span class="text-xs text-muted">in {vessel ? withLabel(vessel.name, vesselLabel(bh, vessel)) : '?'}</span>
        {h.heater && <span class={h.direct ? badgeAccent : badgeCaution}>{heatingText(h)}</span>}
      </div>
      <div class="flex flex-wrap items-end gap-3">
        {heated && (
          <Field label="Heizquelle">
            <Select class="w-52" value={cfg.heaterId ?? ''} groups={[{ opts: heaters }]}
              onChange={(v) => patch({ heaterId: v || undefined })} />
          </Field>
        )}
        {(pumps.length > 0 || cfg.pumpId) && (
          <Field label="Umwälzpumpe">
            <Select class="w-44" value={cfg.pumpId ?? ''} groups={[{ opts: pumps }]}
              onChange={(v) => patch({ pumpId: v || undefined })} />
          </Field>
        )}
        {(agitators.length > 0 || cfg.agitatorId) && (
          <Field label="Rührwerk">
            <Select class="w-44" value={cfg.agitatorId ?? ''} groups={[{ opts: agitators }]}
              onChange={(v) => patch({ agitatorId: v || undefined })} />
          </Field>
        )}
        {heated && (
          <Field label="Heizrate (K/min)">
            <OptNum value={cfg.heatRateKPerMin} onChange={(heatRateKPerMin) => patch({ heatRateKPerMin })} />
          </Field>
        )}
        {step === 'boil' && (
          <>
            {(of('condenser', true).length > 0 || cfg.condenserId) && (
              <Field label="Kondensator">
                <Select class="w-44" value={cfg.condenserId ?? ''} groups={[{ opts: of('condenser', true) }]}
                  onChange={(v) => patch({ condenserId: v || undefined })} />
              </Field>
            )}
            <Field label="Heizleistung beim Kochen (%)">
              <OptNum value={cfg.powerPct} onChange={(powerPct) => patch({ powerPct })} />
            </Field>
          </>
        )}
        {step === 'chill' && (
          <>
            <Field label="Kühler">
              <Select class="w-52" value={cfg.chillerId ?? ''}
                groups={[{ label: 'Kühler', opts: of('chiller') }, { label: 'Spiralen im Behälter', opts: of('coil', true) }]}
                onChange={(v) => patch({ chillerId: v || undefined })} />
            </Field>
            <Field label="Kühldauer (min)">
              <OptNum value={cfg.coolMinutes} onChange={(coolMinutes) => patch({ coolMinutes })} />
            </Field>
          </>
        )}
      </div>
      {valves.length > 0 && (
        <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span class="text-xs text-muted">Wasserzulauf</span>
          {valves.map((d) => (
            <label key={d.id} class="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={cfg.valveIds?.includes(d.id) ?? false}
                onChange={(e) => {
                  const ids = (cfg.valveIds ?? []).filter((x) => x !== d.id);
                  patch({ valveIds: e.currentTarget.checked ? [...ids, d.id] : ids });
                }} />
              {d.name || d.id}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 5. Transfers ───────────────────────────────────────────────────────────────

function TransfersSection({ bh, set }: SectionProps) {
  const present = STEPS.filter((s) => bh.steps[s.key]);
  const vessels: Opt[] = bh.vessels.map((v) => ({ value: v.id, text: v.name }));
  const pumps: Opt[] = bh.devices.filter((d) => d.kind === 'pump').map((d) => ({ value: d.id, text: d.name || d.id }));
  const patch = (id: string, p: Partial<Transfer>) =>
    set({ ...bh, transfers: bh.transfers.map((t) => (t.id === id ? { ...t, ...p } : t)) });

  function add() {
    const t: Transfer = {
      id: uid(), step: present[0]?.key ?? 'mash', from: bh.vessels[0]?.id ?? '', to: 'out',
      drive: 'gravity', lossL: 0, recovered: false,
    };
    set({ ...bh, transfers: [...bh.transfers, t] });
  }

  return (
    <Group id="bh-transfers" title="Transfers" action={<AddButton onClick={add}>Transfer</AddButton>}>
      {bh.transfers.length === 0 && <p class="px-1 text-sm text-muted">Noch keine Transfers. Ein Transfer bewegt Wasser, Maische oder Würze von einem Behälter in den nächsten.</p>}
      <div class="space-y-2">
        {bh.transfers.map((t) => (
          <div key={t.id} id={anchor.transfer(t.id)} class={`${card} flex flex-wrap items-end gap-3`}>
            <Field label="Schritt">
              <Select class="w-44" value={t.step} empty={null}
                groups={[{ opts: present.map((s) => ({ value: s.key, text: s.label })) }]}
                onChange={(v) => patch(t.id, { step: v as StepKey })} />
            </Field>
            <Field label="Von">
              <Select class="w-40" value={t.from} empty="— wählen —" groups={[{ opts: vessels }]}
                onChange={(from) => patch(t.id, { from })} />
            </Field>
            <Field label="Nach">
              <Select class="w-40" value={t.to} empty="— wählen —"
                groups={[{ opts: [...vessels, { value: 'out', text: 'Ausschlagen' }] }]}
                onChange={(to) => patch(t.id, { to })} />
            </Field>
            <Field label="Antrieb">
              <Select class="w-36" value={t.drive} empty={null} groups={[{ opts: DRIVES.map((d) => ({ value: d.value, text: d.label })) }]}
                onChange={(v) => patch(t.id, { drive: v as Transfer['drive'] })} />
            </Field>
            {t.drive === 'pump' && (
              <>
                <Field label="Pumpe">
                  <Select class="w-36" value={t.pumpId ?? ''} empty="— wählen —" groups={[{ opts: pumps }]}
                    onChange={(v) => patch(t.id, { pumpId: v || undefined })} />
                </Field>
                <Field label="Verlust (l)">
                  <NumInput value={t.lossL} onChange={(lossL) => patch(t.id, { lossL })} />
                </Field>
                <label class="flex items-center gap-1.5 pb-2 text-sm">
                  <input type="checkbox" checked={t.recovered} onChange={(e) => patch(t.id, { recovered: e.currentTarget.checked })} />
                  kommt im nächsten Schritt zurück
                </label>
              </>
            )}
            <div class="ml-auto">
              <RemoveButton title="Transfer löschen"
                onClick={() => set({ ...bh, transfers: bh.transfers.filter((x) => x.id !== t.id) })} />
            </div>
          </div>
        ))}
      </div>
    </Group>
  );
}

// ── 6. Measurements ────────────────────────────────────────────────────────────

function MeasurementsSection({ bh, set, snap }: SectionProps & { snap: Snapshot | null }) {
  const sensors: Opt[] = (snap?.sensors ?? []).map((s) => ({
    value: s.id, text: s.meta.unit ? `${itemText(s)} · ${s.meta.unit}` : itemText(s),
  }));
  const present = STEPS.filter((s) => bh.steps[s.key] && MEASUREMENTS.some((m) => m.step === s.key));
  function link(key: string, id: string) {
    const measurements = { ...bh.measurements } as Record<string, string>;
    if (id) measurements[key] = id;
    else delete measurements[key];
    set({ ...bh, measurements });
  }
  return (
    <div id="bh-measurements">
      <p class="mb-4 px-1 text-xs text-muted">
        Der Prozess gibt die Messungen vor. Bei „von Hand“ fragt der Sud den Wert ab und speichert ihn.
      </p>
      {present.map((s) => (
        <Group key={s.key} title={s.label}>
          <div class="space-y-1">
            {MEASUREMENTS.filter((m) => m.step === s.key).map((m) => (
              <div key={m.key} id={anchor.measurement(m.key)}
                class={`${card} flex flex-wrap items-center justify-between gap-2 py-2.5`}>
                <span class="text-sm">{m.label} <span class="text-xs text-muted">({m.unit})</span></span>
                <Select class="w-60" value={bh.measurements[m.key] ?? ''} empty="von Hand"
                  groups={[{ label: 'Sensoren', opts: sensors }]} onChange={(v) => link(m.key, v)} />
              </div>
            ))}
          </div>
        </Group>
      ))}
    </div>
  );
}

// ── 7. Check ───────────────────────────────────────────────────────────────────

function CheckSection({ errors, hints, onJump: jump }: { errors: Issue[]; hints: Issue[]; onJump: (at: string) => void }) {
  const row = (i: Issue, n: number, cls: string, tag: string) => (
    <li key={n}>
      <button type="button" onClick={() => jump(i.at)} class="flex w-full items-start gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-fg/5">
        <span class={`${cls} shrink-0`}>{tag}</span><span>{i.text}</span>
      </button>
    </li>
  );
  return (
    <div id="bh-check" class="scroll-mt-4"><Card title="Prüfung">
      {errors.length === 0 && hints.length === 0 ? (
        <p class="flex items-center gap-2 text-sm text-success"><Check size={16} /> Keine Fehler, keine Hinweise.</p>
      ) : (
        <ul class="space-y-1">
          {errors.map((e, n) => row(e, n, badgeCritical, 'Fehler'))}
          {hints.map((h, n) => row(h, errors.length + n, badgeCaution, 'Hinweis'))}
        </ul>
      )}
      {errors.length > 0 && <p class="mt-2 text-xs text-muted">Solange Fehler bestehen, lässt sich nicht speichern.</p>}
    </Card></div>
  );
}
