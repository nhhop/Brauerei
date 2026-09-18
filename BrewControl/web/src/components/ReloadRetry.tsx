// BrewControl/web/src/components/ReloadRetry.tsx
import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { btnSecondary } from '../ui';

// Reboot-wait screen with auto-reconnect — ported from the captive portal's
// afterSaved() (firmware/src/WiFiSetupPortal.cpp): probe targetUrl every
// retrySecs via a no-cors fetch (an opaque response still resolves, so this
// only needs the board to answer at all) and jump there on the first success.
// The manual fallback stays visible throughout in case auto-reload never
// fires (e.g. a captive-portal-style network change the browser doesn't
// follow automatically).
export function ReloadRetry({ title, body, targetUrl, retrySecs = 5 }: {
  title: string;
  body: ComponentChildren;
  // Omit when there's no reachable redirect target (e.g. WLAN reset drops
  // the device off the current network) — renders the message only, no retry.
  targetUrl?: string;
  retrySecs?: number;
}) {
  const [attempt, setAttempt] = useState(0);
  const [countdown, setCountdown] = useState(retrySecs);
  const sameOrigin = targetUrl != null && new URL(targetUrl, location.href).origin === location.origin;
  const reconnect = () => { if (targetUrl) { if (sameOrigin) location.reload(); else location.href = targetUrl; } };

  useEffect(() => {
    if (!targetUrl) return;
    const countdownTimer = setInterval(() => setCountdown((c) => c - 1), 1000);
    const probeTimer = setInterval(async () => {
      setAttempt((a) => a + 1);
      setCountdown(retrySecs);
      try {
        await fetch(targetUrl, { mode: 'no-cors' });
        clearInterval(countdownTimer);
        clearInterval(probeTimer);
        reconnect();
      } catch {
        // not reachable yet
      }
    }, retrySecs * 1000);
    return () => { clearInterval(countdownTimer); clearInterval(probeTimer); };
  }, [targetUrl, retrySecs]);

  return (
    <div class="flex min-h-full items-center justify-center bg-bg p-6 text-fg">
      <div class="max-w-md text-center">
        <h1 class="text-xl font-medium tracking-tight">{title}</h1>
        <div class="mt-3 text-sm text-muted">{body}</div>
        {targetUrl && (
          <div class="mt-4 space-y-2">
            <p class="text-xs text-faint">Nächster Versuch in {countdown}s (Versuch {attempt})</p>
            {sameOrigin ? (
              <button type="button" onClick={reconnect} class={btnSecondary}>Jetzt neu laden</button>
            ) : (
              <a href={targetUrl} class="block text-sm text-accent underline">{targetUrl}</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
