// BrewControl/web/src/pages/SettingsIndex.tsx
import { useEffect, useState } from 'preact/hooks';
import { getSettings, getUpdateStatus } from '../api';
import { SettingsCard, SettingsGroup } from '../components/SettingsCard';
import { PageShell } from '../components/PageShell';
import { useModule } from '../optionalModules';
import { badgeCaution } from '../ui';
import {
  Palette, Cpu, CloudDownload, DatabaseBackup, Clock, Wifi, Network, FolderOpen,
  ShieldCheck, BellRing, Monitor, Activity, BatteryMedium, Cable, Factory,
  type LucideIcon,
} from 'lucide-preact';

interface Entry {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}

interface Group {
  title?: string;
  entries: Entry[];
}

const GROUPS: Group[] = [
  { entries: [
    { href: '/settings/anlage', icon: Factory, title: 'Brauanlage', desc: 'Brauerei und Sudhäuser: Behälter, Geräte, Verluste' },
  ] },
  { title: 'Hardware', entries: [
    { href: '/settings/devices', icon: Cpu, title: 'Geräte', desc: 'Sensoren, Regler, Aktoren verwalten' },
    { href: '/settings/buses', icon: Cable, title: 'Bus-Schnittstellen', desc: 'I²C, OneWire, SPI: Pins festlegen, Busse scannen' },
    { href: '/settings/display', icon: Monitor, title: 'Gerätedisplay', desc: 'Dimmen, Ausschalten, Pixel-Shift' },
    { href: '/settings/energy', icon: BatteryMedium, title: 'Energiemanagement', desc: 'Batteriespannung' },
  ] },
  { title: 'Verbindungen', entries: [
    { href: '/settings/network', icon: Wifi, title: 'Netzwerk', desc: 'WLAN-Status, Netzwerk wechseln, Hostname' },
    { href: '/settings/connectivity', icon: Network, title: 'Konnektivität', desc: 'MQTT, Webhook, WebSocket und ESP-NOW' },
  ] },
  { title: 'Oberfläche', entries: [
    { href: '/settings/appearance', icon: Palette, title: 'Darstellung', desc: 'Modus, Akzentfarbe, Hintergrund' },
    { href: '/settings/time', icon: Clock, title: 'Zeit & Formate', desc: 'Zeitzone, NTP-Server, Uhrzeit- und Datumsformat' },
  ] },
  { title: 'System', entries: [
    { href: '/settings/system', icon: Activity, title: 'Systemstatus', desc: 'Version, letzter Neustart, Speicher' },
    { href: '/settings/firmware', icon: CloudDownload, title: 'Firmware-Update', desc: 'Version, Kanal, Upload' },
    { href: '/settings/meldungen', icon: BellRing, title: 'Alarme & Benachrichtigungen', desc: 'Grenzwerte überwachen, Meldungen aufs Handy' },
    { href: '/settings/backup', icon: DatabaseBackup, title: 'Backup & Restore', desc: 'Konfiguration exportieren / wiederherstellen' },
    { href: '/settings/files', icon: FolderOpen, title: 'Dateiverwaltung', desc: 'SD-Karte durchsuchen, hoch-/herunterladen, löschen' },
    { href: '/settings/security', icon: ShieldCheck, title: 'Zugriffsschutz', desc: 'Gerätepasswort für schreibende Zugriffe' },
  ] },
];

export function SettingsIndex(_: { path?: string }) {
  const [updateAvail, setUpdateAvail] = useState(false);
  // Only boards built with a display get the entry.
  const [hasDisplay, setHasDisplay] = useState(false);
  // The brewing system belongs to the recipe package.
  const hasRecipes = useModule('recipes') === true;

  useEffect(() => {
    getUpdateStatus().then((s) => setUpdateAvail(s.state === 'updateAvailable')).catch(() => {});
    getSettings().then((s) => setHasDisplay(!!s.display?.supported)).catch(() => {});
  }, []);

  const visible = (e: Entry) => (e.href !== '/settings/display' || hasDisplay)
    && (e.href !== '/settings/anlage' || hasRecipes);

  return (
    <PageShell>
      <header class="mb-6 flex items-center gap-3">
        <h1 class="text-2xl font-semibold tracking-tight">Einstellungen</h1>
      </header>
      <div class="space-y-6">
        {GROUPS.map((g) => ({ ...g, entries: g.entries.filter(visible) }))
          .filter((g) => g.entries.length > 0)
          .map((g) => (
            <SettingsGroup key={g.title ?? ''} title={g.title}>
              {g.entries.map(({ href, icon, title, desc }) => (
                <SettingsCard key={href} href={href} icon={icon} title={title} desc={desc}
                  control={href === '/settings/firmware' && updateAvail
                    ? <span class={badgeCaution}>Update verfügbar</span>
                    : undefined}
                />
              ))}
            </SettingsGroup>
          ))}
      </div>
    </PageShell>
  );
}
