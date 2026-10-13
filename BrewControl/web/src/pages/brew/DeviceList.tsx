import { useEffect, useState } from 'preact/hooks';
import { enableActuator, getPrograms, writeActuator } from '../../api';
import { brewDevices } from '../../brewDevices';
import type { Brewhouse, StepKey } from '../../brewhouse';
import { controllerOwnerOf, programOwnerOf } from '../../ownership';
import { fmtInterval } from '../../program';
import type { Actuator, ProgramConfig, Snapshot } from '../../types';
import { outputPct } from '../../components/ControllerCard';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { Card } from '../recipe/fields';

// Card "Pumpen & Geräte": the brewhouse's devices of `steps` with the master
// switch of their actuator and its live state. A device a controller or a
// program drives cannot be switched here (ownership.ts), nor any while the
// emergency stop is latched.
export function DeviceList({ bh, steps, snap, active }: {
  bh: Brewhouse | undefined;
  steps: StepKey[];
  snap: Snapshot | null;
  active: boolean;             // the brew is running
}) {
  const rows = bh ? brewDevices(bh, steps) : [];
  const any = rows.length > 0;
  const [programs, setPrograms] = useState<ProgramConfig[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!any) return;
    const load = () => { getPrograms().then(setPrograms).catch(() => {}); };
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [any]);

  if (!any) return null;

  async function toggle(a: Actuator, name: string) {
    setBusy(a.id);
    setError(null);
    try {
      // A stepless actuator left at its minimum would switch on to nothing.
      if (!a.enabled && a.meta.kind === 'Continuous' && a.target <= a.meta.min) await writeActuator(a.id, a.meta.max);
      await enableActuator(a.id, !a.enabled);
    } catch { setError(`„${name}“ ließ sich nicht schalten.`); }
    setBusy(null);
  }

  return (
    <Card title="Pumpen & Geräte">
      {rows.map(({ device, uses }) => {
        const name = device.name || 'Ohne Namen';
        const a = snap?.actuators.find((x) => x.id === device.actuator);
        const ctrl = a && snap ? controllerOwnerOf(snap.controllers, a.id) : undefined;
        const prog = a && !ctrl?.enabled ? programOwnerOf(programs, a.id) : undefined;
        const owner = ctrl?.enabled ? `Regler „${ctrl.label ?? ctrl.id}“` : prog ? `Programm „${prog.name}“` : undefined;
        // An interval schedule switches the output on and off by itself; its
        // level is what it is set to, not where the cycle happens to be.
        const pct = outputPct(a?.interval && a.enabled ? { ...a, state: { ...a.state, v: a.target } } : a);
        const on = !!a && a.enabled && (pct === null || pct > 0);
        const block = owner ? `Wird von ${owner} gesteuert` : snap?.estop ? 'Not-Aus aktiv' : !active ? 'Nur während der Sud läuft' : undefined;
        return (
          <div key={device.id} class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2 last:border-b-0">
            <div class="min-w-[9rem] flex-1">
              <div class="text-sm">{name}</div>
              <div class="text-xs text-muted">{uses.join(' · ')}</div>
              {!a && snap && <div class="text-xs text-caution">Aktor „{device.actuator}“ fehlt in der Registry.</div>}
              {owner && <div class="text-xs text-muted">gesteuert von {owner}</div>}
            </div>
            {a && (
              <>
                <span class="flex w-16 items-center gap-2 text-sm" title={a.interval ? `Intervall ${fmtInterval(a.interval)}` : undefined}>
                  <span class={`h-2.5 w-2.5 rounded-full ${on ? 'bg-accent' : 'bg-fg/20'}`} />
                  <span class={on ? 'font-medium' : 'text-muted'}>
                    {a.meta.kind === 'Binary' || pct === null ? (on ? 'an' : 'aus') : `${Math.round(on ? pct : 0)} %`}
                  </span>
                </span>
                <ToggleSwitch checked={a.enabled} disabled={!!block || busy === a.id}
                  title={block ?? `${name} ${a.enabled ? 'ausschalten' : 'einschalten'}`}
                  onChange={() => toggle(a, name)} />
              </>
            )}
          </div>
        );
      })}
      {error && <p class="mt-2 text-sm text-critical">{error}</p>}
    </Card>
  );
}
