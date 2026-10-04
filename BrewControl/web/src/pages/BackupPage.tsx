import { useRef, useState } from 'preact/hooks';
import { downloadBackup, restoreBackup } from '../api';
import { useModule } from '../optionalModules';
import { exportRecipes, importRecipes } from '../recipes';
import { ConfirmModal } from '../components/ConfirmModal';
import { ReloadRetry } from '../components/ReloadRetry';
import { PageShell } from '../components/PageShell';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { btnSecondary } from '../ui';
import { TriangleAlert, Download, Upload } from 'lucide-preact';

function saveJson(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function BackupPage(_: { path?: string }) {
  const hasRecipes = useModule('recipes');
  const [recipeFile, setRecipeFile] = useState<File | null>(null);
  const [recipeBusy, setRecipeBusy] = useState(false);
  const [recipeMsg, setRecipeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const recipeFileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const clearFileInput = () => { if (fileRef.current) fileRef.current.value = ''; };

  if (done) {
    return (
      <ReloadRetry title="Neustart…"
        body="Konfiguration wiederhergestellt. Das Gerät startet neu."
        targetUrl={location.origin} />
    );
  }

  const confirmRestore = async () => {
    if (!pendingFile) return;
    setRestoring(true);
    setError(null);
    try {
      const text = await pendingFile.text();
      await restoreBackup(text);
      setDone(true);
    } catch (e) {
      setError(String(e));
      setRestoring(false);
      setPendingFile(null);
      clearFileInput();
    }
  };

  const closeRecipeDialog = () => {
    setRecipeFile(null);
    if (recipeFileRef.current) recipeFileRef.current.value = '';
  };

  const exportRecipeFile = async () => {
    setRecipeBusy(true);
    setRecipeMsg(null);
    try {
      saveJson(await exportRecipes(), `brewcontrol-recipes-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (e) {
      setRecipeMsg({ ok: false, text: `Fehler: ${e}` });
    }
    setRecipeBusy(false);
  };

  const confirmRecipeImport = async () => {
    if (!recipeFile) return;
    setRecipeBusy(true);
    try {
      const n = await importRecipes(await recipeFile.text());
      setRecipeMsg({ ok: true, text: `${n} Rezepte eingespielt.` });
    } catch (e) {
      setRecipeMsg({ ok: false, text: `Fehler: ${e}` });
    }
    setRecipeBusy(false);
    closeRecipeDialog();
  };

  return (
    <PageShell>
      <header>
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Backup & Restore' }]} />
      </header>

      <div class="mt-6">
        <SettingsGroup>
          <SettingsCard title="Export" icon={Download}
            desc="Lädt die gesamte Konfiguration (Geräte, Dashboards, Einstellungen) als JSON-Datei herunter."
            control={
              <button onClick={() => downloadBackup().catch((e) => setError(String(e)))}
                disabled={restoring} class={btnSecondary}>
                Backup herunterladen
              </button>
            } />

          <SettingsCard title="Restore" icon={Upload} desc="Konfiguration aus einer Backup-Datei wiederherstellen."
            control={
              <button type="button" class={btnSecondary} onClick={() => fileRef.current?.click()}>
                Durchsuchen…
              </button>
            }>
            <div class="space-y-2">
              <div class="flex items-center gap-2 rounded-md border border-caution/40 bg-[color-mix(in_srgb,var(--caution)_12%,transparent)] px-3 py-2 text-sm text-caution">
                <TriangleAlert size={16} class="shrink-0" /> Überschreibt die komplette Konfiguration und startet das Gerät neu.
              </div>
              <input type="file" accept=".json,application/json" ref={fileRef}
                class="hidden"
                onChange={(e) => {
                  const f = (e.currentTarget as HTMLInputElement).files?.[0];
                  if (f) setPendingFile(f);
                }} />
              {error && <div class="text-sm text-critical">Fehler: {error}</div>}
            </div>
          </SettingsCard>
        </SettingsGroup>

        {hasRecipes && (
          <div class="mt-6">
            <SettingsGroup>
              <SettingsCard title="Rezepte exportieren" icon={Download}
                desc="Das Backup oben enthält keine Rezepte. Lädt alle Rezepte der SD-Karte als eigene JSON-Datei herunter."
                control={
                  <button onClick={exportRecipeFile} disabled={recipeBusy} class={btnSecondary}>
                    Rezepte herunterladen
                  </button>
                } />
              <SettingsCard title="Rezepte importieren" icon={Upload}
                desc="Rezepte aus einer Rezept-Datei zurückspielen. Rezepte mit gleicher ID werden überschrieben, das Gerät startet nicht neu."
                control={
                  <button type="button" class={btnSecondary} disabled={recipeBusy}
                    onClick={() => recipeFileRef.current?.click()}>
                    Durchsuchen…
                  </button>
                }>
                <input type="file" accept=".json,application/json" ref={recipeFileRef} class="hidden"
                  onChange={(e) => {
                    const f = (e.currentTarget as HTMLInputElement).files?.[0];
                    if (f) { setRecipeMsg(null); setRecipeFile(f); }
                  }} />
                {recipeMsg && (
                  <div class={`text-sm ${recipeMsg.ok ? '' : 'text-critical'}`}>{recipeMsg.text}</div>
                )}
              </SettingsCard>
            </SettingsGroup>
          </div>
        )}
      </div>

      <ConfirmModal open={recipeFile !== null} title="Rezepte importieren?"
        confirmLabel="Importieren" cancelLabel="Abbrechen"
        pending={recipeBusy}
        onCancel={() => { if (!recipeBusy) closeRecipeDialog(); }}
        onConfirm={confirmRecipeImport}>
        Die Rezepte aus <span class="font-mono">{recipeFile?.name}</span> werden auf das Gerät
        geschrieben. Rezepte mit gleicher ID werden überschrieben.
      </ConfirmModal>

      <ConfirmModal open={pendingFile !== null} title="Backup wiederherstellen?"
        confirmLabel="Wiederherstellen" cancelLabel="Abbrechen" destructive
        pending={restoring}
        onCancel={() => { if (!restoring) { setPendingFile(null); clearFileInput(); } }}
        onConfirm={confirmRestore}>
        Die Datei <span class="font-mono">{pendingFile?.name}</span> ersetzt die
        komplette Konfiguration. Das Gerät startet danach neu.
      </ConfirmModal>
    </PageShell>
  );
}
