import { route } from 'preact-router';

// Returns the path to route to if the link is an in-app one, else null
// (external, new tab, opt-out, or an API/download URL the browser must handle).
export function routableHref(href: string | null, target: string | null, native: boolean): string | null {
  if (!href || native) return null;
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/api/')) return null;
  if (target && !/^_?self$/i.test(target)) return null;
  return href;
}

// preact-router's own click delegation looks the <a> up at bubble time and lets
// the browser navigate whenever route() is falsy. Resolve the link in the capture
// phase instead (before any onClick can detach it) and route it ourselves.
export function installLinkRouting() {
  let pending: string | null = null;

  window.addEventListener('click', (e) => {
    pending = null;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.button) return;
    const a = (e.target as Element | null)?.closest?.('a[href]');
    if (!a) return;
    pending = routableHref(a.getAttribute('href'), a.getAttribute('target'),
      a.hasAttribute('native') || a.hasAttribute('data-native'));
  }, true);

  // Registered before the router's listener on window, so it runs first.
  window.addEventListener('click', (e) => {
    const href = pending;
    pending = null;
    if (!href) return;
    e.preventDefault();
    // Keeps the router from routing a second time (duplicate history entry).
    e.stopImmediatePropagation();
    if (!route(href)) window.location.assign(href);
  });
}
