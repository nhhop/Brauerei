import type { PinsInfo } from '../types';
import { channelStatus, gpioChannels, isChannelRef, pinStatus, suggestPins, type PinNeeds } from '../pins';

const LEVEL_CLASS = {
  ok: 'text-faint',
  warn: 'text-caution',
  error: 'text-critical',
} as const;

const MAX_SUGGESTIONS = 8;

// One line under a GPIO input: free, risky, taken or unusable. Renders
// nothing until the pin list has loaded or while the field is empty. With
// suggest, also renders a row of clickable pin suggestions — free pins first,
// risky ones dimmed; picking one calls onPick. With expander (a field that
// also takes port-expander pins), free expander pins follow as a group of
// their own, labelled by channel name; picking one calls onPickRef. A value
// that is a channel ref gets the channel's status instead of a GPIO's.
export function PinHint({ pins, value, selfId, output, analog, pullup, irq, rtc, suggest, exclude, onPick, expander, onPickRef }: {
  pins: PinsInfo | null;
  value: string;
  selfId?: string;
  output?: boolean;
  suggest?: boolean;
  exclude?: number[];
  onPick?: (gpio: number) => void;
  expander?: boolean;
  onPickRef?: (ref: string) => void;
} & PinNeeds) {
  const needs: PinNeeds = { analog, pullup, irq, rtc };
  const suggestions = suggest
    ? suggestPins(pins, { selfId, output, exclude, ...needs }).slice(0, MAX_SUGGESTIONS)
    : [];
  const allChannels = suggest && expander ? gpioChannels(pins, selfId) : [];
  const channels = allChannels.filter((c) => !c.taken).slice(0, MAX_SUGGESTIONS);
  // With a single expander the channel name alone ("P05") is unambiguous.
  const oneDevice = new Set(allChannels.map((c) => c.value.slice(0, c.value.lastIndexOf(':')))).size <= 1;

  const trimmed = value.trim();
  const ref = isChannelRef(trimmed);
  const gpio = trimmed === '' || ref ? NaN : parseInt(trimmed, 10);
  const hint = !pins ? null
    : ref ? channelStatus(pins, trimmed, selfId)
    : !isNaN(gpio) ? pinStatus(pins, gpio, { selfId, output, ...needs })
    : null;

  if (!hint && suggestions.length === 0 && channels.length === 0) return null;
  return (
    <>
      {hint && <p class={`mt-1 text-xs ${LEVEL_CLASS[hint.level]}`}>{hint.text}</p>}
      {suggestions.length > 0 && (
        <div class="mt-1 flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button key={s.gpio} type="button" onClick={() => onPick?.(s.gpio)}
              class={`rounded px-1.5 py-0.5 text-xs font-mono border ${
                s.level === 'warn' ? 'border-caution/40 text-caution' :
                'border-fg/10 bg-fg/5 text-muted hover:bg-fg/10'
              }`}>
              {s.gpio}
            </button>
          ))}
        </div>
      )}
      {channels.length > 0 && (
        <div class="mt-1 flex flex-wrap items-center gap-1">
          <span class="text-xs text-faint">Port-Expander:</span>
          {channels.map((c) => (
            <button key={c.value} type="button" onClick={() => onPickRef?.(c.value)} title={c.label}
              class="rounded-full px-2 py-0.5 text-xs font-mono border border-accent/30 text-accent hover:bg-accent/10">
              {oneDevice ? c.label.slice(c.label.lastIndexOf(' · ') + 3) : c.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
