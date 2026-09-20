// BrewControl/web/src/pages/RechnerDetail.tsx
import type { ComponentType } from 'preact';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageShell } from '../components/PageShell';
import { SettingsCard } from '../components/SettingsCard';
import { CATEGORIES, CALCULATORS, type CalcId } from '../rechnerCatalog';
import { CalcUnitConverter } from '../components/CalcUnitConverter';
import { CalcVolume } from '../components/CalcVolume';
import { CalcDilutionBoil } from '../components/CalcDilutionBoil';
import { CalcBlend } from '../components/CalcBlend';
import { CalcStrikeTemp } from '../components/CalcStrikeTemp';
import { CalcMashEfficiency } from '../components/CalcMashEfficiency';
import { CalcBrewhouseYield } from '../components/CalcBrewhouseYield';
import { CalcBrewhouseEfficiency } from '../components/CalcBrewhouseEfficiency';
import { CalcCarbonation } from '../components/CalcCarbonation';
import { CalcHydrometerCorrection } from '../components/CalcHydrometerCorrection';
import { CalcRefractometerCorrection } from '../components/CalcRefractometerCorrection';
import { CalcOverrangeDilution } from '../components/CalcOverrangeDilution';
import { CalcAbv } from '../components/CalcAbv';
import { CalcAttenuation } from '../components/CalcAttenuation';

const COMPONENTS: Record<CalcId, ComponentType> = {
  'einheiten-umrechner': CalcUnitConverter,
  volumen: CalcVolume,
  'verduennen-einkochen': CalcDilutionBoil,
  mischkreuz: CalcBlend,
  einmaischtemperatur: CalcStrikeTemp,
  maischeeffizienz: CalcMashEfficiency,
  sudhausausbeute: CalcBrewhouseYield,
  'brewhouse-efficiency': CalcBrewhouseEfficiency,
  karbonisierung: CalcCarbonation,
  'spindel-korrektur': CalcHydrometerCorrection,
  'refraktometer-korrektur': CalcRefractometerCorrection,
  'ueberrange-messung': CalcOverrangeDilution,
  abv: CalcAbv,
  endvergaerungsgrad: CalcAttenuation,
};

export function RechnerDetail({ calc }: { calc?: string; path?: string }) {
  const entry = CALCULATORS.find((c) => c.id === calc);
  const category = entry && CATEGORIES.find((c) => c.id === entry.category);
  const Component = entry && COMPONENTS[entry.id];

  if (!entry || !Component) {
    return (
      <PageShell>
        <Breadcrumb trail={[{ label: 'Rechner', href: '/rechner' }, { label: 'Nicht gefunden' }]} />
        <p class="mt-4 text-sm text-muted">Dieser Rechner existiert nicht.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <header class="mb-6">
        <Breadcrumb trail={[
          { label: 'Rechner', href: '/rechner' },
          { label: category?.title ?? '' },
          { label: entry.title },
        ]} />
      </header>
      <SettingsCard desc={entry.desc}>
        <Component />
      </SettingsCard>
    </PageShell>
  );
}
