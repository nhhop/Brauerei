import { useEffect, useState } from 'preact/hooks';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  BUILTIN_MASH_PROFILES, deleteMashProfile, duplicateMashProfile, listMashProfiles, mashProfileSummary, newMashProfile,
  saveMashProfile, type MashProfile,
} from '../../mashProfiles';
import { btnPrimary } from '../../ui';
import { MashProfileEditor } from './MashProfileEditor';
import { ProfileList, type ProfileColumn } from './ProfileList';

const MASH_COLUMNS: ProfileColumn<MashProfile>[] = [
  { label: 'Verfahren', cell: (p) => <span class="block truncate" title={p.method}>{p.method || '–'}</span> },
  { label: 'Ablauf', cell: (p) => <span class="line-clamp-2" title={mashProfileSummary(p)}>{mashProfileSummary(p)}</span> },
];
const MASH_COLS = 'lg:grid-cols-[minmax(10rem,1.2fr)_minmax(8rem,1fr)_minmax(14rem,2fr)_92px]';

// Tab "Maische" of the profile page: own mash profiles from the SD card, the
// shipped BUILTIN_MASH_PROFILES. The recipe's mash plan loads them and saves
// its plan as a new one (MashTab).
export function MashProfilesTab() {
  const [own, setOwn] = useState<MashProfile[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MashProfile | null>(null);
  const [deleting, setDeleting] = useState<MashProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => listMashProfiles().then(setOwn);
  useEffect(() => { reload().catch(() => setLoadFailed(true)); }, []);

  if (!own) return <p class="text-sm text-muted">{loadFailed ? 'Die Maischprofile konnten nicht geladen werden.' : 'Lädt …'}</p>;

  async function save(p: MashProfile) {
    await saveMashProfile(p);
    await reload();
    setEditing(null);
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteMashProfile(deleting!.id);
      await reload();
    } catch {
      setError('Löschen fehlgeschlagen.');
    }
    setBusy(false);
    setDeleting(null);
  }

  return (
    <>
      <p class="text-sm text-muted">Rastfolgen, die der Maischeplan eines Rezepts lädt.</p>
      {error && <p class="mt-3 text-sm text-critical">{error}</p>}
      <ProfileList own={own} builtin={BUILTIN_MASH_PROFILES} cols={MASH_COLS} columns={MASH_COLUMNS}
        sub={(p) => p.description || undefined}
        mobile={(p) => (p.method ? `${p.method} · ${mashProfileSummary(p)}` : mashProfileSummary(p))}
        action={<button type="button" class={btnPrimary} onClick={() => setEditing(newMashProfile())}>+ Neues Maischprofil</button>}
        ownEmpty="Noch kein eigenes Maischprofil. Ein mitgeliefertes lässt sich als Vorlage duplizieren, ein Rezept seinen Plan als Profil speichern."
        onEdit={setEditing} onDuplicate={(p) => setEditing(duplicateMashProfile(p))} onDelete={setDeleting}
        footnote="Ein Profil enthält Temperaturen und Haltezeiten, keine Aufheizzeiten; die rechnet das Rezept mit dem Sudhaus." />
      {editing && <MashProfileEditor profile={editing} onSave={save} onClose={() => setEditing(null)} />}
      <ConfirmModal open={deleting !== null} title="Maischprofil löschen?" confirmLabel="Löschen" destructive pending={busy}
        onConfirm={confirmDelete} onCancel={() => setDeleting(null)}>
        „{deleting?.name || 'Ohne Namen'}“ wird dauerhaft entfernt. Rezepte, die es geladen haben, behalten ihre Schritte.
      </ConfirmModal>
    </>
  );
}
