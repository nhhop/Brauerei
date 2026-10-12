import { ArrowDown, ArrowUp, Copy, Download, Pencil, Plus, Trash2, X } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  BUILTIN_MASH_PROFILES, deleteMashProfile, duplicateMashProfile, isBuiltinProfile, mashProfileSummary, newMashProfile,
  profileOfPlan, saveMashProfile, type MashProfile, type MashProfileStep,
} from '../../mashProfiles';
import type { MashStep, Recipe } from '../../recipes';
import { badgeAccent, btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../../ui';
import { Field, NumInput, OptNum } from './fields';

const iconBtn = 'rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10 disabled:opacity-30';

// Dialog "Maischprofile": the shipped and own profiles, an editor for own ones,
// duplicate and delete. "Laden" hands the profile to the plan (which asks first).
// `stored` is null until the SD card answered; `storeError` shows the shipped
// ones only. `resultC` is the temperature the plan reaches at a step.
export function MashProfileDialog({ stored, storeError, recipe, resultC, saveFirst, reload, onLoad, onClose }: {
  stored: MashProfile[] | null; storeError: boolean; recipe: Recipe; resultC: (s: MashStep) => number | undefined;
  saveFirst: boolean; reload: () => Promise<void>; onLoad: (p: MashProfile) => void; onClose: () => void;
}) {
  const fromPlan = () => newMashProfile(profileOfPlan(recipe, resultC));
  const [editing, setEditing] = useState<MashProfile | null>(saveFirst ? fromPlan() : null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MashProfile | null>(null);

  async function persist(p: MashProfile) {
    setError(null);
    try {
      await saveMashProfile(p);
      await reload();
      return true;
    } catch {
      setError('Profil konnte nicht gespeichert werden (SD-Karte?).');
      return false;
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setError(null);
    try {
      await deleteMashProfile(target.id);
      await reload();
    } catch { setError('Profil konnte nicht gelöscht werden.'); }
  }

  async function duplicate(p: MashProfile) {
    const copy = duplicateMashProfile(p);
    if (await persist(copy)) setEditing(copy);
  }

  if (editing) {
    return (
      <Editor profile={editing} error={error} onClose={onClose}
        onBack={() => { setEditing(null); setError(null); }}
        onSave={async (p) => { if (await persist(p)) setEditing(null); }} />
    );
  }

  const row = (p: MashProfile) => {
    const builtin = isBuiltinProfile(p);
    return (
      <div key={p.id} class="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2">
        <div class="min-w-0 flex-1 basis-56">
          <div class="truncate text-sm">
            {p.name || 'Ohne Namen'}
            {builtin && <span class={`ml-2 ${badgeAccent}`}>Mitgeliefert</span>}
            {p.method && <span class="ml-2 text-xs text-muted">{p.method}</span>}
          </div>
          <div class="text-xs text-muted">{mashProfileSummary(p)}</div>
          {p.description && <div class="mt-0.5 text-xs text-muted">{p.description}</div>}
        </div>
        <div class="ml-auto flex items-center gap-2">
          <button type="button" title="Profil laden" aria-label="Profil laden" onClick={() => onLoad(p)} class={iconBtn}>
            <Download size={14} />
          </button>
          {!builtin && (
            <button type="button" title="Profil bearbeiten" aria-label="Profil bearbeiten" onClick={() => setEditing(p)} class={iconBtn}>
              <Pencil size={14} />
            </button>
          )}
          <button type="button" title="Profil duplizieren" aria-label="Profil duplizieren" disabled={storeError}
            onClick={() => void duplicate(p)} class={iconBtn}>
            <Copy size={14} />
          </button>
          {!builtin && (
            <button type="button" title="Profil löschen" aria-label="Profil löschen" onClick={() => setDeleteTarget(p)}
              class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div class={dialogScrim} onClick={onClose}>
        <div class={`max-h-[90vh] w-full max-w-2xl ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
          <div class="min-h-0 flex-1 overflow-y-auto p-5">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-base font-medium text-fg">Maischprofile</h2>
              <div class="flex gap-2">
                <button type="button" disabled={storeError} onClick={() => setEditing(fromPlan())}
                  class="rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-fg/10 disabled:opacity-40">
                  Plan als Profil speichern
                </button>
                <button type="button" disabled={storeError} onClick={() => setEditing(newMashProfile())}
                  class="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-fg/10 disabled:opacity-40">
                  <Plus size={12} /> Neu
                </button>
              </div>
            </div>
            {error && <p class="mb-3 text-sm text-critical">{error}</p>}
            {storeError && (
              <p class="mb-3 text-sm text-caution">
                Eigene Profile liegen auf der SD-Karte und ließen sich nicht laden. Die mitgelieferten gehen weiter.
              </p>
            )}
            <div class="space-y-1">
              {BUILTIN_MASH_PROFILES.map(row)}
              {stored?.map(row)}
              {stored === null && !storeError && <p class="px-1 py-2 text-xs text-muted">Eigene Profile laden …</p>}
            </div>
            <p class="mt-3 text-xs text-muted">
              Ein Profil enthält Temperaturen und Haltezeiten, keine Aufheizzeiten; die rechnet das Rezept mit dem Sudhaus.
              Mitgelieferte Profile sind schreibgeschützt, geändert wird eine Kopie.
            </p>
          </div>
          <div class={dialogFooter}>
            <button type="button" class={btnSecondary} onClick={onClose}>Schließen</button>
          </div>
        </div>
      </div>
      <ConfirmModal open={deleteTarget !== null} title="Profil löschen?" confirmLabel="Löschen" destructive
        onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)}>
        „{deleteTarget?.name}“ wird dauerhaft entfernt. Rezepte, die es geladen haben, behalten ihre Schritte.
      </ConfirmModal>
    </>
  );
}

// Editor of one own profile; "Zurück" returns to the list without saving.
function Editor({ profile, error, onSave, onBack, onClose }: {
  profile: MashProfile; error: string | null; onSave: (p: MashProfile) => Promise<void>; onBack: () => void; onClose: () => void;
}) {
  const [p, setP] = useState(profile);
  const [saving, setSaving] = useState(false);
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
                    <NumInput value={s.sharePct ?? 0} onChange={(n) => patchStep(i, { sharePct: n })} class="w-16" /> %
                    <NumInput value={s.durationMin} onChange={(n) => patchStep(i, { durationMin: n })} class="ml-2 w-14" /> min
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
                    Wasser <OptNum value={s.waterTempC} placeholder="kochend" class="w-20"
                      onChange={(waterTempC) => patchStep(i, { waterTempC })} /> °C
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
          {error && <p class="mt-3 text-sm text-critical">{error}</p>}
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onBack}>Zurück</button>
          <button type="button" class={btnPrimary} disabled={saving || p.name.trim() === ''}
            onClick={async () => { setSaving(true); await onSave({ ...p, name: p.name.trim() }); setSaving(false); }}>
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
          Rast <NumInput value={r.tempC} onChange={(n) => setRest(i, { tempC: n })} class="w-14" /> °C
          <NumInput value={r.durationMin} onChange={(n) => setRest(i, { durationMin: n })} class="w-14" /> min
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
        kochen <NumInput value={d.boilMin} onChange={(n) => onChange({ ...d, boilMin: n })} class="w-14" /> min
      </span>
    </span>
  );
}

function StepNumbers({ tempC, durationMin, onChange }: {
  tempC: number; durationMin: number; onChange: (d: { tempC?: number; durationMin?: number }) => void;
}) {
  return (
    <span class="flex items-center gap-1 text-xs text-muted">
      <NumInput value={tempC} onChange={(n) => onChange({ tempC: n })} class="w-16" /> °C
      <NumInput value={durationMin} onChange={(n) => onChange({ durationMin: n })} class="ml-2 w-14" /> min
    </span>
  );
}
