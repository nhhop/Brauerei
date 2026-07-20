// BrewControl/web/src/pages/SettingsIndex.tsx
import { useEffect, useState } from 'preact/hooks';
import { getUpdateStatus } from '../api';
import { SettingsCard } from '../components/SettingsCard';
import { badgeCaution } from '../ui';
import {
  Palette, Cpu, CloudDownload, DatabaseBackup, Clock, Wifi, ChartLine,
  type LucideIcon,
} from 'lucide-preact';

interface Entry {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}

const ENTRIES: Entry[] = [
  { href: '/settings/appearance', icon: Palette, title: 'Darstellung', desc: 'Modus, Akzentfarbe, Hintergrund' },
  { href: '/settings/devices', icon: Cpu, title: 'Geräte', desc: 'Sensoren, Regler, Aktoren verwalten' },
  { href: '/settings/firmware', icon: CloudDownload, title: 'Firmware-Update', desc: 'Version, Kanal, Upload' },
  { href: '/settings/backup', icon: DatabaseBackup, title: 'Backup & Restore', desc: 'Konfiguration exportieren / wiederherstellen' },
  { href: '/settings/time', icon: Clock, title: 'Zeit & Formate', desc: 'Zeitzone, NTP-Server, Uhrzeit- und Datumsformat' },
  { href: '/settings/network', icon: Wifi, title: 'Netzwerk', desc: 'WLAN-Status, Netzwerk wechseln, Hostname' },
  { href: '/settings/logs', icon: ChartLine, title: 'Logs & Charts', desc: 'Datenaufzeichnung konfigurieren und Verläufe anzeigen' },
];

export function SettingsIndex(_: { path?: string }) {
  const [updateAvail, setUpdateAvail] = useState(false);

  useEffect(() => {
    getUpdateStatus().then((s) => setUpdateAvail(s.state === 'updateAvailable')).catch(() => {});
  }, []);

  return (
    <div class="min-h-full bg-bg p-4 text-fg md:p-6">
      <header class="flex items-center gap-3">
        <h1 class="text-2xl font-semibold tracking-tight">Einstellungen</h1>
      </header>
      <div class="mt-4 space-y-1">
        {ENTRIES.map(({ href, icon, title, desc }) => (
          <SettingsCard key={href} href={href} icon={icon} title={title} desc={desc}
            control={href === '/settings/firmware' && updateAvail
              ? <span class={badgeCaution}>Update verfügbar</span>
              : undefined}
          />
        ))}
      </div>
    </div>
  );
}
