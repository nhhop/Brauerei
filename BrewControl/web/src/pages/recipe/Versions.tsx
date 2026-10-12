import { useEffect, useState } from 'preact/hooks';
import { versionOf, type RecipeSummary } from '../../recipes';
import { formatDate, loadTimeSettings } from '../../time';
import type { TimeSettings } from '../../types';
import { badgeAccent, badgeSuccess, inp } from '../../ui';
import { Card } from './fields';

export function useTimeSettings(): TimeSettings | undefined {
  const [time, setTime] = useState<TimeSettings>();
  useEffect(() => { loadTimeSettings().then(setTime).catch(() => {}); }, []);
  return time;
}

export const statusText =(v: RecipeSummary) => (v.status === 'draft' ? 'Entwurf' : 'Fertig');
// The date of a version is its last save; older versions stay editable.
export const dateOf =(v: RecipeSummary, time?: TimeSettings) => formatDate(v.updatedAt / 1000, time);

// Version picker in the editor head, shown from version 2 on. `versions` is
// ordered oldest first.
export function VersionSelect({ versions, current, onOpen }: {
  versions: RecipeSummary[]; current: string; onOpen: (id: string) => void;
}) {
  const time = useTimeSettings();
  return (
    <select class={`${inp} py-1 text-sm`} value={current} aria-label="Version"
      onChange={(e) => {
        const id = e.currentTarget.value;
        e.currentTarget.value = current;  // stays put until the new version is loaded
        onOpen(id);
      }}>
      {versions.map((v) => (
        <option key={v.id} value={v.id}>v{versionOf(v)} · {dateOf(v, time)} · {statusText(v)}</option>
      ))}
    </select>
  );
}

// "Versionen" on the overview, newest first.
export function VersionsCard({ versions, current, onOpen, onCompare }: {
  versions: RecipeSummary[]; current: string; onOpen: (id: string) => void; onCompare: () => void;
}) {
  const time = useTimeSettings();
  return (
    <Card title="Versionen"
      action={<button type="button" class="text-sm text-accent hover:underline" onClick={onCompare}>Vergleichen</button>}>
      <ul class="divide-y divide-border">
        {[...versions].reverse().map((v) => (
          <li key={v.id}>
            <button type="button" disabled={v.id === current} onClick={() => onOpen(v.id)}
              class="flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm hover:bg-fg/5 disabled:hover:bg-transparent">
              <span class="w-8 font-medium">v{versionOf(v)}</span>
              <span class="flex-1 text-muted">{dateOf(v, time)}</span>
              {v.id === current && <span class="text-xs text-muted">geöffnet</span>}
              <span class={v.status === 'draft' ? badgeAccent : badgeSuccess}>{statusText(v)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
