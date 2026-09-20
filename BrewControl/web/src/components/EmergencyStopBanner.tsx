import { useState } from 'preact/hooks';
import { OctagonX } from 'lucide-preact';
import { releaseEmergencyStop } from '../api';
import { btnDanger } from '../ui';

// Shown on every page while the emergency-stop latch is engaged. The latch
// survives a reboot, so without this the device would come back up with every
// actuator and controller silently disabled and nothing saying why.
export function EmergencyStopBanner({ active }: { active: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!active) return null;

  async function release() {
    setBusy(true);
    setErr('');
    try {
      await releaseEmergencyStop();
      // The snapshot that clears this banner arrives over SSE.
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Aufheben fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="alert"
      class="flex flex-wrap items-start gap-3 border-b border-critical/30 bg-[color-mix(in_srgb,var(--critical)_12%,transparent)] px-4 py-3">
      <OctagonX size={20} class="mt-0.5 shrink-0 text-critical" />
      {/* basis-64 is the wrap threshold: on a phone the button drops to its own
          line instead of squeezing the text into a narrow column. */}
      <div class="min-w-0 flex-1 basis-64">
        <p class="text-sm font-medium text-fg">Not-Aus aktiv</p>
        <p class="mt-0.5 text-sm text-muted">
          Alle Aktoren und Regler sind abgeschaltet, laufende Programme und Timer pausiert.
          Der Not-Aus bleibt auch nach einem Neustart bestehen, bis er hier aufgehoben wird.
          Danach müssen Aktoren, Regler, Programme und Timer einzeln wieder freigegeben werden.
        </p>
        {err && <p class="mt-1 text-sm text-critical">{err}</p>}
      </div>
      <button type="button" onClick={release} disabled={busy} class={btnDanger}>
        {busy ? 'Wird aufgehoben…' : 'Not-Aus aufheben'}
      </button>
    </div>
  );
}
