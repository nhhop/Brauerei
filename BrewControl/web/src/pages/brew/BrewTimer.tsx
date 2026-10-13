import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { createProgram, controlProgram, deleteProgram, getPrograms } from '../../api';
import type { Brew } from '../../brews';
import type { ProgramConfig, ProgramStep, Snapshot } from '../../types';
import { btnPrimary, btnSecondary } from '../../ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ProgramCard } from '../../components/ProgramCard';
import type { Patch } from './PrepTab';

// A timer of the brew: a program on the device that belongs to it (`field`
// keeps its id). The card is the dashboard's; this adds starting it and taking
// it away. `summary` puts a line above the running card.
export function BrewTimer({ brew, field, build, startLabel, intro, summary, snap, editable, patch }: {
  brew: Brew;
  field: 'mashProgramId' | 'boilProgramId';
  build: () => { name: string; steps: ProgramStep[] };
  startLabel: string;
  intro: string;
  summary?: (program: ProgramConfig) => ComponentChildren;
  snap: Snapshot | null;
  editable: boolean;
  patch: Patch;
}) {
  const id = brew[field];
  const [program, setProgram] = useState<ProgramConfig | null | undefined>(undefined);  // null = gone from the device
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const refresh = () => {
    if (id) getPrograms().then((l) => setProgram(l.find((p) => p.id === id) ?? null)).catch(() => {});
  };
  useEffect(() => {
    setProgram(undefined);
    if (!id) return;
    refresh();
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [id]);

  async function run(what: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    try { await what(); } catch { setError(failure); }
    setBusy(false);
  }

  const start = () => run(async () => {
    if (id) await deleteProgram(id).catch(() => {});
    const created = await createProgram(build());
    await controlProgram(created, 'start');
    await patch((b) => ({ ...b, [field]: created }));
  }, 'Timer konnte nicht gestartet werden.');

  const remove = () => run(async () => {
    setAsking(false);
    if (id) await deleteProgram(id).catch(() => {});
    await patch((b) => {
      const rest = { ...b };
      delete rest[field];
      return rest;
    });
  }, 'Timer konnte nicht entfernt werden.');

  const active = program && ['running', 'awaiting', 'paused'].includes(program.status);
  const line = program && summary?.(program);
  return (
    <div>
      {!id || program === null ? (
        <>
          <p class="mb-2 text-sm text-muted">
            {program === null ? 'Das Programm gibt es auf dem Gerät nicht mehr. ' : ''}{intro}
          </p>
          <button type="button" class={btnPrimary} disabled={!editable || busy} onClick={start}>{startLabel}</button>
        </>
      ) : program === undefined ? (
        <p class="text-sm text-muted">Lädt …</p>
      ) : (
        <>
          {line && <p class="mb-2 text-sm">{line}</p>}
          <ProgramCard program={program} snap={snap} onChanged={refresh} />
          <button type="button" class={`${btnSecondary} mt-2`} disabled={!editable || busy}
            onClick={() => (active ? setAsking(true) : remove())}>
            {active ? 'Timer abbrechen' : 'Timer entfernen'}
          </button>
        </>
      )}
      {error && <p class="mt-2 text-sm text-critical">{error}</p>}
      <ConfirmModal open={asking} title="Timer abbrechen?" confirmLabel="Timer abbrechen" cancelLabel="Weiterlaufen lassen" destructive pending={busy}
        onConfirm={remove} onCancel={() => setAsking(false)}>
        Das Programm „{program?.name}“ wird auf dem Gerät gelöscht.
      </ConfirmModal>
    </div>
  );
}
