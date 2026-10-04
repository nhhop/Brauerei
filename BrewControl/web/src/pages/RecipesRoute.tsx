import { useEffect, useState } from 'preact/hooks';
import { PageShell } from '../components/PageShell';
import { useModule } from '../optionalModules';

type RecipesModule = typeof import('../modules/recipes');

function Notice({ children }: { children: string }) {
  return (
    <PageShell>
      <h1 class="text-2xl font-semibold tracking-tight">Rezepte</h1>
      <p class="mt-4 text-sm text-muted">{children}</p>
    </PageShell>
  );
}

// Route for /rezepte and /rezepte/:id. The recipe pages are an optional package:
// without it the device shows a notice, with it the chunk is fetched on first use.
export function RecipesRoute({ id }: { path?: string; id?: string }) {
  const installed = useModule('recipes');
  const [mod, setMod] = useState<RecipesModule | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (installed !== true) return;
    import('../modules/recipes').then(setMod).catch(() => setFailed(true));
  }, [installed]);

  if (installed === false) {
    return <Notice>Die Rezeptverwaltung ist auf diesem Gerät nicht installiert. Sie braucht ein Board mit SD-Karte und das Rezeptpaket (webui-full.tar).</Notice>;
  }
  if (failed) return <Notice>Das Rezeptpaket lässt sich nicht laden. Möglicherweise ist es unvollständig installiert.</Notice>;
  if (!mod) return <PageShell><p class="text-sm text-muted">Lädt …</p></PageShell>;
  return id ? <mod.RecipeEditPage id={id} /> : <mod.RecipesPage />;
}
