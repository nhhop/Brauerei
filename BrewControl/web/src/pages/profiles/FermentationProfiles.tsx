import { useEffect, useState } from 'preact/hooks';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  BUILTIN_FERMENTATION_PROFILES, PHASE_PRESETS, deleteFermentationProfile, duplicateFermentationProfile, fermentationProfileSummary,
  listFermentationProfiles, maxPressureBar, newFermentationProfile, saveFermentationProfile, totalDays,
  type FermentationProfile,
} from '../../fermentationProfiles';
import { uid, type Phase } from '../../recipes';
import { btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../../ui';
import { Field } from '../recipe/fields';
import { PhaseList } from '../recipe/PhaseList';
import { ProfileList, type ProfileColumn } from './ProfileList';

const dec = (n: number) => String(n).replace('.', ',');

const COLUMNS: ProfileColumn<FermentationProfile>[] = [
  { label: 'Phasen', align: 'right', cell: (p) => p.phases.length },
  { label: 'Tage', align: 'right', cell: (p) => dec(totalDays(p)) },
  { label: 'Druck', align: 'right', cell: (p) => (p.pressureFermentation ? `${dec(maxPressureBar(p))} bar` : '–') },
];
const COLS = 'lg:grid-cols-[minmax(8rem,2fr)_56px_56px_64px_92px]';

// Tab "Gärung" of the profile page: phase sequences the recipe's fermentation
// tab loads (fermentationProfiles.ts).
export function FermentationProfilesTab() {
  const [own, setOwn] = useState<FermentationProfile[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FermentationProfile | null>(null);
  const [viewing, setViewing] = useState<FermentationProfile | null>(null);
  const [deleting, setDeleting] = useState<FermentationProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => listFermentationProfiles().then(setOwn);
  useEffect(() => { reload().catch(() => setLoadFailed(true)); }, []);

  if (!own) return <p class="text-sm text-muted">{loadFailed ? 'Die Gärprofile konnten nicht geladen werden.' : 'Lädt …'}</p>;

  async function save(p: FermentationProfile) {
    await saveFermentationProfile(p);
    await reload();
    setEditing(null);
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteFermentationProfile(deleting!.id);
      await reload();
    } catch {
      setError('Löschen fehlgeschlagen.');
    }
    setBusy(false);
    setDeleting(null);
  }

  return (
    <>
      <p class="text-sm text-muted">Gärführungen, die der Gärung-Tab des Rezepts lädt: Phasen und ob unter Druck vergoren wird.</p>
      {error && <p class="mt-3 text-sm text-critical">{error}</p>}
      <ProfileList own={own} builtin={BUILTIN_FERMENTATION_PROFILES} cols={COLS} columns={COLUMNS}
        sub={(p) => p.description || undefined} mobile={fermentationProfileSummary}
        action={<button type="button" class={btnPrimary} onClick={() => setEditing(newFermentationProfile())}>+ Neues Gärprofil</button>}
        ownEmpty="Noch kein eigenes Gärprofil. Ein mitgeliefertes lässt sich als Vorlage duplizieren, oder im Rezept die Phasen als Profil speichern."
        onEdit={setEditing} onView={setViewing} onDuplicate={(p) => setEditing(duplicateFermentationProfile(p))} onDelete={setDeleting}
        footnote="Dauer in Tagen, eine Rampe zählt zu ihrer Phase. Die mitgelieferten Profile sind Richtwerte." />
      {editing && <FermentationProfileDialog profile={editing} onSave={save} onClose={() => setEditing(null)} />}
      {viewing && (
        <FermentationProfileView profile={viewing} onClose={() => setViewing(null)}
          onDuplicate={() => { setEditing(duplicateFermentationProfile(viewing)); setViewing(null); }} />
      )}
      <ConfirmModal open={deleting !== null} title="Gärprofil löschen?" confirmLabel="Löschen" destructive pending={busy}
        onConfirm={confirmDelete} onCancel={() => setDeleting(null)}>
        „{deleting?.name || 'Ohne Namen'}“ wird dauerhaft entfernt. Rezepte, die es geladen haben, behalten ihre Phasen.
      </ConfirmModal>
    </>
  );
}

// A shipped profile, read-only; "Duplizieren" opens the editor with a copy.
function FermentationProfileView({ profile: p, onClose, onDuplicate }: {
  profile: FermentationProfile; onClose: () => void; onDuplicate: () => void;
}) {
  const th = 'px-2 py-1.5 text-right font-semibold';
  const td = 'px-2 py-1.5 text-right tabular-nums';
  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-xl ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="text-base font-medium text-fg">{p.name}</h2>
          <p class="mt-1 text-xs text-muted">Mitgeliefert, nicht änderbar. Zum Anpassen duplizieren.</p>
          {p.description && <p class="mt-3 text-sm">{p.description}</p>}
          <p class="mt-3 text-sm">{p.pressureFermentation ? 'Unter Druck vergären' : 'Ohne Druck'}</p>
          <div class="mt-3 overflow-x-auto rounded-md border border-card-border">
            <table class="w-full text-sm">
              <thead class="border-b border-card-border text-xs text-muted">
                <tr>
                  <th class="w-6 px-2 py-1.5" />
                  <th class="px-2 py-1.5 text-left font-semibold">Phase</th>
                  <th class={th}>°C</th>
                  <th class={th}>Tage</th>
                  <th class={th}>Rampe</th>
                  {p.pressureFermentation && <th class={th}>bar</th>}
                </tr>
              </thead>
              <tbody>
                {p.phases.map((x, i) => (
                  <tr key={i} class="border-b border-card-border last:border-b-0">
                    <td class="px-2 py-1.5 text-xs text-faint">{i + 1}</td>
                    <td class="px-2 py-1.5">{x.name || '–'}</td>
                    <td class={td}>{dec(x.tempC)}</td>
                    <td class={td}>{dec(x.duration)}</td>
                    <td class={td}>{x.rampDays ? dec(x.rampDays) : '–'}</td>
                    {p.pressureFermentation && <td class={td}>{x.pressureBar ? dec(x.pressureBar) : '–'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="mt-2 text-xs text-muted">
            {dec(totalDays(p))} Tage gesamt; Rampe in Tagen, sie zählt zu ihrer Phase.
          </p>
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Schließen</button>
          <button type="button" class={btnPrimary} onClick={onDuplicate}>Duplizieren</button>
        </div>
      </div>
    </div>
  );
}

function FermentationProfileDialog({ profile, onSave, onClose }: {
  profile: FermentationProfile; onSave: (p: FermentationProfile) => Promise<void>; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [p, setP] = useState(profile);
  // PhaseList keys its rows by id; the profile's phases have none.
  const [phases, setPhases] = useState<Phase[]>(() => profile.phases.map((x) => ({ id: uid(), ...x })));
  const set = (patch: Partial<FermentationProfile>) => setP({ ...p, ...patch });

  function submit() {
    setBusy(true);
    setFailed(false);
    const out: FermentationProfile = {
      ...p, name: p.name.trim(),
      phases: phases.map(({ id: _id, ...x }) => {
        if (!p.pressureFermentation) delete x.pressureBar;
        return x;
      }),
    };
    onSave(out).catch(() => { setFailed(true); setBusy(false); });
  }

  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-3xl ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="mb-4 text-base font-medium text-fg">Gärprofil</h2>
          <div class="grid gap-3">
            <Field label="Name">
              <input class={`${inp} w-full`} value={p.name} placeholder="z. B. Pils kalt geführt"
                onInput={(e) => set({ name: e.currentTarget.value })} />
            </Field>
            <Field label="Beschreibung">
              <textarea class={`${inp} w-full`} rows={3} value={p.description}
                onInput={(e) => set({ description: e.currentTarget.value })} />
            </Field>
          </div>
          <div class="mt-4">
            <PhaseList title="Phasen" addLabel="Phase" namePlaceholder="z.B. Hauptgärung" durationUnit="Tage"
              empty="Noch keine Phasen." pressure={!!p.pressureFermentation} items={phases} onChange={setPhases}
              onPressure={(on) => set({ pressureFermentation: on ? true : undefined })} presets={PHASE_PRESETS} />
          </div>
          {failed && <p class="mt-3 text-sm text-critical">Speichern fehlgeschlagen.</p>}
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
          <button type="button" class={btnPrimary} disabled={busy || p.name.trim() === ''} onClick={submit}>Speichern</button>
        </div>
      </div>
    </div>
  );
}
