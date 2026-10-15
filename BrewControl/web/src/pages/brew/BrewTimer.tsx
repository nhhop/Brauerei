import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { createProgram, controlProgram, deleteProgram, getPrograms } from '../../api';
import type { Brew } from '../../brews';
import { programIds } from '../../program';
import type { ProgramConfig, ProgramStep, Snapshot } from '../../types';
import { btnPrimary, btnSecondary } from '../../ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ProgramCard } from '../../components/ProgramCard';
import type { Patch } from './PrepTab';

export const isActive = (p: ProgramConfig) => p.status === 'running' || p.status === 'awaiting' || p.status === 'paused';

// Takes a brew's program off the device. One still running is stopped first,
// which switches off what it drives; a finished one is only deleted.
export async function dropProgram(id: string) {
  const p = (await getPrograms().catch(() => [])).find((x) => x.id === id);
  if (p && isActive(p)) await controlProgram(id, 'stop');
  await deleteProgram(id).catch(() => {});
}

// A timer of the brew: a program on the device that belongs to it (`field`
// keeps its id). The card is the dashboard's; this adds starting it and taking
// it away. `summary` puts a line above the running card. `confirmStart` asks
// before a program that heats at once is started; `watch` sees every poll.
export function BrewTimer({ brew, field, build, startLabel, intro, summary, confirmStart, canStart = true, watch, snap, editable, patch }: {
  brew: Brew;
  field: 'mashProgramId' | 'boilProgramId' | 'fermentProgramId';
  build: () => { name: string; steps: ProgramStep[] };
  startLabel: string;
  intro: string;
  summary?: (program: ProgramConfig) => ComponentChildren;
  confirmStart?: string;
  canStart?: boolean;
  watch?: (program: ProgramConfig) => void;
  snap: Snapshot | null;
  editable: boolean;
  patch: Patch;
}) {
  const id = brew[field];
  const [program, setProgram] = useState<ProgramConfig | null | undefined>(undefined);  // null = gone from the device
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<'start' | 'remove' | null>(null);

  const refresh = () => {
    if (!id) return;
    getPrograms().then((l) => {
      const p = l.find((x) => x.id === id) ?? null;
      setProgram(p);
      if (p) watch?.(p);
    }).catch(() => {});
  };
  useEffect(() => {
    setProgram(undefined);
    if (!id) return;
    refresh();
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [id]);

  async function run(what: () => Promise<void>, failure: string) {
    setAsking(null);
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
    if (id) await dropProgram(id);
    await patch((b) => {
      const rest = { ...b };
      delete rest[field];
      return rest;
    });
  }, 'Timer konnte nicht entfernt werden.');

  const active = program && isActive(program);
  const drives = !!program && programIds(program.steps).length > 0;
  const line = program && summary?.(program);
  return (
    <div>
      {!id || program === null ? (
        <>
          <p class="mb-2 text-sm text-muted">
            {program === null ? 'Das Programm gibt es auf dem Gerät nicht mehr. ' : ''}{intro}
          </p>
          <button type="button" class={btnPrimary} disabled={!editable || !canStart || busy}
            onClick={() => (confirmStart ? setAsking('start') : start())}>{startLabel}</button>
        </>
      ) : program === undefined ? (
        <p class="text-sm text-muted">Lädt …</p>
      ) : (
        <>
          {line && <p class="mb-2 text-sm">{line}</p>}
          <ProgramCard program={program} snap={snap} onChanged={refresh} />
          <button type="button" class={`${btnSecondary} mt-2`} disabled={!editable || busy}
            onClick={() => (active ? setAsking('remove') : remove())}>
            {active ? 'Timer abbrechen' : 'Timer entfernen'}
          </button>
        </>
      )}
      {error && <p class="mt-2 text-sm text-critical">{error}</p>}
      <ConfirmModal open={asking === 'remove'} title="Timer abbrechen?" confirmLabel="Timer abbrechen" cancelLabel="Weiterlaufen lassen" destructive pending={busy}
        onConfirm={remove} onCancel={() => setAsking(null)}>
        Das Programm „{program?.name}“ wird auf dem Gerät {drives ? 'gestoppt und gelöscht. Was es steuert, wird ausgeschaltet.' : 'gelöscht.'}
      </ConfirmModal>
      <ConfirmModal open={asking === 'start'} title={`${startLabel}?`} confirmLabel={startLabel} pending={busy}
        onConfirm={start} onCancel={() => setAsking(null)}>
        {confirmStart}
      </ConfirmModal>
    </div>
  );
}
