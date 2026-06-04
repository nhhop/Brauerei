// BrewControl/web/src/app.tsx
import { useEffect, useState } from 'preact/hooks';
import { Router } from 'preact-router';
import type { Snapshot } from './types';
import { getSnapshot, subscribeEvents, getSettings } from './api';
import { applyTheme, loadCachedTheme } from './theme';
import { Dashboard } from './pages/Dashboard';
import { SettingsIndex } from './pages/SettingsIndex';
import { AppearancePage } from './pages/AppearancePage';
import { DevicesPage } from './pages/DevicesPage';
import { FirmwarePage } from './pages/FirmwarePage';

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

  useEffect(() => {
    const cached = loadCachedTheme();
    if (cached) applyTheme(cached);
    getSettings()
      .then((s) => applyTheme(s.theme))
      .catch(() => {});
  }, []);

  if (rebooting) return <RebootingView />;

  return (
    <Router>
      <Dashboard path="/" snap={snap} err={err} onReset={() => setRebooting(true)} />
      <SettingsIndex path="/settings" />
      <AppearancePage path="/settings/appearance" />
      <DevicesPage path="/settings/devices" snap={snap} />
      <FirmwarePage path="/settings/firmware" />
    </Router>
  );
}

function RebootingView() {
  return (
    <div class="flex min-h-screen items-center justify-center bg-bg p-6 text-fg">
      <div class="max-w-md text-center">
        <h1 class="text-xl font-medium tracking-tight">Neustart…</h1>
        <p class="mt-3 text-sm text-muted">
          Das Gerät startet in den Setup-Modus. Mit dem WLAN
          <code class="mx-1 rounded bg-fg/10 px-1 font-mono">BrewControl-Setup</code>
          verbinden um neue Zugangsdaten einzutragen.
        </p>
      </div>
    </div>
  );
}
