import type { GradientSettings, ThemeSettings } from './types';

const STORAGE_KEY = 'brewctl-theme';

// Mirrors --secondary in styles.css: what a device that predates the setting
// (or a cleared value) falls back to.
export const DEFAULT_SECONDARY = '#22c55e';

export const GRADIENT_PRESETS: { label: string; from: string; via: string; to: string; angle: number }[] = [
  { label: 'Aurora', from: '#0ea5e9', via: '#6366f1', to: '#0891b2', angle: 135 },
  { label: 'Glut',   from: '#f59e0b', via: '#ef4444', to: '#8b5cf6', angle: 135 },
  { label: 'Wald',   from: '#22c55e', via: '#14b8a6', to: '#0ea5e9', angle: 160 },
  { label: 'Dämmerung', from: '#ec4899', via: '#8b5cf6', to: '#0ea5e9', angle: 120 },
];

const { from, via, to, angle } = GRADIENT_PRESETS[0];
export const DEFAULT_GRADIENT: GradientSettings = { enabled: false, from, via, to, angle, intensity: 15 };

// Hue (degrees) and chroma of a "#rrggbb" color in OKLCH.
export function hueChroma(hex: string): { h: number; c: number } {
  const lin = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(1), g = lin(3), b = lin(5);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return { h: (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360, c: Math.hypot(a, bb) };
}

// Each stop keeps the page background's lightness (relative color syntax on
// --bg, so tint and light/dark are inherited) and swaps in the stop's hue with
// its chroma scaled by the intensity. Browsers without relative colors drop
// the declaration and the flat --bg shows.
export function gradientCss(g: GradientSettings): string {
  const stop = (hex: string) => {
    const { h, c } = hueChroma(hex);
    return `oklch(from var(--bg) l ${(c * g.intensity / 100).toFixed(4)} ${h.toFixed(1)})`;
  };
  return `linear-gradient(${g.angle}deg, ${stop(g.from)} 0%, ${stop(g.via)} 50%, ${stop(g.to)} 100%)`;
}

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

  const secondary = settings.secondary || DEFAULT_SECONDARY;
  root.style.setProperty('--secondary', secondary);
  root.style.setProperty('--secondary-fg', contrastColor(secondary));

  if (settings.background !== 'neutral') {
    root.setAttribute('data-tint', settings.background);
  } else {
    root.removeAttribute('data-tint');
  }

  if (settings.gradient?.enabled) {
    root.style.setProperty('--bg-gradient', gradientCss(settings.gradient));
  } else {
    root.style.removeProperty('--bg-gradient');
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
