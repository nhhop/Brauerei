import { ArrowDown, ArrowUp, Copy, Download, Pencil, Plus, Trash2 } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  BUILTIN_MASH_PROFILES, deleteMashProfile, duplicateMashProfile, isBuiltinProfile, mashProfileSummary, newMashProfile,
  profileOfPlan, saveMashProfile, type MashProfile, type MashProfileStep,
} from '../../mashProfiles';
import type { MashStep } from '../../recipes';
import { badgeAccent, btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../../ui';
import { Field, NumInput } from './fields';

const iconBtn = 'rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10 disabled:opacity-30';

// Dialog "Maischprofile": the shipped and own profiles, an editor for own ones,
// duplicate and delete. "Laden" hands the profile to the plan (which asks first).
// `stored` is null until the SD card answered; `storeError` shows the shipped
// ones only.
export function MashProfileDialog({ stored, storeError, mash, saveFirst, reload, onLoad, onClose }: {
  stored: MashProfile[] | null; storeError: boolean; mash: MashStep[]; saveFirst: boolean;
  reload: () => Promise<void>; onLoad: (p: MashProfile) => void; onClose: () => void;
}) {
  const fromPlan = () => newMashProfile(profileOfPlan(mash));
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
  const lastC = p.steps.length > 0 ? p.steps[p.steps.length - 1].tempC : p.doughIn.tempC;

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

          <h3 class="mb-2 mt-5 text-sm font-medium">Rasten</h3>
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
                  onChange={(e) => patchStep(i, { kind: e.currentTarget.value as MashProfileStep['kind'] })}>
                  <option value="rest">Rast</option>
                  <option value="infusion">Zubrühen</option>
                </select>
                <input class={`${inp} min-w-0 flex-1 basis-32`} value={s.name} aria-label="Bezeichnung"
                  placeholder={s.kind === 'rest' ? 'Rast' : 'Zubrühen'} onInput={(e) => patchStep(i, { name: e.currentTarget.value })} />
                <StepNumbers tempC={s.tempC} durationMin={s.durationMin} onChange={(d) => patchStep(i, d)} />
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
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setSteps([...p.steps, { kind: 'rest', name: '', tempC: Math.min(lastC + 5, 78), durationMin: 10 }])}
            class="mt-2 flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-fg/10">
            <Plus size={12} /> Rast
          </button>
          <p class="mt-3 text-xs text-muted">
            „Wasser vorlegen“ und die Schüttungen gehören nicht ins Profil. Beim Laden setzt das Profil Temperatur und Dauer
            des Einmaischens und ersetzt die Schritte danach.
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
