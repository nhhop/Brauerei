import { ebcSwatch } from '../../recipeList';

const OUTLINE = 'M9.5 9 C9.5 8.4 10 8 10.6 8 H53.4 C54 8 54.5 8.4 54.5 9 L49.6 88.5 C49.3 92.6 46.6 95 42.6 95 H21.4 C17.4 95 14.7 92.6 14.4 88.5 Z';
const BUBBLES: [number, number, number, number, number][] = [
  [24, 90, 1, 0, 3.2], [31, 92, 0.8, 1.1, 3.4], [38, 89, 1.2, 0.5, 2.9], [43, 91, 0.7, 2, 3.2], [28, 90, 0.9, 2.6, 3.8], [35, 92, 0.7, 1.6, 3.1],
];

// A glass filled in the beer's colour (recipeList.ts ebcSwatch) with rising bubbles.
export function BeerGlass({ ebc }: { ebc?: number }) {
  const fill = ebc === undefined ? undefined : ebcSwatch(ebc).bg;
  return (
    <svg viewBox="0 0 64 100" width="68" height="106" class="shrink-0 overflow-visible" role="img"
      aria-label={ebc === undefined ? 'Glas' : `Glas in der berechneten Bierfarbe, ${Math.round(ebc)} EBC`}>
      <defs>
        <clipPath id="beer-glass-in"><path d={OUTLINE} /></clipPath>
        <linearGradient id="beer-glass-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#000" stop-opacity=".18" />
          <stop offset=".25" stop-color="#000" stop-opacity="0" />
          <stop offset=".8" stop-color="#000" stop-opacity="0" />
          <stop offset="1" stop-color="#000" stop-opacity=".22" />
        </linearGradient>
      </defs>
      {fill && (
        <g clip-path="url(#beer-glass-in)">
          <rect x="0" y="17" width="64" height="80" fill={fill} />
          <rect x="0" y="17" width="64" height="80" fill="url(#beer-glass-side)" />
          {BUBBLES.map(([cx, cy, r, delay, dur]) => (
            <circle key={cx} class="bubble" cx={cx} cy={cy} r={r} style={{ animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />
          ))}
          <path d="M8 18.5 Q32 22.5 56 18.5 V21.5 Q32 25 8 21.5 Z" fill="#000" fill-opacity=".12" />
        </g>
      )}
      {fill && (
        <path d="M8.4 12.5 C10.5 6.5 15.5 6.6 18.5 8.2 C21.2 4.8 26.6 4.9 29.6 7.4 C32.6 3.8 39.2 4.2 42 7.4 C45.8 4.6 52.4 6 55.6 12 L55.1 19.8 Q32 23.6 8.9 19.8 Z" fill="#fbf3e3" />
      )}
      <path d="M14.6 24 Q13.4 55 16.6 86" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2.6" stroke-linecap="round" />
      <path d={OUTLINE} fill="none" stroke="var(--muted)" stroke-width="1.2" stroke-linejoin="round" />
      <ellipse cx="32" cy="97.5" rx="17" ry="1.6" fill="#000" fill-opacity=".08" />
    </svg>
  );
}
