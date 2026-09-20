// BrewControl/web/src/pages/RechnerIndex.tsx
import { PageShell } from '../components/PageShell';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { CATEGORIES, CALCULATORS } from '../rechnerCatalog';

export function RechnerIndex(_: { path?: string }) {
  return (
    <PageShell>
      <header class="mb-6">
        <h1 class="text-2xl font-semibold tracking-tight">Rechner</h1>
      </header>
      <div class="space-y-5">
        {CATEGORIES.map((cat) => (
          <SettingsGroup key={cat.id} title={cat.title}>
            {CALCULATORS.filter((c) => c.category === cat.id).map((c) => (
              <SettingsCard key={c.id} href={`/rechner/${c.id}`} icon={c.icon} title={c.title} desc={c.desc} />
            ))}
          </SettingsGroup>
        ))}
      </div>
    </PageShell>
  );
}
