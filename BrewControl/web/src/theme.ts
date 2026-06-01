import type { ThemeSettings } from './types';

const STORAGE_KEY = 'brewctl-theme';

export function applyTheme(settings: ThemeSettings): void {
  const root = document.documentElement;

  if (settings.mode === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else if (settings.mode === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }

  root.style.setProperty('--accent', settings.accent);
  root.style.setProperty('--accent-fg', contrastColor(settings.accent));

  if (settings.background !== 'neutral') {
    root.setAttribute('data-tint', settings.background);
  } else {
    root.removeAttribute('data-tint');
  }

  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
}

export function loadCachedTheme(): ThemeSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ThemeSettings) : null;
  } catch {
    return null;
  }
}

function contrastColor(hex: string): string {
  if (hex.length < 7) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000000' : '#ffffff';
}
