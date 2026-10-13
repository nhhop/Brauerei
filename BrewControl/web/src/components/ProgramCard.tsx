import { useEffect, useRef, useState } from 'preact/hooks';
import type { ProgramConfig, ProgramAction, ProgramStep, StepTarget, Condition, Snapshot } from '../types';
import { controlProgram, resolveRef } from '../api';
import { badge, badgeAccent, badgeCaution, badgeSuccess } from '../ui';
import { effectiveTargets, fmtTarget, programIds, targetKind } from '../program';
import { fmtDuration } from '../format';
import {
  Check, ChevronDown, ChevronUp, FileText, Pause, Pencil, Play,
  SkipBack, SkipForward, Square, Timer, Trash2, type LucideIcon,
} from 'lucide-preact';

interface Props {
  program: ProgramConfig;
  snap: Snapshot | null;
  onChanged: () => void;   // re-fetch programs after a control action
  onEdit?: () => void;
  onDelete?: () => void;
  fill?: boolean;          // stretch to full column height on desktop (single program)
  onSheetHeight?: (px: number) => void;  // mobile bottom-sheet height, for the list spacer
}

// "gravity < 1.010" — the trailing segment of the ref plus the comparison.
function condShort(c: Condition): string {
  const slash = c.ref.indexOf('/');
  const who = slash < 0 ? c.ref : c.ref.slice(slash + 1);
  return `${who} ${c.op === 'lt' ? '<' : '>'} ${c.value}`;
}

function isSensorStep(s: ProgramStep): s is ProgramStep & { cond: Condition } {
  return s.end === 'sensor' && s.cond != null;
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'Bereit',
  running: 'Läuft',
  awaiting: 'Freigabe erforderlich',
  paused: 'Pausiert',
  done: 'Fertig',
};

function statusBadgeClass(status: string): string {
  if (status === 'running') return badgeSuccess;
  if (status === 'awaiting') return badgeCaution;
  if (status === 'paused') return badgeAccent;
  return `${badge} bg-fg/10 text-muted`;
}

export function ProgramCard({ program, snap, onChanged, onEdit, onDelete, fill, onSheetHeight }: Props) {
  const { name, steps, status, currentStep, reachedStep } = program;
  // Everything the program drives; controls stay disabled while any of it is
  // gone — the runner holds the program at that point anyway.
  const ids = programIds(steps);
  const missing = ids.filter((id) => targetKind(snap, id) === 'missing');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Mobile-only accordion: collapsed by default; desktop always shows the list.
  const [expanded, setExpanded] = useState(false);
  // Live drag height (px) while the handle is being dragged; null when not dragging.
  const [liveHeight, setLiveHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; baseline: number; maxPx: number } | null>(null);

  // Report the rendered height of the fixed mobile bottom sheet so the list
  // behind it can reserve matching space — a static spacer clips the last row
  // once the sheet grows (active hero block, expanded step list).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fill || !onSheetHeight) return;
    const el = rootRef.current;
    if (!el) return;
    const report = () => onSheetHeight(matchMedia('(min-width: 1024px)').matches ? 0 : el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => { ro.disconnect(); onSheetHeight(0); };
  }, [fill, onSheetHeight]);

  function beginDrag(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const maxPx = window.innerHeight * 0.5;
    dragRef.current = { startY: e.clientY, baseline: expanded ? maxPx : 0, maxPx };
    setLiveHeight(dragRef.current.baseline);
  }
  function moveDrag(e: PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const delta = d.startY - e.clientY; // positive = dragged up
    setLiveHeight(Math.min(d.maxPx, Math.max(0, d.baseline + delta)));
  }
  function endDrag() {
    const d = dragRef.current;
    if (!d) return;
    const height = liveHeight ?? d.baseline;
    // A near-zero-movement pointer-up is a tap, not a drag — flip state instead
    // of re-applying the (unchanged) height threshold.
    if (Math.abs(height - d.baseline) < 5) setExpanded((v) => !v);
    else setExpanded(height > d.maxPx / 2);
    dragRef.current = null;
    setLiveHeight(null);
  }

  async function act(action: ProgramAction) {
    setBusy(true);
    setErr(null);
    try {
      await controlProgram(program.id, action);
      onChanged();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const active = status === 'running' || status === 'awaiting' || status === 'paused';
  const remaining = program.stepRemainingSec;
  const cur = steps[currentStep];
  const curIsSensor = active && cur ? isSensorStep(cur) : false;
  // Live reading behind the current sensor step's ref, "—" when unavailable.
  const curLiveValue = curIsSensor && snap && cur ? resolveRef(snap, cur.cond!.ref) : null;

  // Total/elapsed program time for the progress bar — approximate: a step
  // skipped early via "Weiter" still counts its full holdSec as elapsed.
  // Sensor-triggered steps have no known duration and are left out.
  const holdOf = (s: ProgramStep) => (s.end === 'sensor' ? 0 : s.holdSec);
  const totalSec = steps.reduce((sum, s) => sum + holdOf(s), 0);
  const elapsedBeforeCur = steps.slice(0, currentStep).reduce((sum, s) => sum + holdOf(s), 0);
  const curElapsed = active && cur ? Math.max(0, holdOf(cur) - (remaining ?? holdOf(cur))) : 0;
  const elapsedSec = Math.min(totalSec, elapsedBeforeCur + curElapsed);
  const progressPct = totalSec > 0 ? elapsedSec / totalSec : 0;

  // A pulse only fires on the first forward entry into its step per run, so
  // "has it fired" is: this run got at least that far.
  const ran = active || status === 'done';
  const isPulse = (id: string, t: StepTarget) => t.v !== undefined && targetKind(snap, id) === 'impulse';
  const fired = (i: number) => ran && i <= reachedStep;

  // "gaer_temp 10 °C · hopfen_dropper 1× ✓" — what step i itself sets.
  function stepTargetsText(i: number): string {
    return Object.entries(steps[i].targets)
      .map(([id, t]) => `${id} ${fmtTarget(snap, id, t)}${isPulse(id, t) && fired(i) ? ' ✓' : ''}`)
      .join(' · ');
  }

  // The state the program has built up by the current step — a step names only
  // what it changes, so its own map alone would hide e.g. a temperature set two
  // steps earlier. Pulses aren't state; the current step's own ones are listed
  // separately.
  const curState = active && cur
    ? Object.entries(effectiveTargets(steps, currentStep, snap)).filter(([id]) => targetKind(snap, id) !== 'impulse')
    : [];
  const curPulses = active && cur ? Object.entries(cur.targets).filter(([id, t]) => isPulse(id, t)) : [];

  // One-line summary shown on mobile when the list is collapsed.
  function compactSummary(): string {
    if (active && cur) {
      const tail = status === 'awaiting' ? 'Freigabe'
        : status === 'paused' ? 'pausiert'
        : isSensorStep(cur) ? `⤳ ${condShort(cur.cond)}`
        : `noch ${fmtDuration(remaining ?? 0)}`;
      return [cur.name || `Schritt ${currentStep + 1}`, stepTargetsText(currentStep), tail]
        .filter(Boolean).join(' · ');
    }
    return `${steps.length} Schritte`;
  }

  function Btn({ action, label, icon: Icon, primary, title }: {
    action: ProgramAction; label: string; icon: LucideIcon;
    primary?: boolean; title?: string;
  }) {
    return (
      <button type="button" disabled={busy || missing.length > 0} title={title}
        onClick={() => act(action)}
        class={`flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors disabled:opacity-40 ` +
          `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ` +
          (primary
            ? 'bg-accent text-accent-fg hover:bg-accent/90 active:bg-accent/80 focus-visible:ring-accent'
            : 'border border-border text-fg hover:bg-fg/5 active:bg-fg/10 focus-visible:ring-fg/30')}>
        <Icon size={16} class="shrink-0" />
        {label}
      </button>
    );
  }

  return (
    <div ref={rootRef} class={`rounded-lg border border-card-border bg-card p-4 shadow-elev-2 transition-shadow duration-200 hover:shadow-elev-8
      ${fill ? 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:m-0 ' +
        'max-lg:pb-[calc(1rem+var(--safe-b))] ' +
        'max-lg:rounded-t-lg max-lg:rounded-b-none max-lg:border-x-0 max-lg:border-b-0 max-lg:border-t max-lg:border-border ' +
        'max-lg:bg-surface-acrylic max-lg:backdrop-blur-md max-lg:shadow-elev-64 ' +
        'lg:flex lg:h-full lg:flex-col lg:overflow-hidden' : ''}`}>
      {/* Drag handle — pointer-driven only (tap or swipe); the summary row
          below (when shown) covers keyboard activation. */}
      {fill && (
        <button type="button"
          onPointerDown={beginDrag} onPointerMove={moveDrag}
          onPointerUp={endDrag} onPointerCancel={endDrag}
          title={expanded ? 'Schritte einklappen' : 'Schritte anzeigen'}
          class="-mt-1 mb-1 flex w-full touch-none items-center justify-center py-2 lg:hidden">
          <span aria-hidden class="h-1 w-9 rounded-full bg-fg/20" />
        </button>
      )}
      <div class="flex items-start justify-between gap-2">
        <div class="flex min-w-0 items-start gap-2">
          <FileText size={18} aria-hidden class="mt-0.5 shrink-0 text-muted" />
          <div class="min-w-0">
            <h3 class="truncate font-semibold text-fg">{name}</h3>
            <div class="truncate text-xs text-muted">
              Steuert:{' '}
              {ids.length === 0 ? '—' : ids.map((id, i) => (
                <span key={id}>
                  {i > 0 && ' · '}
                  <span class={`font-mono ${missing.includes(id) ? 'text-critical' : 'text-fg'}`}>{id}</span>
                  {missing.includes(id) && <span class="text-critical"> (fehlt)</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <span class={statusBadgeClass(status)}>{STATUS_LABEL[status] ?? status}</span>
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="rounded p-1 text-faint transition-colors hover:bg-fg/10 hover:text-fg">
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Aus Dashboard entfernen"
              class="rounded p-1 text-faint transition-colors hover:bg-critical/10 hover:text-critical">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Hero block — current step at a glance; only when a step is active. */}
      {active && cur && (
        <div class="mt-3">
          <p class="text-[10px] font-medium uppercase tracking-wide text-faint">
            Schritt {currentStep + 1} von {steps.length}
          </p>
          <div class="mt-0.5 flex items-start justify-between gap-3">
            <h4 class="min-w-0 truncate text-lg font-semibold text-fg sm:text-xl">
              {cur.name || `Schritt ${currentStep + 1}`}
            </h4>
            {status === 'running' && !curIsSensor && remaining != null && (
              <div class="shrink-0 text-right">
                <div class="font-mono text-2xl font-bold leading-none tabular-nums text-accent sm:text-3xl">
                  {fmtDuration(remaining)}
                </div>
                <div class="mt-0.5 text-[10px] uppercase tracking-wide text-faint">Verbleibend</div>
              </div>
            )}
            {status === 'running' && curIsSensor && cur.cond && (
              <div class="shrink-0 text-right">
                <div class="font-mono text-2xl font-bold leading-none tabular-nums text-accent sm:text-3xl">
                  {curLiveValue != null ? curLiveValue : '—'}
                </div>
                <div class="mt-0.5 text-[10px] uppercase tracking-wide text-faint">Istwert</div>
              </div>
            )}
          </div>
          {(curState.length > 0 || curPulses.length > 0) && (
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              {curState.map(([id, t]) => (
                <span key={id} title={id in cur.targets ? 'in diesem Schritt gesetzt' : 'aus einem früheren Schritt'}
                  class={`rounded px-1.5 py-0.5 text-xs ${id in cur.targets ? 'bg-accent/10 text-fg' : 'bg-fg/5 text-muted'}`}>
                  <span class="font-mono">{id}</span> {fmtTarget(snap, id, t)}
                </span>
              ))}
              {curPulses.map(([id, t]) => (
                <span key={`pulse-${id}`} title="Impulse bei Schrittbeginn"
                  class="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-fg">
                  <span class="font-mono">{id}</span> {fmtTarget(snap, id, t)}{fired(currentStep) && ' ✓'}
                </span>
              ))}
            </div>
          )}
          <p class="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
            <Timer size={14} aria-hidden class="shrink-0 text-faint" />
            {curIsSensor && cur.cond
              ? <>warten auf {condShort(cur.cond)}</>
              : <>{fmtDuration(cur.holdSec)} Dauer</>}
          </p>
          {!curIsSensor && (
            <>
              <div class="mt-2.5 h-1 overflow-hidden rounded-full bg-fg/10">
                <div class="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${Math.round(progressPct * 100)}%` }} />
              </div>
              <p class="mt-1 text-xs text-muted">{fmtDuration(elapsedSec)} / {fmtDuration(totalSec)}</p>
            </>
          )}
        </div>
      )}

      {/* Mobile accordion toggle — full-width tap target (desktop shows the
          list). Hidden while the hero block is shown above: it would just
          repeat step name/temp/remaining-time already displayed there. */}
      {!(active && cur) && (
      <button type="button" onClick={() => setExpanded((v) => !v)}
        title={expanded ? 'Schritte einklappen' : 'Schritte anzeigen'}
        class="mt-2 flex w-full items-center justify-between gap-2 rounded py-2 text-left hover:bg-fg/5 lg:hidden">
        <span class={`min-w-0 truncate text-sm ${!expanded && active ? 'font-medium text-fg' : 'text-muted'}`}>
          {expanded ? 'Schritte' : compactSummary()}
        </span>
        <span class="shrink-0 px-1 text-faint">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>
      )}

      {/* Full step list — desktop always visible; mobile clipped via max-height
          (not display:none) so the handle can drag it open smoothly. */}
      <div class={`max-lg:overflow-hidden ${liveHeight == null ? 'max-lg:transition-[max-height] max-lg:duration-200' : ''}
          ${liveHeight == null ? (expanded ? 'max-lg:max-h-[50vh]' : 'max-lg:max-h-0') : ''}
          ${fill ? 'lg:min-h-0 lg:flex-1 lg:overflow-y-auto' : ''}`}
        style={liveHeight != null ? { maxHeight: `${liveHeight}px` } : undefined}>
        <ol class="mt-3 space-y-1 max-lg:overflow-y-auto">
        {steps.map((s, i) => {
          const done = active && i < currentStep;
          const isCur = active && i === currentStep;
          const what = stepTargetsText(i);
          return (
            <li key={i} class={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
              isCur ? 'border-l-2 border-accent bg-accent/10 font-medium text-fg'
              : done ? 'text-faint'
              : 'text-muted'
            }`}>
              <span class={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                done ? 'bg-accent text-accent-fg'
                : isCur ? 'border-2 border-accent text-accent'
                : 'border border-border text-faint'
              }`}>
                {done ? <Check size={12} /> : i + 1}
              </span>
              <span class="min-w-0 flex-1">
                <span class={`block truncate ${done ? 'line-through' : ''}`}>
                  {s.name || `Schritt ${i + 1}`}
                  {s.confirm && <span class="ml-1 text-[10px] text-caution" title="Freigabe abwarten">✋</span>}
                </span>
                {what && <span class="block truncate text-[11px] font-normal text-faint">{what}</span>}
              </span>
              <span class="shrink-0 font-mono text-xs">
                {isSensorStep(s) ? condShort(s.cond) : fmtDuration(s.holdSec)}
                {isCur && !isSensorStep(s) && remaining != null && status === 'running' && (
                  <span class="ml-2 text-accent">noch {fmtDuration(remaining)}</span>
                )}
                {isCur && isSensorStep(s) && status === 'running' && (
                  <span class="ml-2 text-accent">
                    Ist {snap ? (resolveRef(snap, s.cond.ref) ?? '—') : '—'}
                  </span>
                )}
                {isCur && status === 'awaiting' && (
                  <span class="ml-2 text-caution">↳ Freigabe</span>
                )}
                {isCur && status === 'paused' && (
                  <span class="ml-2 text-accent">pausiert</span>
                )}
              </span>
            </li>
          );
        })}
        </ol>
      </div>

      <div class={`mt-3 grid grid-flow-col auto-cols-fr gap-2 ${fill ? 'lg:mt-auto lg:pt-3' : ''}`}>
        {(status === 'idle' || status === 'done') && (
          <Btn action="start" label="Start" icon={Play} primary />
        )}
        {status === 'running' && <Btn action="pause" label="Pause" icon={Pause} />}
        {status === 'paused' && <Btn action="resume" label="Fortsetzen" icon={Play} primary />}
        {active && <Btn action="prev" label="Zurück" icon={SkipBack} title="vorigen Schritt" />}
        {active && (
          <Btn action="next" label="Weiter" icon={SkipForward} primary={status === 'awaiting'}
            title="nächsten Schritt / Freigabe" />
        )}
        {active && <Btn action="stop" label="Stop" icon={Square} />}
      </div>

      {missing.length > 0 && (
        <p class="mt-2 text-xs text-critical">
          Fehlt: {missing.map((id) => id || '(nicht zugeordnet)').join(', ')} — Steuerung deaktiviert.
        </p>
      )}
      {err && <p class="mt-2 text-xs text-critical">{err}</p>}
    </div>
  );
}
