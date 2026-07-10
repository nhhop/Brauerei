// BrewControl/web/src/app.tsx
import { useEffect, useState } from 'preact/hooks';
import { Router } from 'preact-router';
import type { Snapshot } from './types';
import { getSnapshot, subscribeEvents, getSettings } from './api';
import { applyTheme, loadCachedTheme } from './theme';
import { NavShell } from './components/NavShell';
import { Dashboard } from './pages/Dashboard';
import { SettingsIndex } from './pages/SettingsIndex';
import { AppearancePage } from './pages/AppearancePage';
import { DevicesPage } from './pages/DevicesPage';
import { FirmwarePage } from './pages/FirmwarePage';
import { BackupPage } from './pages/BackupPage';
import { TimePage } from './pages/TimePage';
import { NetworkPage } from './pages/NetworkPage';
import { LogsPage } from './pages/LogsPage';
import { ArchivePage } from './pages/ArchivePage';

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
  const { snap, err } = useSnapshot();

  useEffect(() => {
    const cached = loadCachedTheme();
    if (cached) applyTheme(cached);
    getSettings()
      .then((s) => applyTheme(s.theme))
      .catch(() => {});
  }, []);

  return (
    <NavShell>
      <Router>
        <Dashboard path="/" snap={snap} err={err} />
        <SettingsIndex path="/settings" />
        <AppearancePage path="/settings/appearance" />
        <DevicesPage path="/settings/devices" snap={snap} />
        <FirmwarePage path="/settings/firmware" />
        <BackupPage path="/settings/backup" />
        <TimePage path="/settings/time" />
        <NetworkPage path="/settings/network" />
        <LogsPage path="/settings/logs" snap={snap} />
        <ArchivePage path="/settings/logs/:id/archive" />
      </Router>
    </NavShell>
  );
}
