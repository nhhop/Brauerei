import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { REST_PRESETS, type MashProfile, type MashProfileStep } from '../../mashProfiles';
import { btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../../ui';
import { Field, MenuItem, NumInput, OptNum, SplitButton } from '../recipe/fields';

type Decoction = NonNullable<MashProfileStep['decoction']>;

const iconBtn = 'rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10 disabled:opacity-30';

// The columns of the recipe's mash plan (MashTab) without transition and start:
// the grid needs 46.25rem of the list's own width, below it rows wrap.
const GRID = '@[46.25rem]:grid @[46.25rem]:grid-cols-[6.5rem_minmax(8rem,1fr)_minmax(9rem,1fr)_6.75rem_7rem_6.5rem] @[46.25rem]:items-center @[46.25rem]:gap-2';
const rowCls = `flex flex-wrap items-center gap-2 border-b border-border py-2 ${GRID}`;
const numCls = 'w-28 @[46.25rem]:w-full';

const KIND_LABEL: Record<MashProfileStep['kind'], string> = {
  rest: 'Rast', infusion: 'Zubrühen', decoction: 'Dekoktion', doughIn: 'Einmaischen',
};

function ListHead() {
  return (
    <div class={`hidden border-b border-border pb-1 text-xs text-muted ${GRID}`}>
      <span>Schritt</span>
      <span>Bezeichnung</span>
      <span>Zugabe</span>
      <span>Temperatur</span>
      <span>Dauer</span>
      <span />
    </div>
  );
}

// Editor of one own mash profile; "Abbrechen" closes it without saving.
export function MashProfileEditor({ profile, onSave, onClose }: {
  profile: MashProfile; onSave: (p: MashProfile) => Promise<void>; onClose: () => void;
}) {
  const [p, setP] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const set = (patch: Partial<MashProfile>) => setP({ ...p, ...patch });
  const setSteps = (steps: MashProfileStep[]) => set({ steps });
  const add = (s: MashProfileStep) => setSteps([...p.steps, s]);
  const patchStep = (i: number, s: Partial<MashProfileStep>) => setSteps(p.steps.map((x, k) => (k === i ? { ...x, ...s } : x)));
  const swap = (i: number, by: -1 | 1) => {
    const next = [...p.steps];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setSteps(next);
  };
  const lastC = [...p.steps].reverse().find((s) => s.tempC !== undefined)?.tempC ?? p.doughIn.tempC;
  const nextRest = REST_PRESETS.find((r) => r.tempC > lastC + 0.5) ?? REST_PRESETS[REST_PRESETS.length - 1];
  // Switching the kind keeps name and hold; what the new kind needs is filled in.
  const changeKind = (i: number, kind: MashProfileStep['kind']) => {
    const { name, durationMin, tempC } = p.steps[i];
    const step: MashProfileStep = { kind, name, durationMin, tempC: tempC ?? lastC };
    if (kind === 'decoction') step.decoction = newDecoction();
    setSteps(p.steps.map((x, k) => (k === i ? step : x)));
  };

  // The menu of the recipe's "+ Rast", without a brewhouse: a decoction is always possible.
  const menu = (close: () => void) => {
    const pick = (s: MashProfileStep) => { add(s); close(); };
    return (
      <>
        <div class="px-2.5 pb-1 pt-2 text-xs font-semibold text-muted">Schritt</div>
        <MenuItem label="Zubrühen" sub="Wasser zugeben, heiß oder kalt"
          onClick={() => pick({ kind: 'infusion', name: 'Zubrühen', tempC: nextRest.tempC, durationMin: 10 })} />
        <MenuItem label="Einmaischen" sub="weitere Schüttung, Anteil in %"
          onClick={() => pick({ kind: 'doughIn', name: 'Schüttung zugeben', durationMin: 10, sharePct: 20 })} />
        <MenuItem label="Dekoktion" sub="Teilmaische kochen und zurückgeben"
          onClick={() => pick({ kind: 'decoction', name: 'Kochmaische', tempC: nextRest.tempC, durationMin: nextRest.durationMin, decoction: newDecoction() })} />
        <div class="px-2.5 pb-1 pt-2 text-xs font-semibold text-muted">Rast</div>
        {REST_PRESETS.map((r) => (
          <MenuItem key={r.name} label={r.name} sub={`${r.tempC} °C · ${r.durationMin} min`}
            onClick={() => pick({ kind: 'rest', ...r })} />
        ))}
      </>
    );
  };

  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-4xl ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="mb-4 text-base font-medium text-fg">Maischprofil</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input class={`${inp} w-full`} value={p.name} placeholder="z. B. Pils, dreistufig"
                onInput={(e) => set({ name: e.currentTarget.value })} />
            </Field>
            <Field label="Verfahren">
              <input class={`${inp} w-full`} value={p.method} placeholder="z. B. Infusion, Stufen"
                onInput={(e) => set({ method: e.currentTarget.value })} />
            </Field>
          </div>
          <div class="mt-3">
            <Field label="Beschreibung">
              <textarea class={`${inp} w-full`} rows={2} value={p.description}
                onInput={(e) => set({ description: e.currentTarget.value })} />
            </Field>
          </div>

          <div class="mb-1 mt-5 flex items-center justify-between gap-2">
            <h3 class="text-sm font-medium">Schritte</h3>
            <SplitButton label="Rast" onMain={() => add({ kind: 'rest', ...nextRest })} arrowTitle="Weitere Schritte" menu={menu} />
          </div>
          <div class="@container text-sm">
            <ListHead />
            <div class={rowCls}>
              <span class="w-28 text-xs text-muted @[46.25rem]:w-auto">Einmaischen</span>
              <span class="min-w-0 flex-1 basis-40 text-xs text-muted @[46.25rem]:basis-auto">feste Stufe, hält die erste Temperatur</span>
              <span class="basis-full text-xs text-muted @[46.25rem]:basis-auto">erste Schüttung</span>
              <NumInput unit="°C" value={p.doughIn.tempC} class={numCls} onChange={(tempC) => set({ doughIn: { ...p.doughIn, tempC } })} />
              <NumInput unit="min" value={p.doughIn.durationMin} class={numCls}
                onChange={(durationMin) => set({ doughIn: { ...p.doughIn, durationMin } })} />
              <span />
            </div>
            {p.steps.map((s, i) => (
              <div key={i} class={rowCls}>
                <span class="w-28 @[46.25rem]:w-auto">
                  {s.kind === 'doughIn' ? <span class="text-xs text-muted">{KIND_LABEL[s.kind]}</span> : (
                    <select class={`${inp} w-full`} value={s.kind} aria-label="Art des Schritts"
                      onChange={(e) => changeKind(i, e.currentTarget.value as MashProfileStep['kind'])}>
                      <option value="rest">Rast</option>
                      <option value="infusion">Zubrühen</option>
                      <option value="decoction">Dekoktion</option>
                    </select>
                  )}
                </span>
                <input class={`${inp} min-w-0 flex-1 basis-40 @[46.25rem]:basis-auto`} value={s.name} aria-label="Bezeichnung"
                  placeholder={KIND_LABEL[s.kind]} onInput={(e) => patchStep(i, { name: e.currentTarget.value })} />
                <span class={`basis-full text-xs text-muted @[46.25rem]:basis-auto ${s.kind === 'rest' ? '@max-[46.25rem]:hidden' : ''}`}>
                  <Addition step={s} patch={(x) => patchStep(i, x)} />
                </span>
                {s.kind === 'doughIn' ? <span class="text-xs text-muted @max-[46.25rem]:hidden">—</span>
                  : <NumInput unit="°C" value={s.tempC ?? lastC} class={numCls} onChange={(tempC) => patchStep(i, { tempC })} />}
                <NumInput unit="min" value={s.durationMin} class={numCls} onChange={(durationMin) => patchStep(i, { durationMin })} />
                <span class="ml-auto flex items-center gap-1 @[46.25rem]:ml-0 @[46.25rem]:justify-end">
                  <button type="button" title="Nach oben" aria-label="Nach oben" disabled={i === 0} onClick={() => swap(i, -1)} class={iconBtn}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" title="Nach unten" aria-label="Nach unten" disabled={i === p.steps.length - 1} onClick={() => swap(i, 1)} class={iconBtn}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" title="Entfernen" aria-label={`${s.name || 'Schritt'} entfernen`}
                    onClick={() => setSteps(p.steps.filter((_, k) => k !== i))}
                    class="rounded-md px-2 py-1.5 text-muted hover:bg-fg/10 hover:text-critical">
                    <Trash2 size={14} />
                  </button>
                </span>
                {s.kind === 'decoction' && s.decoction && (
                  <DecoctionCourse d={s.decoction} onChange={(decoction) => patchStep(i, { decoction })} />
                )}
              </div>
            ))}
          </div>
          <p class="mt-3 text-xs text-muted">
            „Wasser vorlegen“ gehört nicht ins Profil. Beim Laden setzt das Profil Temperatur und Dauer des Einmaischens und
            ersetzt die Schritte danach. Den Anteil einer Dekoktion rechnet das Rezept aus der Zieltemperatur; der Anteil
            einer weiteren Schüttung gilt für die ganze Schüttung, fehlt sie dem Rezept, teilt das Laden sie von der ersten ab.
          </p>
          {failed && <p class="mt-3 text-sm text-critical">Profil konnte nicht gespeichert werden (SD-Karte?).</p>}
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
          <button type="button" class={btnPrimary} disabled={saving || p.name.trim() === ''}
            onClick={() => {
              setSaving(true);
              setFailed(false);
              onSave({ ...p, name: p.name.trim() }).catch(() => { setFailed(true); setSaving(false); });
            }}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// A new decoction: thick, a saccharification rest, then the boil (as in MashTab).
const newDecoction = (): Decoction => ({ rests: [{ tempC: 72, durationMin: 10 }], boilMin: 15 });

// The "Zugabe" column: water temperature of an infusion, share of a further
// charge, thick or thin decoction.
function Addition({ step: s, patch }: { step: MashProfileStep; patch: (p: Partial<MashProfileStep>) => void }) {
  if (s.kind === 'infusion') {
    return (
      <span class="flex items-center gap-1">
        Wasser <OptNum unit="°C" value={s.waterTempC} placeholder="kochend" onChange={(waterTempC) => patch({ waterTempC })} />
      </span>
    );
  }
  if (s.kind === 'doughIn') {
    return (
      <span class="flex items-center gap-1">
        <NumInput unit="%" value={s.sharePct ?? 0} onChange={(sharePct) => patch({ sharePct })} />
        <span class="whitespace-nowrap">der Schüttung</span>
      </span>
    );
  }
  if (s.kind === 'decoction' && s.decoction) {
    const d = s.decoction;
    return (
      <select class={inp} value={d.thin ? 'thin' : 'thick'} aria-label="Dicke der Teilmaische"
        onChange={(e) => patch({ decoction: { ...d, thin: e.currentTarget.value === 'thin' || undefined } })}>
        <option value="thick">dick</option>
        <option value="thin">dünn</option>
      </select>
    );
  }
  return <>—</>;
}

// The decoction's own course below its row: rests in the decoction vessel and the boil.
function DecoctionCourse({ d, onChange }: { d: Decoction; onChange: (d: Decoction) => void }) {
  const setRest = (i: number, p: Partial<Decoction['rests'][number]>) =>
    onChange({ ...d, rests: d.rests.map((r, k) => (k === i ? { ...r, ...p } : r)) });
  return (
    <div class="flex basis-full flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted @[46.25rem]:col-span-4 @[46.25rem]:col-start-2">
      <span>Teilmaische:</span>
      {d.rests.map((r, i) => (
        <span key={i} class="flex items-center gap-1">
          Rast <NumInput unit="°C" value={r.tempC} onChange={(n) => setRest(i, { tempC: n })} />
          <NumInput unit="min" value={r.durationMin} onChange={(n) => setRest(i, { durationMin: n })} />
          <button type="button" title="Rast der Teilmaische entfernen" aria-label="Rast der Teilmaische entfernen"
            onClick={() => onChange({ ...d, rests: d.rests.filter((_, k) => k !== i) })} class="rounded px-0.5 text-faint hover:text-critical">
            <X size={12} />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => onChange({ ...d, rests: [...d.rests, { tempC: 72, durationMin: 10 }] })}
        class="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 hover:bg-fg/10">
        <Plus size={12} /> Rast
      </button>
      <span class="flex items-center gap-1">
        kochen <NumInput unit="min" value={d.boilMin} onChange={(n) => onChange({ ...d, boilMin: n })} />
      </span>
    </div>
  );
}

const num = (n: number | undefined) => String(n ?? '?').replace('.', ',');

// Read-only view of a profile (the shipped ones) in the editor's columns;
// "Duplizieren" hands a copy to the editor.
export function MashProfileView({ profile: p, onDuplicate, onClose }: {
  profile: MashProfile; onDuplicate: () => void; onClose: () => void;
}) {
  const row = (key: string | number, kind: string, name: string, addition: string, temp: string, duration: string,
    below?: ComponentChildren) => (
    <div key={key} class={rowCls}>
      <span class="w-28 text-xs text-muted @[46.25rem]:w-auto">{kind}</span>
      <span class="min-w-0 flex-1 basis-40 @[46.25rem]:basis-auto">{name}</span>
      <span class={`basis-full text-xs text-muted @[46.25rem]:basis-auto ${addition === '—' ? '@max-[46.25rem]:hidden' : ''}`}>{addition}</span>
      <span class="tabular-nums">{temp}</span>
      <span class="tabular-nums">{duration}</span>
      <span />
      {below}
    </div>
  );
  const addition = (s: MashProfileStep) => (s.kind === 'infusion' ? `Wasser ${s.waterTempC === undefined ? 'kochend' : `${num(s.waterTempC)} °C`}`
    : s.kind === 'doughIn' ? `${num(s.sharePct)} % der Schüttung`
      : s.kind === 'decoction' ? (s.decoction?.thin ? 'dünn' : 'dick') : '—');
  const course = (d: Decoction) => (
    <div class="basis-full text-xs text-muted @[46.25rem]:col-span-4 @[46.25rem]:col-start-2">
      Teilmaische: {[...d.rests.map((r) => `Rast ${num(r.tempC)} °C ${r.durationMin} min`), `kochen ${d.boilMin} min`].join(' · ')}
    </div>
  );
  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-4xl ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="text-base font-medium text-fg">{p.name || 'Ohne Namen'}</h2>
          {p.method && <p class="mt-0.5 text-xs text-muted">{p.method}</p>}
          {p.description && <p class="mt-3 text-sm text-muted">{p.description}</p>}
          <h3 class="mb-1 mt-5 text-sm font-medium">Schritte</h3>
          <div class="@container text-sm">
            <ListHead />
            {row('doughIn', 'Einmaischen', 'Einmaischen', 'erste Schüttung', `${num(p.doughIn.tempC)} °C`, `${p.doughIn.durationMin} min`)}
            {p.steps.map((s, i) => row(i, KIND_LABEL[s.kind], s.name || KIND_LABEL[s.kind], addition(s),
              s.kind === 'doughIn' ? '—' : `${num(s.tempC)} °C`, `${s.durationMin} min`,
              s.kind === 'decoction' && s.decoction ? course(s.decoction) : undefined))}
          </div>
          <p class="mt-3 text-xs text-muted">Mitgelieferte Profile sind schreibgeschützt; geändert wird eine Kopie.</p>
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Schließen</button>
          <button type="button" class={btnPrimary} onClick={onDuplicate}>Duplizieren</button>
        </div>
      </div>
    </div>
  );
}
