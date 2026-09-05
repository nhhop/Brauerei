// BrewControl/web/src/components/LoginModal.tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { login } from '../api';
import { btnPrimary, btnSecondary, dialogFrame, dialogFooter, dialogBtnRow, inp } from '../ui';
import { Spinner } from './Spinner';

// Shown when the device rejected a write with 401 — either it grew a password
// while this tab was open, or the session expired. Reading stays open, so
// dismissing without logging in is a legitimate choice.
export function LoginModal({
  open, onSuccess, onDismiss,
}: {
  open: boolean; onSuccess: () => void; onDismiss: () => void;
}) {
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else { setPassword(''); setErr(null); }
  }, [open]);

  if (!open) return null;

  async function submit(e: Event) {
    e.preventDefault();
    if (!password || pending) return;
    setPending(true);
    setErr(null);
    try {
      await login(password);
      setPassword('');
      onSuccess();
    } catch {
      setErr('Falsches Passwort.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => { if (!pending) onDismiss(); }}>
      <form class={`w-full max-w-md ${dialogFrame}`}
        onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div class="p-5">
          <h2 class="text-base font-medium text-fg">Anmelden</h2>
          <p class="mt-2 text-sm text-muted">
            Dieses Gerät ist passwortgeschützt. Zum Ändern von Werten bitte anmelden —
            Anzeigen funktioniert auch ohne.
          </p>
          <input ref={inputRef} type="password" class={`${inp} mt-4`} value={password}
            autocomplete="current-password" placeholder="Gerätepasswort"
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />
          {err && <div class="mt-2 text-sm text-critical">{err}</div>}
        </div>
        <div class={dialogFooter}>
          <div class={`w-full ${dialogBtnRow}`}>
            <button type="button" onClick={onDismiss} disabled={pending} class={btnSecondary}>
              Später
            </button>
            <button type="submit" disabled={pending || !password} class={btnPrimary}>
              {pending ? <><Spinner size={14} class="mr-1.5 -mt-0.5" />Anmelden</> : 'Anmelden'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
