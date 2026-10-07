// BrewControl/web/src/pages/AlertsHubPage.tsx
import { useEffect, useState } from 'preact/hooks';
import type { AlarmConfig, PushStatus } from '../types';
import { getAlarms, getPush } from '../api';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageShell } from '../components/PageShell';
import { SettingsCard } from '../components/SettingsCard';
import { badge, badgeCritical, badgeSuccess } from '../ui';
import { BellRing, Smartphone } from 'lucide-preact';

// Alarms decide what gets reported, notifications where it goes — two pages
// of a different shape, so they stay apart and share this entry instead.
export function AlertsHubPage(_: { path?: string }) {
  const [alarms, setAlarms] = useState<AlarmConfig[] | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);

  useEffect(() => {
    getAlarms().then(setAlarms).catch(() => {});
    getPush().then(setPush).catch(() => {});
  }, []);

  const active = alarms?.filter((a) => a.enabled && a.active).length ?? 0;
  const alarmDesc = !alarms ? 'Grenzwerte überwachen und melden'
    : alarms.length === 0 ? 'Noch keine Regeln'
    : `${alarms.length} ${alarms.length === 1 ? 'Regel' : 'Regeln'}`;

  return (
    <PageShell>
      <header class="mb-6">
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Alarme & Benachrichtigungen' }]} />
      </header>
      <div class="space-y-1">
        <SettingsCard href="/settings/alarms" icon={BellRing} title="Alarme" desc={alarmDesc}
          control={active > 0 ? <span class={badgeCritical}>{active} aktiv</span> : undefined} />
        <SettingsCard href="/settings/notifications" icon={Smartphone} title="Push-Benachrichtigungen"
          desc="Meldungen aufs Handy, auch bei geschlossenem Dashboard"
          control={push && (push.configured
            ? <span class={badgeSuccess}>aktiv</span>
            : <span class={badge}>inaktiv</span>)} />
      </div>
    </PageShell>
  );
}
