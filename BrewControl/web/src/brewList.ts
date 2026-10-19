import type { BrewSummary } from './brews';

// The brew list's three sections, each newest (highest number) first.
export function groupBrews(brews: BrewSummary[]): Record<BrewSummary['status'], BrewSummary[]> {
  const out: Record<BrewSummary['status'], BrewSummary[]> = { active: [], planned: [], done: [] };
  for (const b of [...brews].sort((a, b) => b.number - a.number)) out[b.status].push(b);
  return out;
}

// The finished table shows this many brews until "Alle anzeigen".
export const DONE_PREVIEW = 5;
