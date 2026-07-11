// BrewControl/web/src/pages/SettingsIndex.tsx
import { useEffect, useState } from 'preact/hooks';
import { getUpdateStatus } from '../api';
import {
  Palette, Cpu, CloudDownload, DatabaseBackup, Clock, Wifi, ChartLine, ChevronRight,
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
      <div class="mt-4 space-y-2">
        {ENTRIES.map(({ href, icon: Icon, title, desc }) => (
          <a key={href} href={href}
            class="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
            <Icon size={20} class="shrink-0 text-muted" />
            <div class="min-w-0 flex-1">
              <div class="font-medium">
                {title}
                {href === '/settings/firmware' && updateAvail && (
                  <span class="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">Update verfügbar</span>
                )}
              </div>
              <div class="text-xs text-muted">{desc}</div>
            </div>
            <ChevronRight size={16} class="shrink-0 text-faint" />
          </a>
        ))}
      </div>
    </div>
  );
}
