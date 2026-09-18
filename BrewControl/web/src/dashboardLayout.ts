// Pure tree operations behind the dashboard's drag-and-drop arrangement.
//
// A dashboard layout is a tree of resizable areas (LayoutSplit) whose leaves
// (LayoutLeaf) hold item refs. One ref in a leaf fills the area, several flow as
// a card grid. Nothing here touches the DOM or the network: Dashboard.tsx feeds
// in the stored tree plus the refs a dashboard currently shows, and persists
// whatever comes back.
import type {
  DashboardConfig, LayoutLeaf, LayoutNode, LayoutSplit,
  LogConfig, ProgramConfig, Snapshot, TimerConfig,
} from './types';

export type ItemKind = 'sensor' | 'actuator' | 'controller' | 'chart' | 'program' | 'timer';

const KINDS: string[] = ['sensor', 'actuator', 'controller', 'chart', 'program', 'timer'];

// Kinds that render as a small card and therefore share a leaf comfortably.
const CARD_KINDS: string[] = ['sensor', 'actuator', 'controller', 'timer'];

// Marks the ref being moved while it is inserted elsewhere: keeping a slot of
// the same length leaves every path and index valid between insert and cleanup.
// Never collides with a real ref, which always carries a "kind/" prefix.
const MOVING = '__moving__';

export function refKind(ref: string): ItemKind | null {
  const kind = ref.slice(0, ref.indexOf('/'));
  return KINDS.includes(kind) ? (kind as ItemKind) : null;
}

export function refId(ref: string): string {
  return ref.slice(ref.indexOf('/') + 1);
}

export function isCardRef(ref: string): boolean {
  return CARD_KINDS.includes(ref.slice(0, ref.indexOf('/')));
}

export function isSplit(n: LayoutNode): n is LayoutSplit {
  return (n as LayoutSplit).split !== undefined;
}

function leaf(items: string[]): LayoutLeaf {
  return { items };
}

// == Refs a dashboard actually shows =========================================

// Membership alone isn't enough: a deleted log or program leaves a dangling id
// behind, and those must not reserve layout space (same filter the render path
// applied before).
export function memberRefs(
  dash: DashboardConfig, snap: Snapshot | null,
  logs: LogConfig[], programs: ProgramConfig[], timers: TimerConfig[],
): string[] {
  const refs: string[] = [];
  for (const id of dash.programs ?? []) {
    if (programs.some((p) => p.id === id)) refs.push('program/' + id);
  }
  for (const id of dash.charts ?? []) {
    if (logs.some((l) => l.id === id)) refs.push('chart/' + id);
  }
  const baseIds = new Set(
    (snap?.sensors ?? []).map((s) => (s.id.includes('.') ? s.id.split('.')[0] : s.id)),
  );
  for (const id of dash.sensors ?? []) {
    if (baseIds.has(id)) refs.push('sensor/' + id);
  }
  for (const id of dash.controllers ?? []) {
    if ((snap?.controllers ?? []).some((c) => c.id === id)) refs.push('controller/' + id);
  }
  for (const id of dash.actuators ?? []) {
    if ((snap?.actuators ?? []).some((a) => a.id === id)) refs.push('actuator/' + id);
  }
  for (const id of dash.timers ?? []) {
    if (timers.some((t) => t.id === id)) refs.push('timer/' + id);
  }
  return refs;
}

// == Reading stored trees ====================================================

// The tree comes from the device (or an older UI version), so treat it as
// untrusted input: anything malformed collapses to null and the caller falls
// back to the derived default rather than rendering a broken dashboard.
export function sanitize(raw: unknown): LayoutNode | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.items)) {
    return leaf(o.items.filter((i): i is string => typeof i === 'string'));
  }
  if ((o.split === 'row' || o.split === 'col') && Array.isArray(o.children)) {
    const children = o.children.map(sanitize).filter((c): c is LayoutNode => c != null);
    if (children.length === 0) return null;
    const raws = Array.isArray(o.sizes) ? (o.sizes as unknown[]) : [];
    const sizes = children.map((_, i) => {
      const s = raws[i];
      return typeof s === 'number' && isFinite(s) && s > 0 ? s : 1 / children.length;
    });
    return { split: o.split, sizes, children };
  }
  return null;
}

// == Structure ===============================================================

// Drops empty leaves, dissolves single-child splits, flattens nested splits of
// the same direction and rescales every weight list to sum 1.
export function normalize(n: LayoutNode | null): LayoutNode | null {
  if (n == null) return null;
  if (!isSplit(n)) return n.items.length > 0 ? leaf([...n.items]) : null;

  const children: LayoutNode[] = [];
  const sizes: number[] = [];
  n.children.forEach((child, i) => {
    const c = normalize(child);
    if (c == null) return;
    const w = n.sizes[i] > 0 ? n.sizes[i] : 1 / n.children.length;
    if (isSplit(c) && c.split === n.split) {
      // Nested same-direction split: hoist its children, scaling their weights
      // into the slice the split itself occupied.
      const inner = c.sizes.reduce((a, b) => a + b, 0) || 1;
      c.children.forEach((gc, j) => { children.push(gc); sizes.push((c.sizes[j] / inner) * w); });
    } else {
      children.push(c);
      sizes.push(w);
    }
  });

  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  const total = sizes.reduce((a, b) => a + b, 0) || 1;
  // Three decimals keep the stored JSON small; the 16 KB body limit is shared
  // with the rest of the dashboard config.
  return { split: n.split, sizes: sizes.map((s) => Math.round((s / total) * 1000) / 1000), children };
}

export function nodeAt(n: LayoutNode, path: number[]): LayoutNode | null {
  let cur: LayoutNode = n;
  for (const i of path) {
    if (!isSplit(cur) || cur.children[i] == null) return null;
    cur = cur.children[i];
  }
  return cur;
}

function replaceAt(n: LayoutNode, path: number[], fn: (node: LayoutNode) => LayoutNode): LayoutNode {
  if (path.length === 0) return fn(n);
  if (!isSplit(n)) return n;
  const [i, ...rest] = path;
  const children = n.children.map((c, j) => (j === i ? replaceAt(c, rest, fn) : c));
  return { ...n, children };
}

function mapLeaves(n: LayoutNode, fn: (items: string[]) => string[]): LayoutNode {
  if (!isSplit(n)) return leaf(fn(n.items));
  return { ...n, children: n.children.map((c) => mapLeaves(c, fn)) };
}

// Leaves in reading order, with their paths.
export function leaves(n: LayoutNode, path: number[] = []): { node: LayoutLeaf; path: number[] }[] {
  if (!isSplit(n)) return [{ node: n, path }];
  return n.children.flatMap((c, i) => leaves(c, [...path, i]));
}

export function linearize(n: LayoutNode | null): string[] {
  return n == null ? [] : leaves(n).flatMap((l) => l.node.items);
}

export function findRef(n: LayoutNode, ref: string): { path: number[]; index: number } | null {
  for (const l of leaves(n)) {
    const index = l.node.items.indexOf(ref);
    if (index >= 0) return { path: l.path, index };
  }
  return null;
}

export function renameRef(n: LayoutNode | undefined, oldRef: string, newRef: string): LayoutNode | undefined {
  if (n == null) return n;
  return mapLeaves(n, (items) => items.map((i) => (i === oldRef ? newRef : i)));
}

// == Default arrangement =====================================================

// Mirrors what the hard-coded layout produced: programs in a narrow left
// column, charts stacked top right, every small card in one grid below them.
export function defaultLayout(refs: string[]): LayoutNode | null {
  const programs = refs.filter((r) => refKind(r) === 'program');
  const charts = refs.filter((r) => refKind(r) === 'chart');
  const cards = refs.filter(isCardRef);

  const right: LayoutNode[] = charts.map((c) => leaf([c]));
  const rightSizes: number[] = charts.map(() => (cards.length > 0 ? 0.6 / charts.length : 1 / charts.length));
  if (cards.length > 0) { right.push(leaf(cards)); rightSizes.push(charts.length > 0 ? 0.4 : 1); }

  const main: LayoutNode | null = right.length === 0 ? null
    : right.length === 1 ? right[0]
    : { split: 'col', sizes: rightSizes, children: right };

  if (programs.length > 0) {
    const col: LayoutNode = programs.length === 1
      ? leaf([programs[0]])
      : { split: 'col', sizes: programs.map(() => 1 / programs.length), children: programs.map((p) => leaf([p])) };
    return normalize(main == null ? col : { split: 'row', sizes: [0.25, 0.75], children: [col, main] });
  }
  return normalize(main);
}

// Appends a fresh area at the bottom of the tree.
function appendArea(root: LayoutNode | null, area: LayoutNode): LayoutNode {
  if (root == null) return area;
  if (isSplit(root) && root.split === 'col') {
    const w = 1 / (root.children.length + 1);
    return { split: 'col', sizes: [...root.sizes, w], children: [...root.children, area] };
  }
  return { split: 'col', sizes: [0.7, 0.3], children: [root, area] };
}

// == Reconciliation ==========================================================

// Brings a stored tree in line with what the dashboard currently shows: drops
// refs that are gone (deleted, renamed, unchecked) and places new ones. Called
// on every render, so it must be deterministic.
export function reconcile(layout: LayoutNode | undefined, refs: string[]): LayoutNode | null {
  const stored = sanitize(layout);
  if (stored == null) return defaultLayout(refs);

  const want = new Set(refs);
  const seen = new Set<string>();
  const pruned = normalize(mapLeaves(stored, (items) => items.filter((i) => {
    if (!want.has(i) || seen.has(i)) return false;   // gone, or a duplicate
    seen.add(i);
    return true;
  })));

  const missing = refs.filter((r) => !seen.has(r));
  if (missing.length === 0) return pruned;
  if (pruned == null) return defaultLayout(refs);

  // A newly checked small card joins the last card group instead of opening an
  // area of its own; charts and programs are large widgets and get one.
  let tree: LayoutNode = pruned;
  const newCards = missing.filter(isCardRef);
  if (newCards.length > 0) {
    const target = [...leaves(tree)].reverse().find((l) => l.node.items.some(isCardRef));
    tree = target
      ? replaceAt(tree, target.path, (n) => leaf([...(n as LayoutLeaf).items, ...newCards]))
      : appendArea(tree, leaf(newCards));
  }
  for (const ref of missing.filter((r) => !isCardRef(r))) tree = appendArea(tree, leaf([ref]));
  return normalize(tree);
}

// == Editing =================================================================

export type DropZone = 'center' | 'left' | 'right' | 'top' | 'bottom';

export interface DropTarget {
  path: number[];     // node the pointer is over; [] is the root (edge zones wrap it)
  zone: DropZone;
  index?: number;     // insert position within a leaf, for zone 'center'
}

// Moves one ref to a drop target. The ref keeps a placeholder slot in its old
// leaf while the insert happens, so `target.path` and `target.index` stay valid
// no matter where the ref came from; the placeholder is stripped afterwards.
export function moveRef(layout: LayoutNode, ref: string, target: DropTarget): LayoutNode {
  const marked = mapLeaves(layout, (items) => items.map((i) => (i === ref ? MOVING : i)));
  const node = nodeAt(marked, target.path);
  if (node == null) return layout;

  let inserted: LayoutNode;
  if (target.zone === 'center' && !isSplit(node)) {
    const items = [...node.items];
    const at = Math.max(0, Math.min(target.index ?? items.length, items.length));
    items.splice(at, 0, ref);
    inserted = replaceAt(marked, target.path, () => leaf(items));
  } else {
    const dir: 'row' | 'col' = target.zone === 'left' || target.zone === 'right' ? 'row' : 'col';
    const before = target.zone === 'left' || target.zone === 'top';
    const parentPath = target.path.slice(0, -1);
    const parent = target.path.length > 0 ? nodeAt(marked, parentPath) : null;
    if (parent != null && isSplit(parent) && parent.split === dir) {
      // Same direction as the surrounding split: become a sibling and split the
      // target's share, instead of nesting another level.
      const i = target.path[target.path.length - 1];
      const half = parent.sizes[i] / 2;
      const children = [...parent.children];
      const sizes = [...parent.sizes];
      sizes[i] = half;
      children.splice(before ? i : i + 1, 0, leaf([ref]));
      sizes.splice(before ? i : i + 1, 0, half);
      inserted = replaceAt(marked, parentPath, () => ({ split: dir, sizes, children }));
    } else {
      inserted = replaceAt(marked, target.path, (n) => ({
        split: dir,
        sizes: [0.5, 0.5],
        children: before ? [leaf([ref]), n] : [n, leaf([ref])],
      }));
    }
  }

  const cleaned = mapLeaves(inserted, (items) => items.filter((i) => i !== MOVING));
  return normalize(cleaned) ?? layout;
}

export function resizeSplit(layout: LayoutNode, path: number[], sizes: number[]): LayoutNode {
  const total = sizes.reduce((a, b) => a + b, 0) || 1;
  return replaceAt(layout, path, (n) => (isSplit(n)
    ? { ...n, sizes: sizes.map((s) => Math.round((s / total) * 1000) / 1000) }
    : n));
}
