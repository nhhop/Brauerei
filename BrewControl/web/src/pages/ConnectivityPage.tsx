// BrewControl/web/src/pages/ConnectivityPage.tsx
import { Breadcrumb } from '../components/Breadcrumb';
import { PageShell } from '../components/PageShell';
import { SettingsCard } from '../components/SettingsCard';
import { EspressifIcon } from '../components/EspressifIcon';
import { Radio, Webhook, type LucideIcon } from 'lucide-preact';

interface Entry {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}

const ENTRIES: Entry[] = [
  { href: '/settings/connectivity/mqtt', icon: Radio, title: 'MQTT', desc: 'Externen oder eingebauten Broker konfigurieren' },
  { href: '/settings/connectivity/webhook', icon: Webhook, title: 'Webhook', desc: 'Registry per HTTP an ein Peer-Gerät senden' },
  { href: '/settings/connectivity/espnow', icon: EspressifIcon, title: 'ESP-NOW', desc: 'Registry per ESP-NOW-Broadcast senden' },
];

export function ConnectivityPage(_: { path?: string }) {
  return (
    <PageShell>
      <header class="mb-6">
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Konnektivität' }]} />
      </header>
      <div class="space-y-1">
        {ENTRIES.map(({ href, icon, title, desc }) => (
          <SettingsCard key={href} href={href} icon={icon} title={title} desc={desc} />
        ))}
      </div>
    </PageShell>
  );
}
