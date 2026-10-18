import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { PageShell } from '../components/PageShell';
import { TabBtn } from '../components/TabBtn';
import { FermentationProfilesTab } from './profiles/FermentationProfiles';
import { MashProfilesTab } from './profiles/MashProfiles';
import { WaterProfilesTab } from './WaterProfiles';

// Profile page of the recipe package: one tab per kind of beer profile, own ones
// editable, shipped ones duplicated into own ones. The tab is part of the path:
// /profile/<slug>. Not the controller step templates (ProfilesPage, /vorlagen).
const TABS: { slug: string; label: string; render: () => preact.JSX.Element }[] = [
  { slug: 'wasser', label: 'Wasser', render: () => <WaterProfilesTab key="wasser" target={false} /> },
  { slug: 'zielwasser', label: 'Zielwasser', render: () => <WaterProfilesTab key="zielwasser" target /> },
  { slug: 'maische', label: 'Maische', render: () => <MashProfilesTab /> },
  { slug: 'gaerung', label: 'Gärung', render: () => <FermentationProfilesTab /> },
];

export function BrewProfilesPage({ tab }: { path?: string; tab?: string }) {
  const current = TABS.find((t) => t.slug === tab);
  // An unknown tab (or none) opens the first one.
  useEffect(() => { if (!current) route(`/profile/${TABS[0].slug}`, true); }, [tab]);

  return (
    <PageShell>
      <h1 class="text-2xl font-semibold tracking-tight">Profile</h1>
      <div class="my-4 flex overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <TabBtn key={t.slug} active={t === current} onClick={() => route(`/profile/${t.slug}`)}>{t.label}</TabBtn>
        ))}
      </div>
      {current?.render()}
    </PageShell>
  );
}
