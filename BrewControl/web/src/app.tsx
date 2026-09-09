// BrewControl/web/src/app.tsx
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Router } from 'preact-router';
import type { Alert, AlarmConfig, Severity, Snapshot } from './types';
import { getSnapshot, subscribeEvents, getSettings, getAlarms, getAlerts, clearAlerts } from './api';
import { applyTheme, loadCachedTheme } from './theme';
import { NavShell } from './components/NavShell';
import { LoginModal } from './components/LoginModal';
import { AlertCenter } from './components/AlertCenter';
import { Dashboard } from './pages/Dashboard';
import { ProfilesPage } from './pages/ProfilesPage';
import { SettingsIndex } from './pages/SettingsIndex';
import { ConnectivityPage } from './pages/ConnectivityPage';
import { AppearancePage } from './pages/AppearancePage';
import { DevicesPage } from './pages/DevicesPage';
import { FirmwarePage } from './pages/FirmwarePage';
import { BackupPage } from './pages/BackupPage';
import { TimePage } from './pages/TimePage';
import { NetworkPage } from './pages/NetworkPage';
import { MqttPage } from './pages/MqttPage';
import { WebhookPage } from './pages/WebhookPage';
import { EspNowPage } from './pages/EspNowPage';
import { LogsPage } from './pages/LogsPage';
import { ArchivePage } from './pages/ArchivePage';
import { AlarmsPage } from './pages/AlarmsPage';
import { FilesPage } from './pages/FilesPage';
import { SecurityPage } from './pages/SecurityPage';
import { NotificationsPage } from './pages/NotificationsPage';

const MAX_HISTORY = 60;

// Snapshot plus the alert stream: both ride the same EventSource, because each
// connection costs the device an SSE client slot.
//
// The stream replays nothing, and the device drops pushes silently when a
// client's queue is full — so on every (re)connect we refetch the history from
// the highest seq we have. Only alerts that arrive over SSE become toasts; the
// catch-up fetch fills the list quietly, or a reconnect would flood the screen.
function useLiveState() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [alarms, setAlarms] = useState<AlarmConfig[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);   // newest first
  const [toasts, setToasts] = useState<Alert[]>([]);
  const lastSeq = useRef(0);

  function ingest(incoming: Alert[]) {
    if (incoming.length === 0) return;
    setAlerts((prev) => {
      const seen = new Set(prev.map((a) => a.seq));
      const fresh = incoming.filter((a) => !seen.has(a.seq));
      if (fresh.length === 0) return prev;
      return [...fresh].concat(prev).sort((a, b) => b.seq - a.seq).slice(0, MAX_HISTORY);
    });
    for (const a of incoming) lastSeq.current = Math.max(lastSeq.current, a.seq);
  }

  useEffect(() => {
    let alive = true;

    getSnapshot()
      .then((s) => { if (alive) setSnap(s); })
      .catch((e) => { if (alive) setErr(String(e)); });
    getAlarms().then((a) => { if (alive) setAlarms(a); }).catch(() => {});

    const unsub = subscribeEvents(
      (s) => { if (alive) setSnap(s); },
      (a) => {
        if (!alive) return;
        ingest([a]);
        setToasts((t) => [a, ...t].slice(0, 5));
        // The latch state a card badge reads lives on the rule, so keep it in
        // step with the edge that just arrived.
        if (a.kind === 'threshold' && a.rule) {
          setAlarms((as) => as.map((r) => r.id === a.rule
            ? { ...r, active: a.state === 'raised', since: a.state === 'raised' ? a.ts : 0 }
            : r));
        }
      },
      () => {
        if (!alive) return;
        // seq restarts at 1 after a device reboot; a cursor beyond the newest
        // alert would hide everything, so fall back to a full fetch.
        getAlerts(lastSeq.current)
          .then((list) => {
            if (!alive) return;
            if (list.length === 0 && lastSeq.current > 0) {
              lastSeq.current = 0;
              return getAlerts(0).then((all) => { if (alive) ingest(all); });
            }
            ingest(list);
          })
          .catch(() => {});
        getAlarms().then((a) => { if (alive) setAlarms(a); }).catch(() => {});
      },
    );

    return () => { alive = false; unsub(); };
  }, []);

  function dropToast(seq: number) {
    setToasts((t) => t.filter((a) => a.seq !== seq));
  }

  async function clearHistory() {
    await clearAlerts().catch(() => {});
    setAlerts([]);
    setToasts([]);
  }

  return { snap, err, alarms, alerts, toasts, dropToast, clearHistory };
}

export function App() {
  const { snap, err, alarms, alerts, toasts, dropToast, clearHistory } = useLiveState();
  const [locked, setLocked] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);

  // Active threshold alarms keyed by the ref they watch, for the card badges.
  // Critical wins when two rules point at the same value.
  const alarmByRef = useMemo(() => {
    const m = new Map<string, Severity>();
    for (const a of alarms) {
      if (!a.enabled || !a.active) continue;
      const prev = m.get(a.cond.ref);
      if (prev === 'critical' || (prev === 'warning' && a.severity === 'info')) continue;
      m.set(a.cond.ref, a.severity);
    }
    return m;
  }, [alarms]);

  const activeCount = alarmByRef.size;

  // api.ts fires this on any 401, so no call site has to know about auth: the
  // device either grew a password while this tab was open, or the session
  // expired. Reading stays open, hence dismissing without logging in is fine.
  useEffect(() => {
    const onUnauthorized = () => setLocked(true);
    window.addEventListener('bc:unauthorized', onUnauthorized);
    return () => window.removeEventListener('bc:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    const cached = loadCachedTheme();
    if (cached) applyTheme(cached);
    getSettings()
      .then((s) => applyTheme(s.theme))
      .catch(() => {});
  }, []);

  return (
    <NavShell alertCount={activeCount} onBell={() => setCenterOpen(true)}>
      <Router>
        <Dashboard path="/" snap={snap} err={err} alarmByRef={alarmByRef} />
        <ProfilesPage path="/profiles" />
        <SettingsIndex path="/settings" />
        <AppearancePage path="/settings/appearance" />
        <DevicesPage path="/settings/devices" snap={snap} />
        <FirmwarePage path="/settings/firmware" />
        <BackupPage path="/settings/backup" />
        <TimePage path="/settings/time" />
        <NetworkPage path="/settings/network" />
        <ConnectivityPage path="/settings/connectivity" />
        <MqttPage path="/settings/connectivity/mqtt" />
        <WebhookPage path="/settings/connectivity/webhook" />
        <EspNowPage path="/settings/connectivity/espnow" />
        <LogsPage path="/settings/logs" snap={snap} />
        <ArchivePage path="/settings/logs/:id/archive" />
        <AlarmsPage path="/settings/alarms" snap={snap} />
        <FilesPage path="/settings/files" />
        <SecurityPage path="/settings/security" />
        <NotificationsPage path="/settings/notifications" />
      </Router>
      <AlertCenter alerts={alerts} open={centerOpen}
        onOpen={() => setCenterOpen(true)} onClose={() => setCenterOpen(false)}
        onClear={clearHistory} toasts={toasts} onToastDone={dropToast} />
      <LoginModal open={locked} onSuccess={() => setLocked(false)}
        onDismiss={() => setLocked(false)} />
    </NavShell>
  );
}
