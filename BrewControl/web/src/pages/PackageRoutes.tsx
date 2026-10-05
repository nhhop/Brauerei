import { useEffect, useState } from 'preact/hooks';
import { PageShell } from '../components/PageShell';
import { useModule } from '../optionalModules';
import type { Snapshot } from '../types';

type RecipesModule = typeof import('../modules/recipes');

function Notice({ title, children }: { title: string; children: string }) {
  return (
    <PageShell>
      <h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
      <p class="mt-4 text-sm text-muted">{children}</p>
    </PageShell>
  );
}

// The recipe pages and the Rechner share one optional package: without it the
// device shows a notice, with it the chunk is fetched on first use. Returns the
// loaded module, or the page to show instead.
function usePackage(title: string, what: string): { mod: RecipesModule } | { page: preact.JSX.Element } {
  const installed = useModule('recipes');
  const [mod, setMod] = useState<RecipesModule | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (installed !== true) return;
    import('../modules/recipes').then(setMod).catch(() => setFailed(true));
  }, [installed]);

  if (installed === false) {
    return { page: <Notice title={title}>{`${what} auf diesem Gerät nicht installiert. Sie brauchen ein Board mit SD-Karte und das Rezeptpaket (webui-full.tar).`}</Notice> };
  }
  if (failed) return { page: <Notice title={title}>Das Rezeptpaket lässt sich nicht laden. Möglicherweise ist es unvollständig installiert.</Notice> };
  if (!mod) return { page: <PageShell><p class="text-sm text-muted">Lädt …</p></PageShell> };
  return { mod };
}

// Route for /rezepte and /rezepte/:id.
export function RecipesRoute({ id }: { path?: string; id?: string }) {
  const r = usePackage('Rezepte', 'Die Rezeptverwaltung ist');
  if ('page' in r) return r.page;
  return id ? <r.mod.RecipeEditPage id={id} /> : <r.mod.RecipesPage />;
}

// Route for /rechner and /rechner/:calc.
export function RechnerRoute({ calc }: { path?: string; calc?: string }) {
  const r = usePackage('Rechner', 'Die Rechner sind');
  if ('page' in r) return r.page;
  return calc ? <r.mod.RechnerDetail calc={calc} /> : <r.mod.RechnerIndex />;
}

// Route for /settings/anlage and /settings/anlage/sudhaus/:id (`vorlage`/`von`
// come from the query string of a new draft).
export function AnlageRoute({ id, vorlage, von, snap }: {
  path?: string; id?: string; vorlage?: string; von?: string; snap: Snapshot | null;
}) {
  const r = usePackage('Brauanlage', 'Die Brauanlage ist');
  if ('page' in r) return r.page;
  return id
    ? <r.mod.BrewhouseEditPage id={id} vorlage={vorlage} von={von} snap={snap} />
    : <r.mod.BrewhousePage />;
}
