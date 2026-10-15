import { route } from 'preact-router';
import { STATUS_LABEL, type BrewSummary } from '../../brews';
import { btnPrimary } from '../../ui';
import { formatIsoDate } from '../brew/format';
import { statusBadge } from '../BrewsPage';
import { EfficiencyChart } from './EfficiencyChart';
import { Card } from './fields';

const fmt = (n: number | undefined) => (n === undefined ? '–' : n.toFixed(1).replace('.', ','));

// Tab "Sude": the brews of every version of this recipe, newest first, with the
// results from their index line and the efficiencies over the brews.
export function BrewsTab({ brews, onCreate, createBlock }: {
  brews: BrewSummary[] | null;   // null = the list did not load
  onCreate: () => void;
  createBlock?: string;          // why "Neuer Sud" is locked
}) {
  // A column's name stands in the head line; where the row wraps, at its value.
  const cell = (label: string, text: string, width: string) => (
    <span class={`${width} text-right tabular-nums`}>
      <span class="mr-1 text-xs text-muted xl:hidden">{label}</span>{text}
    </span>
  );
  return (
    <>
      <Card title="Sude"
        action={
          <div class="flex items-center gap-2">
            {createBlock && <span class="text-xs text-muted">{createBlock}</span>}
            <button type="button" class={btnPrimary} disabled={!!createBlock} onClick={onCreate}>Neuer Sud aus diesem Rezept</button>
          </div>
        }>
        {brews === null ? (
          <p class="text-sm text-critical">Die Sude konnten nicht geladen werden.</p>
        ) : brews.length === 0 ? (
          <p class="text-sm text-muted">Aus diesem Rezept wurde noch kein Sud angelegt.</p>
        ) : (
          <>
            <div class="hidden items-center gap-x-3 border-b border-border px-2 pb-1 text-xs font-semibold text-muted xl:flex">
              <span class="min-w-0 flex-1">Sud</span>
              <span class="w-24">Brautag</span>
              <span class="w-28">Status</span>
              <span class="w-32 text-right">Stammwürze Soll / Ist</span>
              <span class="w-24 text-right">Maischeeffizienz</span>
              <span class="w-24 text-right">Sudhausausbeute</span>
              <span class="w-20 text-right">Alkohol</span>
              <span class="w-24 text-right">Endvergärung</span>
              <span class="w-24 text-right">Restextrakt</span>
            </div>
            <ul class="divide-y divide-border">
              {brews.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => route(`/sude/${b.id}`)}
                    class="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded px-2 py-2 text-left text-sm hover:bg-fg/5">
                    <span class="flex min-w-0 flex-1 items-center gap-x-3">
                      <span class="w-10 text-muted">#{b.number}</span>
                      <span class="min-w-0 flex-1 truncate">{b.name || 'Ohne Namen'}</span>
                      <span class="w-8 text-muted">v{b.version}</span>
                    </span>
                    <span class="w-24 text-muted">{b.brewDate ? formatIsoDate(b.brewDate) : '–'}</span>
                    <span class="w-28"><span class={statusBadge(b.status)}>{STATUS_LABEL[b.status]}</span></span>
                    {cell('Stammwürze', `${fmt(b.ogPlato)} / ${fmt(b.ogActual)} °P`, 'w-32')}
                    {cell('Maische', b.mashEffPct === undefined ? '–' : `${fmt(b.mashEffPct)} %`, 'w-24')}
                    {cell('Ausbeute', b.yieldPct === undefined ? '–' : `${fmt(b.yieldPct)} %`, 'w-24')}
                    {cell('Alkohol', b.abvPct === undefined ? '–' : `${fmt(b.abvPct)} %`, 'w-20')}
                    {cell('Endvergärung', b.attenuationPct === undefined ? '–' : `${fmt(b.attenuationPct)} %`, 'w-24')}
                    {cell('Restextrakt', b.fgPlato === undefined ? '–' : `${fmt(b.fgPlato)} °P`, 'w-24')}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      {brews && brews.filter((b) => b.mashEffPct !== undefined || b.yieldPct !== undefined).length >= 2 && (
        <Card title="Effizienz über die Sude">
          <EfficiencyChart brews={brews} />
        </Card>
      )}
    </>
  );
}
