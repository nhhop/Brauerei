import { useEffect, useState } from 'preact/hooks';
import { Router } from 'preact-router';
import type { Snapshot } from './types';
import { getSnapshot, subscribeEvents } from './api';
import { Dashboard } from './pages/Dashboard';
import { SettingsPage } from './pages/SettingsPage';

function useSnapshot() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSnapshot()
      .then((s) => { if (alive) setSnap(s); })
      .catch((e) => { if (alive) setErr(String(e)); });
    const unsub = subscribeEvents((s) => { if (alive) setSnap(s); });
    return () => { alive = false; unsub(); };
  }, []);

  return { snap, err };
}

export function App() {
  const [rebooting, setRebooting] = useState(false);
  const { snap, err } = useSnapshot();

  if (rebooting) return <RebootingView />;

  return (
    <Router>
      <Dashboard path="/" snap={snap} err={err} onReset={() => setRebooting(true)} />
      <SettingsPage path="/settings" snap={snap} />
    </Router>
  );
}

function RebootingView() {
  return (
    <div class="flex min-h-screen items-center justify-center bg-stone-50 p-6 text-stone-900">
      <div class="max-w-md text-center">
        <h1 class="text-xl font-medium tracking-tight">Neustart…</h1>
        <p class="mt-3 text-sm text-stone-600">
          Das Gerät startet in den Setup-Modus. Mit dem WLAN
          <code class="mx-1 rounded bg-stone-100 px-1 font-mono">BrewControl-Setup</code>
          verbinden um neue Zugangsdaten einzutragen.
        </p>
      </div>
    </div>
  );
}
