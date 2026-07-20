import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { useRouter } from 'preact-router';
import { LayoutDashboard, Settings, Menu, type LucideIcon } from 'lucide-preact';

const STORAGE_KEY = 'brewctl-nav-expanded';

function loadExpanded(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
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
];
const footerItems: NavItem[] = [
  { href: '/settings', label: 'Einstellungen', icon: Settings, match: (p) => p.startsWith('/settings') },
];

export function NavShell({ children }: { children: ComponentChildren }) {
  const [expanded, setExpanded] = useState(loadExpanded);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [{ url }] = useRouter();
  const path = (url ?? '/').split('?')[0];
  const showLabels = expanded || mobileOpen;

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
        onClick={() => setMobileOpen(false)}
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
          {footerItems.map(renderItem)}
        </div>
      </nav>
      <main class="min-w-0 flex-1 overflow-y-auto">
        <div class="sticky top-0 z-20 flex h-12 items-center border-b border-border bg-surface-acrylic px-3 backdrop-blur-md md:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} title="Menü öffnen"
            class="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle-hover hover:text-fg active:bg-subtle-pressed">
            <Menu size={20} />
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
