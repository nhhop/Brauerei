import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-preact';
import { useState } from 'preact/hooks';
import type { MashProfile, MashProfileStep } from '../../mashProfiles';
import { btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../../ui';
import { Field, NumInput, OptNum } from '../recipe/fields';

const iconBtn = 'rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10 disabled:opacity-30';

// Editor of one own mash profile; "Abbrechen" closes it without saving.
export function MashProfileEditor({ profile, onSave, onClose }: {
  profile: MashProfile; onSave: (p: MashProfile) => Promise<void>; onClose: () => void;
}) {
  const [p, setP] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const set = (patch: Partial<MashProfile>) => setP({ ...p, ...patch });
  const setSteps = (steps: MashProfileStep[]) => set({ steps });
  const patchStep = (i: number, s: Partial<MashProfileStep>) => setSteps(p.steps.map((x, k) => (k === i ? { ...x, ...s } : x)));
  const swap = (i: number, by: -1 | 1) => {
    const next = [...p.steps];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setSteps(next);
  };
  const lastC = [...p.steps].reverse().find((s) => s.tempC !== undefined)?.tempC ?? p.doughIn.tempC;
  // Switching the kind keeps name and hold; what the new kind needs is filled in.
  const changeKind = (i: number, kind: MashProfileStep['kind']) => {
    const { name, durationMin, tempC } = p.steps[i];
    const step: MashProfileStep = kind === 'doughIn' ? { kind, name, durationMin, sharePct: 20 }
      : { kind, name, durationMin, tempC: tempC ?? lastC };
    if (kind === 'decoction') step.decoction = { rests: [{ tempC: 72, durationMin: 10 }], boilMin: 15 };
    setSteps(p.steps.map((x, k) => (k === i ? step : x)));
  };

  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-2xl ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
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

          <h3 class="mb-2 mt-5 text-sm font-medium">Schritte</h3>
          <div class="space-y-1 text-sm">
            <div class="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2">
              <span class="w-28 text-xs text-muted">Einmaischen</span>
              <span class="min-w-0 flex-1 basis-32 text-xs text-muted">feste Stufe, hält die erste Temperatur</span>
              <StepNumbers tempC={p.doughIn.tempC} durationMin={p.doughIn.durationMin}
                onChange={(d) => set({ doughIn: { ...p.doughIn, ...d } })} />
              <span class="hidden w-[7.5rem] sm:block" />
            </div>
            {p.steps.map((s, i) => (
              <div key={i} class="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2">
                <select class={`${inp} w-28`} value={s.kind} aria-label="Art des Schritts"
                  onChange={(e) => changeKind(i, e.currentTarget.value as MashProfileStep['kind'])}>
                  {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <input class={`${inp} min-w-0 flex-1 basis-32`} value={s.name} aria-label="Bezeichnung"
                  placeholder={KIND_LABEL[s.kind]} onInput={(e) => patchStep(i, { name: e.currentTarget.value })} />
                {s.kind === 'doughIn' ? (
                  <span class="flex items-center gap-1 text-xs text-muted">
                    <NumInput unit="%" value={s.sharePct ?? 0} onChange={(n) => patchStep(i, { sharePct: n })} />
                    <NumInput unit="min" value={s.durationMin} onChange={(n) => patchStep(i, { durationMin: n })} />
                  </span>
                ) : (
                  <StepNumbers tempC={s.tempC ?? lastC} durationMin={s.durationMin} onChange={(d) => patchStep(i, d)} />
                )}
                <span class="ml-auto flex items-center gap-1">
                  <button type="button" title="Nach oben" aria-label="Nach oben" disabled={i === 0} onClick={() => swap(i, -1)} class={iconBtn}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" title="Nach unten" aria-label="Nach unten" disabled={i === p.steps.length - 1} onClick={() => swap(i, 1)} class={iconBtn}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" title="Entfernen" aria-label="Entfernen" onClick={() => setSteps(p.steps.filter((_, k) => k !== i))}
                    class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
                    <Trash2 size={14} />
                  </button>
                </span>
                {s.kind === 'infusion' && (
                  <span class="flex basis-full items-center gap-1 text-xs text-muted">
                    Wasser <OptNum unit="°C" value={s.waterTempC} placeholder="kochend"
                      onChange={(waterTempC) => patchStep(i, { waterTempC })} />
                  </span>
                )}
                {s.kind === 'doughIn' && (
                  <span class="basis-full text-xs text-muted">
                    Anteil an der ganzen Schüttung; fehlt dem Rezept die Schüttung, teilt das Laden sie von der ersten ab.
                  </span>
                )}
                {s.kind === 'decoction' && s.decoction && (
                  <DecoctionEditor d={s.decoction} onChange={(decoction) => patchStep(i, { decoction })} />
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setSteps([...p.steps, { kind: 'rest', name: '', tempC: Math.min(lastC + 5, 78), durationMin: 10 }])}
            class="mt-2 flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-fg/10">
            <Plus size={12} /> Rast
          </button>
          <p class="mt-3 text-xs text-muted">
            „Wasser vorlegen“ gehört nicht ins Profil. Beim Laden setzt das Profil Temperatur und Dauer des Einmaischens und
            ersetzt die Schritte danach. Den Anteil einer Dekoktion rechnet das Rezept aus der Zieltemperatur.
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

const KIND_LABEL: Record<MashProfileStep['kind'], string> = {
  rest: 'Rast', infusion: 'Zubrühen', decoction: 'Dekoktion', doughIn: 'Schüttung',
};

const num = (n: number | undefined) => String(n ?? '?').replace('.', ',');

// What a step does beyond its temperature and hold, as text.
function stepDetail(s: MashProfileStep): string | undefined {
  if (s.kind === 'infusion') return `Wasser ${s.waterTempC === undefined ? 'kochend' : `${num(s.waterTempC)} °C`}`;
  if (s.kind === 'doughIn') return `${num(s.sharePct)} % der ganzen Schüttung`;
  if (s.kind === 'decoction' && s.decoction) {
    const d = s.decoction;
    return [d.thin ? 'dünn' : 'dick', ...d.rests.map((r) => `Rast ${num(r.tempC)} °C ${r.durationMin} min`), `kochen ${d.boilMin} min`].join(' · ');
  }
  return undefined;
}

// Read-only view of a profile (the shipped ones); "Duplizieren" hands a copy
// to the editor.
export function MashProfileView({ profile: p, onDuplicate, onClose }: {
  profile: MashProfile; onDuplicate: () => void; onClose: () => void;
}) {
  const row = (kind: string, name: string, values: string, detail?: string) => (
    <div class="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 rounded-md border border-border px-3 py-2">
      <span class="text-xs text-muted">{kind}</span>
      <span class="min-w-0">{name}</span>
      <span class="text-right tabular-nums">{values}</span>
      {detail && <span class="col-span-3 text-xs text-muted sm:col-start-2">{detail}</span>}
    </div>
  );
  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-2xl ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="text-base font-medium text-fg">{p.name || 'Ohne Namen'}</h2>
          {p.method && <p class="mt-0.5 text-xs text-muted">{p.method}</p>}
          {p.description && <p class="mt-3 text-sm text-muted">{p.description}</p>}
          <h3 class="mb-2 mt-5 text-sm font-medium">Schritte</h3>
          <div class="space-y-1 text-sm">
            {row('Einmaischen', 'Einmaischen', `${num(p.doughIn.tempC)} °C · ${p.doughIn.durationMin} min`)}
            {p.steps.map((s) => row(KIND_LABEL[s.kind], s.name || KIND_LABEL[s.kind],
              s.kind === 'doughIn' ? `${s.durationMin} min` : `${num(s.tempC)} °C · ${s.durationMin} min`, stepDetail(s)))}
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

// Thick or thin, the rests in the decoction vessel and the boil.
function DecoctionEditor({ d, onChange }: {
  d: NonNullable<MashProfileStep['decoction']>; onChange: (d: NonNullable<MashProfileStep['decoction']>) => void;
}) {
  const setRest = (i: number, p: Partial<(typeof d.rests)[number]>) =>
    onChange({ ...d, rests: d.rests.map((r, k) => (k === i ? { ...r, ...p } : r)) });
  return (
    <span class="flex basis-full flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <select class={inp} value={d.thin ? 'thin' : 'thick'} aria-label="Dicke der Teilmaische"
        onChange={(e) => onChange({ ...d, thin: e.currentTarget.value === 'thin' || undefined })}>
        <option value="thick">dick</option>
        <option value="thin">dünn</option>
      </select>
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
    </span>
  );
}

function StepNumbers({ tempC, durationMin, onChange }: {
  tempC: number; durationMin: number; onChange: (d: { tempC?: number; durationMin?: number }) => void;
}) {
  return (
    <span class="flex items-center gap-1 text-xs text-muted">
      <NumInput unit="°C" value={tempC} onChange={(n) => onChange({ tempC: n })} />
      <NumInput unit="min" value={durationMin} onChange={(n) => onChange({ durationMin: n })} />
    </span>
  );
}
