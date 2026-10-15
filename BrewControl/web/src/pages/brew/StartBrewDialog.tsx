import { useEffect, useState } from 'preact/hooks';
import type { Booking, Brew } from '../../brews';
import { bookStock, freezeEntries, startBrew, stockPlan, type StockLine } from '../../brewStart';
import type { Brewery, Brewhouse } from '../../brewhouse';
import type { Fermenter } from '../../cellar';
import { reloadCatalog, saveStockLot } from '../../ingredientSource';
import type { Recipe } from '../../recipes';
import { btnPrimary, btnSecondary } from '../../ui';
import { Dialog } from '../ingredients/Dialog';

const num = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

// "Brautag starten": takes the ticked stock lots' amounts from stock, then
// copies brewhouse, brewery, fermenter and ingredient values into the brew.
// Lots already taken by an earlier, interrupted start are not taken again.
export function StartBrewDialog({ brew, recipe, brewhouse, brewery, fermenter, onStarted, onClose }: {
  brew: Brew; recipe: Recipe; brewhouse?: Brewhouse; brewery: Brewery; fermenter?: Fermenter;
  onStarted: (b: Brew) => Promise<void>;  // saves the brew
  onClose: () => void;
}) {
  const [lines, setLines] = useState<StockLine[] | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = new Set((brew.booked ?? []).map((b) => b.lotId));

  // The stock may have changed since the page loaded, so the plan uses fresh data.
  useEffect(() => {
    reloadCatalog()
      .then((c) => {
        const plan = stockPlan(recipe, c);
        setLines(plan);
        setTicked(new Set(plan.filter((l) => l.lot && !done.has(l.lotId)).map((l) => l.lotId)));
      })
      .catch(() => setError('Zutaten und Lager konnten nicht geladen werden.'));
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    const booked: Booking[] = [...(brew.booked ?? [])];
    try {
      const catalog = await reloadCatalog();
      for (const l of lines ?? []) {
        if (!ticked.has(l.lotId) || done.has(l.lotId)) continue;
        const lot = catalog.stock.find((s) => s.id === l.lotId);
        if (!lot) continue;
        const { lot: after, taken } = bookStock(lot, l.amount);
        await saveStockLot(after);
        booked.push({ lotId: l.lotId, amount: taken });
      }
      const frozen = { brewhouse, brewery, fermenter, entries: freezeEntries(recipe, catalog.entries) };
      await onStarted(startBrew(brew, frozen, booked));
      await reloadCatalog();
    } catch {
      // Keep what was taken, so a second try does not take it again.
      setError('Start unterbrochen. Bereits Abgebuchtes ist im Sud vermerkt; ein neuer Versuch bucht es nicht doppelt.');
      if (booked.length > (brew.booked ?? []).length) await onStarted({ ...brew, booked }).catch(() => {});
      setBusy(false);
    }
  }

  return (
    <Dialog title="Brautag starten" onClose={onClose}
      footer={<>
        <button type="button" class={btnSecondary} onClick={onClose} disabled={busy}>Abbrechen</button>
        <button type="button" class={btnPrimary} onClick={start} disabled={busy || lines === null}>Starten</button>
      </>}>
      <p class="mb-3 text-sm text-muted">
        Der Sud übernimmt jetzt Sudhaus, Brauerei, Gärplatz und die Werte seiner Zutaten; spätere Änderungen daran
        wirken nicht mehr auf ihn. Angehakte Lagerposten werden um die Rezeptmenge verringert.
      </p>
      {lines === null ? (
        !error && <p class="text-sm text-muted">Lädt …</p>
      ) : lines.length === 0 ? (
        <p class="text-sm text-muted">Das Rezept nutzt keine Lagerposten, es wird nichts abgebucht.</p>
      ) : (
        <ul class="divide-y divide-border text-sm">
          {lines.map((l) => {
            const already = done.has(l.lotId);
            return (
              <li key={l.lotId} class="flex items-start gap-3 py-2">
                <input type="checkbox" class="mt-1" disabled={!l.lot || already || busy}
                  checked={already || ticked.has(l.lotId)}
                  onChange={(e) => {
                    const next = new Set(ticked);
                    if (e.currentTarget.checked) next.add(l.lotId); else next.delete(l.lotId);
                    setTicked(next);
                  }} />
                <div class="min-w-0 flex-1">
                  <div>{l.name}{l.lot?.cropYear ? ` · ${l.lot.cropYear}` : ''}</div>
                  <div class="text-xs text-muted">
                    {num(l.amount)} {l.unit}
                    {l.lot && ` von ${num(l.lot.amount)} ${l.unit} im Lager`}
                  </div>
                  {already && <div class="text-xs text-muted">bereits abgebucht</div>}
                  {!l.lot && <div class="text-xs text-caution">Lagerposten fehlt, nichts abzubuchen</div>}
                  {l.short && !already && <div class="text-xs text-caution">Bestand reicht nicht, er fällt auf 0</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p class="mt-3 text-sm text-critical">{error}</p>}
    </Dialog>
  );
}
