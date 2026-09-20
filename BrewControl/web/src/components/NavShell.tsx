import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { route, useRouter } from 'preact-router';
import { LayoutDashboard, ListChecks, Calculator, Settings, Menu, Bell, Maximize, Minimize, OctagonX, type LucideIcon } from 'lucide-preact';

const STORAGE_KEY = 'brewctl-nav-expanded';

function loadExpanded(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

// The device serves plain HTTP, so it can never be installed as a PWA — Chrome
// keeps its address bar on a home-screen shortcut. The Fullscreen API needs no
// secure context and is the only way to reclaim that strip on Android. It does
// need a real tap, hence a button rather than a call on load. iOS Safari on
// iPhone reports false here and the button stays hidden; there the apple-*
// meta tags in index.html already give a chrome-less home-screen app.
function fullscreenAvailable(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
}

// Weitere Einträge (z.B. einzelne Dashboards, Logs) folgen in einer späteren Session.
const mainItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/' },
  { href: '/profiles', label: 'Profile', icon: ListChecks, match: (p) => p.startsWith('/profiles') },
  { href: '/rechner', label: 'Rechner', icon: Calculator, match: (p) => p.startsWith('/rechner') },
];
const footerItems: NavItem[] = [
  { href: '/settings', label: 'Einstellungen', icon: Settings, match: (p) => p.startsWith('/settings') },
];

export function NavShell({ children, alertCount = 0, onBell, onEmergencyStop }: {
  children: ComponentChildren;
  // Optional so the shell stays usable on its own; App supplies both.
  alertCount?: number;
  onBell?: () => void;
  onEmergencyStop?: () => void;
}) {
  const [expanded, setExpanded] = useState(loadExpanded);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen] = useState(fullscreenAvailable);
  const [{ url }] = useRouter();
  const path = (url ?? '/').split('?')[0];
  const showLabels = expanded || mobileOpen;

  // Also fires when the user leaves fullscreen by gesture, not just via the button.
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  function toggleFullscreen() {
    const req = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    req.catch(() => { /* denied by the browser — nothing to recover */ });
  }

  // preact-router normally picks links up through a delegated click listener on
  // document. On the device that delegation did not take the "/" link: no
  // pushState, the browser performed a real document load instead, which reset
  // the SPA and dropped fullscreen with it. Routing here removes that dependency.
  function navigate(e: MouseEvent, href: string) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    // Keep it away from document, or preact-router routes a second time and
    // pushes a duplicate history entry.
    e.stopPropagation();
    route(href);
  }

  function toggle() {
    if (mobileOpen) { setMobileOpen(false); return; }
    setExpanded((e) => {
      const next = !e;
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
      return next;
    });
  }

  function renderItem(item: NavItem) {
    const active = item.match(path);
    const Icon = item.icon;
    return (
      <a key={item.href} href={item.href} title={item.label}
        onClick={(e) => { setMobileOpen(false); navigate(e, item.href); }}
        class={`relative flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors active:bg-subtle-pressed ${
          active ? 'bg-subtle-hover font-medium text-fg' : 'text-muted hover:bg-subtle-hover hover:text-fg'
        }`}>
        {active && (
          <span class="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent" />
        )}
        <Icon size={20} class="shrink-0" />
        {showLabels && <span class="truncate">{item.label}</span>}
      </a>
    );
  }

  return (
    <div class="flex h-screen bg-bg">
      {mobileOpen && (
        <div class="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <nav class={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col
        pt-[var(--safe-t)] pb-[var(--safe-b)] pl-[var(--safe-l)]
        bg-surface-acrylic backdrop-blur-md transition-transform duration-200
        md:static md:z-auto md:translate-x-0 md:bg-transparent md:backdrop-blur-none md:transition-[width]
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        ${expanded ? 'md:w-60' : 'md:w-14'}`}>
        <div class="flex flex-col gap-1 p-2">
          <button type="button" onClick={toggle}
            title={expanded ? 'Menü einklappen' : 'Menü ausklappen'}
            class="flex items-center gap-3 rounded px-3 py-2 text-muted transition-colors hover:bg-subtle-hover hover:text-fg active:bg-subtle-pressed">
            <Menu size={20} class="shrink-0" />
          </button>
          {mainItems.map(renderItem)}
        </div>
        <div class="mt-auto flex flex-col gap-1 p-2">
          {onEmergencyStop && (
            <button type="button" onClick={() => { setMobileOpen(false); onEmergencyStop(); }}
              title="Not-Aus — alle Aktoren abschalten"
              class="flex items-center gap-3 rounded px-3 py-2 text-sm text-critical transition-colors hover:bg-critical/10 active:bg-critical/15">
              <OctagonX size={20} class="shrink-0" />
              {showLabels && <span class="truncate">Not-Aus</span>}
            </button>
          )}
          {onBell && (
            <button type="button" onClick={() => { setMobileOpen(false); onBell(); }}
              title={alertCount > 0 ? `Meldungen (${alertCount} aktiv)` : 'Meldungen'}
              class="relative flex items-center gap-3 rounded px-3 py-2 text-sm text-muted transition-colors hover:bg-subtle-hover hover:text-fg active:bg-subtle-pressed">
              <Bell size={20} class="shrink-0" />
              {alertCount > 0 && (
                <span class="absolute left-6 top-1 min-w-4 rounded-full bg-critical px-1 text-center text-[10px] font-medium leading-4 text-white">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
              {showLabels && <span class="truncate">Meldungen</span>}
            </button>
          )}
          {footerItems.map(renderItem)}
        </div>
      </nav>
      <main class="min-w-0 flex-1 overflow-y-auto pb-[var(--safe-b)] pr-[var(--safe-r)] max-md:pl-[var(--safe-l)]">
        <div class="sticky top-0 z-20 flex h-[calc(3rem+var(--safe-t))] items-center border-b border-border bg-surface-acrylic px-3 pt-[var(--safe-t)] backdrop-blur-md md:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} title="Menü öffnen"
            class="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle-hover hover:text-fg active:bg-subtle-pressed">
            <Menu size={20} />
          </button>
          {onEmergencyStop && (
            <button type="button" onClick={onEmergencyStop} title="Not-Aus — alle Aktoren abschalten"
              class="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-critical transition-colors hover:bg-critical/10 active:bg-critical/15">
              <OctagonX size={20} />
            </button>
          )}
          {canFullscreen && (
            <button type="button" onClick={toggleFullscreen}
              title={fullscreen ? 'Vollbild verlassen' : 'Vollbild'}
              class="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle-hover hover:text-fg active:bg-subtle-pressed">
              {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
