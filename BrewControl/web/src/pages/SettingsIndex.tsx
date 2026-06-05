// BrewControl/web/src/pages/SettingsIndex.tsx
import { useEffect, useState } from 'preact/hooks';
import { getUpdateStatus } from '../api';

export function SettingsIndex(_: { path?: string }) {
  const [updateAvail, setUpdateAvail] = useState(false);

  useEffect(() => {
    getUpdateStatus().then((s) => setUpdateAvail(s.state === 'updateAvailable')).catch(() => {});
  }, []);

  return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <header class="flex items-center gap-3">
        <a href="/" class="text-lg leading-none text-faint hover:text-fg">←</a>
        <h1 class="text-xl font-medium tracking-tight">Einstellungen</h1>
      </header>
      <div class="mt-4 space-y-2">
        <a href="/settings/appearance"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">Darstellung</div>
            <div class="text-xs text-muted">Modus, Akzentfarbe, Hintergrund</div>
          </div>
          <span class="text-faint">›</span>
        </a>
        <a href="/settings/devices"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">Geräte</div>
            <div class="text-xs text-muted">Sensoren, Regler, Aktoren verwalten</div>
          </div>
          <span class="text-faint">›</span>
        </a>
        <a href="/settings/firmware"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">
              Firmware-Update
              {updateAvail && <span class="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">Update verfügbar</span>}
            </div>
            <div class="text-xs text-muted">Version, Kanal, Upload</div>
          </div>
          <span class="text-faint">›</span>
        </a>
        <a href="/settings/backup"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">Backup &amp; Restore</div>
            <div class="text-xs text-muted">Konfiguration exportieren / wiederherstellen</div>
          </div>
          <span class="text-faint">›</span>
        </a>
        <a href="/settings/time"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">Zeit &amp; Formate</div>
            <div class="text-xs text-muted">Zeitzone, NTP-Server, Uhrzeit- und Datumsformat</div>
          </div>
          <span class="text-faint">›</span>
        </a>
      </div>
    </div>
  );
}
