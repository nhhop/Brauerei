import type { PinsInfo } from '../types';
import { pinStatus, type PinShare } from '../pins';

const LEVEL_CLASS = {
  ok: 'text-faint',
  warn: 'text-caution',
  error: 'text-critical',
} as const;

// One line under a GPIO input: free, shared bus, risky, taken or unusable.
// Renders nothing until the pin list has loaded or while the field is empty.
export function PinHint({ pins, value, selfId, output, share }: {
  pins: PinsInfo | null;
  value: string;
  selfId?: string;
  output?: boolean;
  share?: PinShare;
}) {
  if (!pins || value.trim() === '') return null;
  const gpio = parseInt(value, 10);
  if (isNaN(gpio)) return null;
  const s = pinStatus(pins, gpio, { selfId, output, share });
  return <p class={`mt-1 text-xs ${LEVEL_CLASS[s.level]}`}>{s.text}</p>;
}
