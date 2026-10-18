import { useEffect, useState } from 'preact/hooks';
import { getBrewery, saveBrewery, type Brewery } from '../brewhouse';
import { ConfirmModal } from '../components/ConfirmModal';
import { uid } from '../recipes';
import { TARGET_PROFILES } from '../waterSolver';
import { deleteWaterProfile, saveWaterProfile } from '../waterProfiles';
import {
  CA_PER_DH, HCO3_PER_DH, HCO3_PER_KS43, MG_PER_DH, VE_WATER, figuresOf, ionBalance, stateOf, type WaterProfile,
} from '../waterChem';
import { btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../ui';
import { ProfileList, type ProfileColumn } from './profiles/ProfileList';
import { Field, NumInput, OptNum } from './recipe/fields';

export const fmtNum = (n: number, digits = 0) => n.toFixed(digits).replace('.', ',');

export function profileSummary(p: WaterProfile): string {
  const f = figuresOf(stateOf(p));
  return `Ca ${fmtNum(p.ca)} · Mg ${fmtNum(p.mg)} · Na ${fmtNum(p.na)} · Cl ${fmtNum(p.cl)} · SO₄ ${fmtNum(p.so4)} · `
    + `HCO₃ ${fmtNum(p.hco3)} mg/l · RA ${fmtNum(f.raDh, 1)} °dH${p.ph === undefined ? '' : ` · pH ${fmtNum(p.ph, 2)}`}`;
}

// Ions in mg/l, then the residual alkalinity and the pH.
const ION_COLS: { key: 'ca' | 'mg' | 'na' | 'k' | 'cl' | 'so4' | 'hco3'; label: string }[] = [
  { key: 'ca', label: 'Ca' }, { key: 'mg', label: 'Mg' }, { key: 'na', label: 'Na' }, { key: 'k', label: 'K' },
  { key: 'cl', label: 'Cl' }, { key: 'so4', label: 'SO₄' }, { key: 'hco3', label: 'HCO₃' },
];
const WATER_COLUMNS: ProfileColumn<WaterProfile>[] = [
  ...ION_COLS.map(({ key, label }): ProfileColumn<WaterProfile> =>
    ({ label, align: 'right', cell: (p) => (p[key] === undefined ? '–' : fmtNum(p[key]!)) })),
  { label: 'RA °dH', align: 'right', cell: (p) => fmtNum(figuresOf(stateOf(p)).raDh, 1) },
  { label: 'pH', align: 'right', cell: (p) => (p.ph === undefined ? '–' : fmtNum(p.ph, 2)) },
];
const WATER_COLS = 'lg:grid-cols-[minmax(8rem,2fr)_repeat(7,44px)_56px_40px_92px]';

// Tab "Wasser" (source waters, VE water shipped) or "Zielwasser" (own targets,
// the shipped TARGET_PROFILES) of the profile page. The default water stays in
// Settings › Brauanlage. getBrewery also moves profiles still in the brewery
// document (waterProfiles.ts).
export function WaterProfilesTab({ target }: { target: boolean }) {
  const [brewery, setBrewery] = useState<Brewery | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<WaterProfile | null>(null);
  const [viewing, setViewing] = useState<WaterProfile | null>(null);
  const [deleting, setDeleting] = useState<WaterProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => getBrewery().then(setBrewery);
  useEffect(() => { reload().catch(() => setLoadFailed(true)); }, []);

  if (!brewery) return <p class="text-sm text-muted">{loadFailed ? 'Die Wasserprofile konnten nicht geladen werden.' : 'Lädt …'}</p>;

  const own = (brewery.waters ?? []).filter((w) => !!w.target === target);
  const builtin = target ? TARGET_PROFILES : [VE_WATER];
  const blank = (): WaterProfile =>
    ({ id: uid(), name: '', ca: 0, mg: 0, na: 0, cl: 0, so4: 0, hco3: 0, ...(target ? { target: true as const } : {}) });

  async function save(p: WaterProfile) {
    await saveWaterProfile(p);
    await reload();
    setEditing(null);
  }

  function duplicate(p: WaterProfile) {
    const copy: WaterProfile = { ...p, id: uid(), name: `${p.name} (Kopie)` };
    delete copy.updatedAt;
    setEditing(copy);
  }

  // A deleted default water would leave recipes without a choice pointing at nothing.
  async function confirmDelete() {
    const p = deleting!;
    setBusy(true);
    setError(null);
    try {
      await deleteWaterProfile(p.id);
      if (brewery!.defaultWaterId === p.id) await saveBrewery({ ...brewery!, defaultWaterId: undefined });
      await reload();
    } catch {
      setError('Löschen fehlgeschlagen.');
    }
    setBusy(false);
    setDeleting(null);
  }

  return (
    <>
      <p class="text-sm text-muted">
        {target
          ? 'Ziele für den Vergleich und die Automatik im Wasser-Tab des Rezepts.'
          : 'Wasseranalysen, aus denen ein Rezept sein Brauwasser nimmt.'}
      </p>
      {error && <p class="mt-3 text-sm text-critical">{error}</p>}
      <ProfileList own={own} builtin={builtin} cols={WATER_COLS} columns={WATER_COLUMNS}
        sub={(p) => p.note} mobile={profileSummary}
        action={
          <button type="button" class={btnPrimary} onClick={() => setEditing(blank())}>
            + {target ? 'Neues Zielprofil' : 'Neues Wasserprofil'}
          </button>
        }
        ownEmpty={target
          ? 'Noch kein eigenes Zielprofil. Ein mitgeliefertes lässt sich als Vorlage duplizieren.'
          : 'Noch kein Wasserprofil angelegt. Ohne Profil rechnen Rezepte mit VE-Wasser.'}
        onEdit={setEditing} onView={setViewing} onDuplicate={duplicate} onDelete={setDeleting}
        footnote={target
          ? 'Ionen in mg/l, Restalkalität in °dH.'
          : <>Ionen in mg/l, Restalkalität in °dH. Das Standardwasser neuer Rezepte steht unter{' '}
            <a href="/settings/anlage" class="underline">Einstellungen › Brauanlage</a>.</>} />
      {editing && <ProfileDialog profile={editing} onSave={save} onClose={() => setEditing(null)} />}
      {viewing && (
        <ProfileView profile={viewing} onClose={() => setViewing(null)}
          onDuplicate={() => { duplicate(viewing); setViewing(null); }} />
      )}
      <ConfirmModal open={deleting !== null} title={target ? 'Zielprofil löschen?' : 'Wasserprofil löschen?'}
        confirmLabel="Löschen" destructive pending={busy} onConfirm={confirmDelete} onCancel={() => setDeleting(null)}>
        „{deleting?.name || 'Ohne Namen'}“ wird dauerhaft entfernt.
        {target ? ' Rezepte mit diesem Ziel zeigen es als fehlend.' : ' Rezepte, die es nutzen, rechnen danach mit VE-Wasser.'}
      </ConfirmModal>
    </>
  );
}

const IONS: { key: 'ca' | 'mg' | 'na' | 'k' | 'cl' | 'so4' | 'hco3'; label: string }[] = [
  { key: 'ca', label: 'Calcium' }, { key: 'mg', label: 'Magnesium' }, { key: 'na', label: 'Natrium' },
  { key: 'k', label: 'Kalium' }, { key: 'cl', label: 'Chlorid' }, { key: 'so4', label: 'Sulfat' },
  { key: 'hco3', label: 'Hydrogencarbonat' },
];

// Analyses often give hardness instead of ions; each helper fills one field.
const HELPERS: { label: string; unit: string; key: 'ca' | 'mg' | 'hco3'; factor: number }[] = [
  { label: 'KS4,3', unit: 'mmol/l', key: 'hco3', factor: HCO3_PER_KS43 },
  { label: 'Karbonathärte', unit: '°dH', key: 'hco3', factor: HCO3_PER_DH },
  { label: 'Calciumhärte', unit: '°dH', key: 'ca', factor: CA_PER_DH },
  { label: 'Magnesiumhärte', unit: '°dH', key: 'mg', factor: MG_PER_DH },
];

// A shipped profile, read-only; "Duplizieren" opens the editor with a copy.
function ProfileView({ profile: p, onClose, onDuplicate }: {
  profile: WaterProfile; onClose: () => void; onDuplicate: () => void;
}) {
  const value = (label: string, v: string) => (
    <div key={label}>
      <dt class="text-xs text-muted">{label}</dt>
      <dd class="text-sm tabular-nums">{v}</dd>
    </div>
  );
  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-lg ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="text-base font-medium text-fg">{p.name}</h2>
          <p class="mt-1 text-xs text-muted">Mitgeliefert, nicht änderbar. Zum Anpassen duplizieren.</p>
          {p.note && <p class="mt-3 text-sm">{p.note}</p>}
          <dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {IONS.map(({ key, label }) => value(label, p[key] === undefined ? '–' : `${fmtNum(p[key]!)} mg/l`))}
            {value('Restalkalität', `${fmtNum(figuresOf(stateOf(p)).raDh, 1)} °dH`)}
            {p.ph !== undefined && value('pH', fmtNum(p.ph, 2))}
          </dl>
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Schließen</button>
          <button type="button" class={btnPrimary} onClick={onDuplicate}>Duplizieren</button>
        </div>
      </div>
    </div>
  );
}

function ProfileDialog({ profile, onSave, onClose }: {
  profile: WaterProfile; onSave: (p: WaterProfile) => Promise<void>; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [p, setP] = useState(profile);
  const set = (patch: Partial<WaterProfile>) => setP({ ...p, ...patch });
  const off = ionBalance(p);
  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-lg ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="mb-4 text-base font-medium text-fg">{p.target ? 'Zielprofil' : 'Wasserprofil'}</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input class={`${inp} w-full`} value={p.name} placeholder={p.target ? 'z.B. Pils weich' : 'z.B. Leitungswasser'}
                onInput={(e) => set({ name: e.currentTarget.value })} />
            </Field>
            <Field label="Notiz">
              <input class={`${inp} w-full`} value={p.note ?? ''} placeholder="Quelle, Datum der Analyse"
                onInput={(e) => set({ note: e.currentTarget.value || undefined })} />
            </Field>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {IONS.map(({ key, label }) => (
              <Field key={key} label={label}>
                {key === 'k'
                  ? <OptNum unit="mg/l" value={p.k} onChange={(k) => set({ k })} class="w-full" />
                  : <NumInput unit="mg/l" value={p[key]} onChange={(n) => set({ [key]: n })} class="w-full" />}
              </Field>
            ))}
            <Field label="pH">
              <OptNum value={p.ph} onChange={(ph) => set({ ph })} class="w-full" />
            </Field>
          </div>
          {off > 0.1 && (
            <p class="mt-2 text-xs text-caution">
              Die Ionenbilanz weicht um {fmtNum(off * 100)} % ab. Bitte die Werte mit der Analyse vergleichen.
            </p>
          )}
          <details class="mt-4">
            <summary class="cursor-pointer text-sm">Aus Härteangaben umrechnen</summary>
            <div class="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {HELPERS.map((h) => (
                <Field key={h.label} label={h.label}>
                  <OptNum unit={h.unit} value={undefined} class="w-full"
                    onChange={(n) => { if (n !== undefined) set({ [h.key]: Math.round(n * h.factor * 10) / 10 }); }} />
                </Field>
              ))}
            </div>
            <p class="mt-2 text-xs text-muted">
              HCO₃ = KS4,3 × 61,02 bzw. Karbonathärte × 21,8; Ca = Calciumhärte × 7,14; Mg = Magnesiumhärte × 4,34.
            </p>
          </details>
          {!p.target && <p class="mt-3 text-xs text-muted">Ohne pH lässt sich der Wasser-pH nach Säure nicht berechnen.</p>}
          {failed && <p class="mt-3 text-sm text-critical">Speichern fehlgeschlagen.</p>}
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
          <button type="button" class={btnPrimary} disabled={busy}
            onClick={() => { setBusy(true); setFailed(false); onSave(p).catch(() => { setFailed(true); setBusy(false); }); }}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
