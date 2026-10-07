import { useState } from 'preact/hooks';
import { Pencil, Plus, Trash2 } from 'lucide-preact';
import type { Brewery } from '../brewhouse';
import { uid } from '../recipes';
import {
  CA_PER_DH, HCO3_PER_DH, HCO3_PER_KS43, MG_PER_DH, VE_WATER, figuresOf, ionBalance, stateOf, type WaterProfile,
} from '../waterChem';
import { badgeAccent, btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../ui';
import { Field, NumInput, OptNum } from './recipe/fields';

export const fmtNum = (n: number, digits = 0) => n.toFixed(digits).replace('.', ',');

export function profileSummary(p: WaterProfile): string {
  const f = figuresOf(stateOf(p));
  return `Ca ${fmtNum(p.ca)} · Mg ${fmtNum(p.mg)} · Na ${fmtNum(p.na)} · Cl ${fmtNum(p.cl)} · SO₄ ${fmtNum(p.so4)} · `
    + `HCO₃ ${fmtNum(p.hco3)} mg/l · RA ${fmtNum(f.raDh, 1)} °dH${p.ph === undefined ? '' : ` · pH ${fmtNum(p.ph, 2)}`}`;
}

// Section "Wasserprofile" of the brewery card: the analyses, own target profiles
// and the default water of new recipes. Edits go into the card's draft.
export function WaterProfilesSection({ brewery, onChange }: { brewery: Brewery; onChange: (b: Brewery) => void }) {
  const [editing, setEditing] = useState<WaterProfile | null>(null);
  const waters = brewery.waters ?? [];
  const sources = waters.filter((w) => !w.target);

  function commit(p: WaterProfile) {
    const exists = waters.some((w) => w.id === p.id);
    onChange({
      ...brewery, waters: exists ? waters.map((w) => (w.id === p.id ? p : w)) : [...waters, p],
      // a target is no source water
      defaultWaterId: p.target && brewery.defaultWaterId === p.id ? undefined : brewery.defaultWaterId,
    });
    setEditing(null);
  }

  function remove(id: string) {
    const rest = waters.filter((w) => w.id !== id);
    onChange({
      ...brewery, waters: rest.length > 0 ? rest : undefined,
      defaultWaterId: brewery.defaultWaterId === id ? undefined : brewery.defaultWaterId,
    });
  }

  return (
    <div class="mt-5">
      <div class="mb-2 flex items-center justify-between gap-3">
        <h3 class="text-sm font-medium">Wasserprofile</h3>
        <button type="button" onClick={() => setEditing({ id: uid(), name: '', ca: 0, mg: 0, na: 0, cl: 0, so4: 0, hco3: 0 })}
          class="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-fg/10">
          <Plus size={12} /> Profil
        </button>
      </div>
      <div class="space-y-1">
        {waters.map((p) => (
          <div key={p.id} class="flex items-center gap-3 rounded-md border border-border px-3 py-2">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm">
                {p.name || 'Ohne Namen'}
                {p.target && <span class={`ml-2 ${badgeAccent}`}>Ziel</span>}
                {p.note && <span class="ml-2 text-xs text-muted">{p.note}</span>}
              </div>
              <div class="text-xs text-muted">{profileSummary(p)}</div>
            </div>
            <button type="button" title="Profil bearbeiten" onClick={() => setEditing(p)}
              class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
              <Pencil size={14} />
            </button>
            <button type="button" title="Profil löschen" onClick={() => remove(p.id)}
              class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div class="px-3 py-1 text-xs text-muted">{VE_WATER.name}: fest eingebaut, alle Ionen 0, pH 7</div>
      </div>
      <div class="mt-3">
        <Field label="Standardwasser neuer Rezepte">
          <select class={`${inp} w-full sm:w-72`} value={brewery.defaultWaterId ?? ''}
            onChange={(e) => onChange({ ...brewery, defaultWaterId: e.currentTarget.value || undefined })}>
            <option value="">{sources.length > 0 ? `— erstes Profil (${sources[0].name || 'Ohne Namen'}) —` : `— ${VE_WATER.name} —`}</option>
            {sources.map((p) => <option key={p.id} value={p.id}>{p.name || 'Ohne Namen'}</option>)}
            <option value={VE_WATER.id}>{VE_WATER.name}</option>
          </select>
        </Field>
      </div>
      {editing && <ProfileDialog profile={editing} onSave={commit} onClose={() => setEditing(null)} />}
    </div>
  );
}

const IONS: { key: 'ca' | 'mg' | 'na' | 'k' | 'cl' | 'so4' | 'hco3'; label: string }[] = [
  { key: 'ca', label: 'Calcium' }, { key: 'mg', label: 'Magnesium' }, { key: 'na', label: 'Natrium' },
  { key: 'k', label: 'Kalium' }, { key: 'cl', label: 'Chlorid' }, { key: 'so4', label: 'Sulfat' },
  { key: 'hco3', label: 'Hydrogencarbonat' },
];

// Analyses often give hardness instead of ions; each helper fills one field.
const HELPERS: { label: string; key: 'ca' | 'mg' | 'hco3'; factor: number }[] = [
  { label: 'KS4,3 (mmol/l)', key: 'hco3', factor: HCO3_PER_KS43 },
  { label: 'Karbonathärte (°dH)', key: 'hco3', factor: HCO3_PER_DH },
  { label: 'Calciumhärte (°dH)', key: 'ca', factor: CA_PER_DH },
  { label: 'Magnesiumhärte (°dH)', key: 'mg', factor: MG_PER_DH },
];

function ProfileDialog({ profile, onSave, onClose }: {
  profile: WaterProfile; onSave: (p: WaterProfile) => void; onClose: () => void;
}) {
  const [p, setP] = useState(profile);
  const set = (patch: Partial<WaterProfile>) => setP({ ...p, ...patch });
  const off = ionBalance(p);
  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-lg ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="mb-4 text-base font-medium text-fg">Wasserprofil</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input class={`${inp} w-full`} value={p.name} placeholder="z.B. Leitungswasser"
                onInput={(e) => set({ name: e.currentTarget.value })} />
            </Field>
            <Field label="Notiz">
              <input class={`${inp} w-full`} value={p.note ?? ''} placeholder="Quelle, Datum der Analyse"
                onInput={(e) => set({ note: e.currentTarget.value || undefined })} />
            </Field>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {IONS.map(({ key, label }) => (
              <Field key={key} label={`${label} (mg/l)`}>
                {key === 'k'
                  ? <OptNum value={p.k} onChange={(k) => set({ k })} class="w-full" />
                  : <NumInput value={p[key]} onChange={(n) => set({ [key]: n })} class="w-full" />}
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
                  <OptNum value={undefined} class="w-full"
                    onChange={(n) => { if (n !== undefined) set({ [h.key]: Math.round(n * h.factor * 10) / 10 }); }} />
                </Field>
              ))}
            </div>
            <p class="mt-2 text-xs text-muted">
              HCO₃ = KS4,3 × 61,02 bzw. Karbonathärte × 21,8; Ca = Calciumhärte × 7,14; Mg = Magnesiumhärte × 4,34.
            </p>
          </details>
          <label class="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" class="mt-0.5 accent-accent" checked={!!p.target}
              onChange={(e) => set({ target: e.currentTarget.checked || undefined })} />
            <span>
              Zielprofil
              <span class="block text-xs text-muted">
                Kein Ausgangswasser, sondern ein Ziel für den Vergleich und die Automatik im Wasser-Tab.
              </span>
            </span>
          </label>
          <p class="mt-3 text-xs text-muted">Ohne pH lässt sich der Wasser-pH nach Säure nicht berechnen.</p>
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
          <button type="button" class={btnPrimary} onClick={() => onSave(p)}>Übernehmen</button>
        </div>
      </div>
    </div>
  );
}
