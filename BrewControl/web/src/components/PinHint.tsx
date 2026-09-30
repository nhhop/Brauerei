import type { PinsInfo } from '../types';
import { pinStatus, suggestPins, type PinNeeds } from '../pins';

const LEVEL_CLASS = {
  ok: 'text-faint',
  warn: 'text-caution',
  error: 'text-critical',
} as const;

const MAX_SUGGESTIONS = 8;

// One line under a GPIO input: free, risky, taken or unusable. Renders
// nothing until the pin list has loaded or while the field is empty. With
// suggest, also renders a row of clickable pin suggestions — free pins first,
// risky ones dimmed; picking one calls onPick.
export function PinHint({ pins, value, selfId, output, analog, pullup, irq, suggest, exclude, onPick }: {
  pins: PinsInfo | null;
  value: string;
  selfId?: string;
  output?: boolean;
  suggest?: boolean;
  exclude?: number[];
  onPick?: (gpio: number) => void;
} & PinNeeds) {
  const needs: PinNeeds = { analog, pullup, irq };
  const suggestions = suggest
    ? suggestPins(pins, { selfId, output, exclude, ...needs }).slice(0, MAX_SUGGESTIONS)
    : [];

  const trimmed = value.trim();
  const gpio = trimmed === '' ? NaN : parseInt(trimmed, 10);
  const hint = pins && !isNaN(gpio) ? pinStatus(pins, gpio, { selfId, output, ...needs }) : null;

  if (!hint && suggestions.length === 0) return null;
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
    </>
  );
}
