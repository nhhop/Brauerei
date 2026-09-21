import { useEffect, useRef, useState } from 'preact/hooks';
import type { CalibrationChannel, CalibrationInfo, CalibrationMode } from '../types';
import { calibrateSensor, clearCalibration, getCalibration } from '../api';
import { btnPrimary, btnSecondary, dialogBtnRow, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../ui';
import { Spinner } from './Spinner';

const lbl = 'mb-1 block text-xs text-muted';

const MODE_LABEL: Record<CalibrationMode, string> = {
  offset: 'Nullpunkt (Offset)',
  twopoint: 'Zwei-Punkt',
  gain: 'Faktor (Steigung)',
};

const MODE_HELP: Record<CalibrationMode, string> = {
  offset: 'Sensor auf einen bekannten Wert bringen (z. B. Eiswasser = 0 °C, leere Waage = 0) '
    + 'und diesen Wert eintragen. Die Steigung bleibt unverändert.',
  twopoint: 'Zwei bekannte Werte nacheinander messen (z. B. pH-Puffer 4 und 7, oder 0 °C und 100 °C). '
    + 'Daraus werden Nullpunkt und Steigung bestimmt.',
  gain: 'Nur die Steigung durch den Nullpunkt anpassen (z. B. der Sensor zeigt 4,6 L, '
    + 'tatsächlich waren es 5 L).',
};

const MEASURE_MS = 5000;
const MEASURE_STEP_MS = 500;

function fmt(n: number | null | undefined): string {
  return n == null || !isFinite(n) ? '—' : String(Number(n.toPrecision(6)));
}

interface PointState { raw: string; value: string }

// Calibrate one sensor: pick a channel and a method, bring the sensor into a
// known state, "Messen" averages the live raw value for a few seconds, type the
// reference value, apply. The raw value is whatever the sensor shows without
// calibration — no ADC counts needed (see CalibratedSensor in the library).
export function CalibrateModal({ open, sensorId, onClose }: {
  open: boolean;
  sensorId: string;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<CalibrationInfo | null>(null);
  const [channelKey, setChannelKey] = useState<string | null>(null);
  const [mode, setMode] = useState<CalibrationMode>('offset');
  const [points, setPoints] = useState<PointState[]>([{ raw: '', value: '' }, { raw: '', value: '' }]);
  const [measuring, setMeasuring] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const alive = useRef(true);

  // Live values: poll while the dialog is open.
  useEffect(() => {
    if (!open) return;
    alive.current = true;
    setInfo(null); setChannelKey(null); setErr(null); setDone(false); setMeasuring(null);
    setPoints([{ raw: '', value: '' }, { raw: '', value: '' }]);
    const poll = () => getCalibration(sensorId)
      .then((i) => { if (alive.current) setInfo(i); })
      .catch((e) => { if (alive.current) setErr(String(e)); });
    poll();
    const t = setInterval(poll, 1000);
    return () => { alive.current = false; clearInterval(t); };
  }, [open, sensorId]);

  const channels = info?.channels.filter((c) => c.modes.length > 0) ?? [];
  const channel: CalibrationChannel | undefined =
    channels.find((c) => c.key === channelKey) ?? channels[0];

  // Keep the chosen method valid for the channel (cumulative: gain only).
  useEffect(() => {
    if (channel && !channel.modes.includes(mode)) setMode(channel.modes[0]);
  }, [channel?.key, channel?.modes.join(',')]);

  if (!open) return null;

  const need = mode === 'twopoint' ? 2 : 1;

  function setPoint(i: number, patch: Partial<PointState>) {
    setPoints((p) => p.map((pt, j) => (j === i ? { ...pt, ...patch } : pt)));
  }

  async function measure(i: number) {
    if (!channel) return;
    setErr(null); setMeasuring(i);
    const samples: number[] = [];
    const end = Date.now() + MEASURE_MS;
    while (Date.now() < end && alive.current) {
      try {
        const c = (await getCalibration(sensorId)).channels.find((x) => x.key === channel.key);
        if (c && c.valid && c.raw != null && isFinite(c.raw)) samples.push(c.raw);
      } catch { /* a single missed sample is fine */ }
      await new Promise((r) => setTimeout(r, MEASURE_STEP_MS));
    }
    if (!alive.current) return;
    setMeasuring(null);
    if (samples.length === 0) { setErr('Kein gültiger Messwert — liefert der Sensor Daten?'); return; }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    setPoint(i, { raw: String(Number(mean.toPrecision(7))) });
  }

  async function apply() {
    if (!channel) return;
    setErr(null); setDone(false);
    const pts: { raw: number; value: number }[] = [];
    for (let i = 0; i < need; i++) {
      const raw = parseFloat(points[i].raw);
      const value = parseFloat(points[i].value);
      if (isNaN(raw) || isNaN(value)) { setErr(`Punkt ${i + 1}: Rohwert messen und Referenzwert eintragen.`); return; }
      pts.push({ raw, value });
    }
    if (mode === 'twopoint' && pts[0].raw === pts[1].raw) { setErr('Die beiden Rohwerte müssen verschieden sein.'); return; }
    if (mode === 'gain' && pts[0].raw === 0) { setErr('Der Rohwert darf für den Faktor nicht 0 sein.'); return; }
    setPending(true);
    try {
      await calibrateSensor(sensorId, { channel: channel.key, mode, points: pts });
      setDone(true);
      setInfo(await getCalibration(sensorId));
    } catch (e) {
      setErr(String(e));
    }
    setPending(false);
  }

  async function reset() {
    if (!channel) return;
    setErr(null); setDone(false); setPending(true);
    try {
      await clearCalibration(sensorId, channel.key);
      setInfo(await getCalibration(sensorId));
    } catch (e) {
      setErr(String(e));
    }
    setPending(false);
  }

  const unit = channel?.unit ? ` ${channel.unit}` : '';
  const busy = pending || measuring !== null;

  return (
    <div class={dialogScrim}
      onClick={() => { if (!busy) onClose(); }}>
      <div class={`max-h-[90vh] w-full max-w-lg ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="text-base font-medium text-fg">„{sensorId}“ kalibrieren</h2>

          {!info && !err && <div class="mt-4 flex justify-center"><Spinner size={18} /></div>}
          {info && !channel && (
            <p class="mt-3 text-sm text-muted">Dieser Sensor hat keine kalibrierbaren Kanäle.</p>
          )}

          {channel && (
            <div class="mt-3 space-y-4">
              {channels.length > 1 && (
                <div>
                  <label class={lbl}>Kanal</label>
                  <select class={`${inp} w-full`} value={channel.key}
                    onChange={(e) => setChannelKey((e.target as HTMLSelectElement).value)}>
                    {channels.map((c) => <option key={c.key} value={c.key}>{c.key || 'Wert'}</option>)}
                  </select>
                </div>
              )}

              <div class="rounded-md bg-fg/5 p-3 text-sm">
                <div class="flex justify-between">
                  <span class="text-muted">Rohwert (unkalibriert)</span>
                  <span class="font-mono tabular-nums text-fg">{channel.valid ? fmt(channel.raw) : '—'}{unit}</span>
                </div>
                <div class="mt-1 flex justify-between">
                  <span class="text-muted">Angezeigter Wert</span>
                  <span class="font-mono tabular-nums text-fg">
                    {channel.valid ? fmt(channel.value) : '—'}{unit}
                    {channel.calibrated && <span class="ml-2 text-xs text-accent">kalibriert</span>}
                  </span>
                </div>
              </div>

              <div>
                <label class={lbl}>Methode</label>
                <select class={`${inp} w-full`} value={mode}
                  onChange={(e) => setMode((e.target as HTMLSelectElement).value as CalibrationMode)}>
                  {channel.modes.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                </select>
                <p class="mt-1 text-xs text-faint">{MODE_HELP[mode]}</p>
              </div>

              {Array.from({ length: need }, (_, i) => (
                <div key={i} class="space-y-2 rounded-md border border-border p-3">
                  {need > 1 && <div class="text-xs font-medium text-muted">Punkt {i + 1}</div>}
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class={lbl}>Rohwert</label>
                      <input type="number" step="any" class={`${inp} w-full`} value={points[i].raw}
                        onInput={(e) => setPoint(i, { raw: (e.target as HTMLInputElement).value })}
                        placeholder="messen …" />
                    </div>
                    <div>
                      <label class={lbl}>Referenzwert{unit}</label>
                      <input type="number" step="any" class={`${inp} w-full`} value={points[i].value}
                        onInput={(e) => setPoint(i, { value: (e.target as HTMLInputElement).value })} />
                    </div>
                  </div>
                  <button type="button" class={btnSecondary} disabled={busy || !channel.valid}
                    onClick={() => measure(i)}>
                    {measuring === i
                      ? <><Spinner size={14} class="mr-1.5 -mt-0.5" />Messe …</>
                      : `Messen (${MEASURE_MS / 1000} s Mittelwert)`}
                  </button>
                </div>
              ))}

              <p class="text-xs text-faint">
                Hinweis: Bereits aufgezeichnete Logdaten bleiben unkalibriert — der Verlauf springt beim Kalibrieren.
              </p>
            </div>
          )}

          {err && <p class="mt-3 text-sm text-critical">{err}</p>}
          {done && !err && <p class="mt-3 text-sm text-success">Kalibrierung gespeichert.</p>}
        </div>

        <div class={dialogFooter}>
          <div class="flex w-full items-center justify-between gap-2">
            {channel?.calibrated
              ? <button type="button" class={btnSecondary} disabled={busy} onClick={reset}>Zurücksetzen</button>
              : <span />}
            <div class={dialogBtnRow}>
              <button type="button" class={btnSecondary} disabled={busy} onClick={onClose}>Schließen</button>
              {channel && (
                <button type="button" class={btnPrimary} disabled={busy} onClick={apply}>
                  {pending ? <><Spinner size={14} class="mr-1.5 -mt-0.5" />Übernehmen</> : 'Übernehmen'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
