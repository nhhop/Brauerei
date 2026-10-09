import { useEffect, useState } from 'preact/hooks';
import type { PinsInfo } from '../types';
import { availableCaps, gpioChannels, isChannelRef } from '../pins';
import { PinHint } from './PinHint';

const segBtn = (active: boolean) =>
  `flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
    active ? 'bg-accent text-accent-fg' : 'bg-fg/5 text-muted hover:bg-fg/10'
  }`;

// Pin field of a DigitalOutput/DigitalInput: a GPIO of the chip or — where a
// port expander exists — one of its pins ("<device>:<n>"), picked from a list
// like the DAC output of an AnalogOutput. value is the field as text.
export function DigitalPinField({ pins, value, onChange, selfId, output, pullup, placeholder, inputClass, labelClass }: {
  pins: PinsInfo | null;
  value: string;
  onChange: (v: string) => void;
  selfId?: string;
  output?: boolean;
  pullup?: boolean;
  placeholder: string;
  inputClass: string;
  labelClass: string;
}) {
  const hasExpander = availableCaps(pins).has('gpio');
  const channels = gpioChannels(pins, selfId);
  const [source, setSource] = useState<'gpio' | 'expander'>(isChannelRef(value) ? 'expander' : 'gpio');
  // An edited item's config arrives after the first render.
  useEffect(() => {
    if (isChannelRef(value)) setSource('expander');
  }, [value]);

  // Keep the value only if it fits the new source; otherwise preselect the
  // first free expander pin, or clear a ref when going back to GPIO.
  function pick(s: 'gpio' | 'expander') {
    setSource(s);
    if (s === 'expander' && !channels.some((o) => o.value === value)) {
      onChange(channels.find((o) => !o.taken)?.value ?? '');
    } else if (s === 'gpio' && isChannelRef(value)) {
      onChange('');
    }
  }

  return (
    <div>
      {(hasExpander || source === 'expander') && (
        <div class="mb-2 flex gap-2">
          <button type="button" onClick={() => pick('gpio')} class={segBtn(source === 'gpio')}>GPIO</button>
          <button type="button" onClick={() => pick('expander')} class={segBtn(source === 'expander')}>
            Port-Expander
          </button>
        </div>
      )}
      {source === 'expander' && pins ? (
        <>
          <label class={labelClass}>Port-Expander-Pin</label>
          {channels.length === 0 ? (
            <p class="text-xs text-caution">
              Kein Port-Expander vorhanden — einen unter{' '}
              <a href="/settings/peripherals" class="underline">Einstellungen → Peripheriegeräte</a> anlegen.
            </p>
          ) : (
            <select value={value} class={inputClass} required
              onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
              {!channels.some((o) => o.value === value) && <option value="">— wählen —</option>}
              {channels.map((o) => (
                <option key={o.value} value={o.value} disabled={!!o.taken}>
                  {o.label}{o.taken ? ` – ${o.taken}` : ''}
                </option>
              ))}
            </select>
          )}
        </>
      ) : (
        <>
          <label class={labelClass}>GPIO Pin</label>
          <input type="number" value={value}
            onInput={(e) => onChange((e.target as HTMLInputElement).value)}
            placeholder={placeholder} class={inputClass} required />
          <PinHint pins={pins} value={value} selfId={selfId} output={output} pullup={pullup} suggest
            onPick={(g) => onChange(String(g))}
            expander={hasExpander} onPickRef={(r) => { setSource('expander'); onChange(r); }} />
        </>
      )}
    </div>
  );
}
