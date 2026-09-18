import { useEffect, useRef, useState } from 'preact/hooks';
import type { VNode } from 'preact';
import { GripHorizontal } from 'lucide-preact';
import type { LayoutNode } from '../types';
import type { DropTarget, DropZone } from '../dashboardLayout';
import { isSplit, moveRef, nodeAt, refKind, resizeSplit } from '../dashboardLayout';

interface Props {
  layout: LayoutNode;
  editMode: boolean;
  // fill = this item is alone in its area and should stretch to fill it.
  renderItem: (ref: string, fill: boolean) => VNode | null;
  labelOf: (ref: string) => string;
  onChange: (next: LayoutNode) => void;
}

// Band along an area's border that docks beside it instead of joining the group
// inside. Capped in pixels, not taken as a fraction: a quarter of a 1000px-wide
// area would be a 250px band, which swallows the first card and makes the front
// of a group unreachable.
const EDGE_PX = 64;
// ... but never more than a quarter of a small area, or its middle disappears.
const EDGE_MAX_FRACTION = 0.25;
// Pointer distance from the layout's own border that docks against the root.
const ROOT_EDGE_PX = 16;
// Smallest area a divider may leave behind.
const MIN_AREA_PX = 120;
// Pointer travel before a grip press turns into a drag.
const DRAG_START_PX = 4;

interface Rect { left: number; top: number; width: number; height: number }

interface DragState {
  ref: string;
  x: number; y: number;             // pointer in viewport coords (floating label)
  target: DropTarget | null;
  hint: Rect | null;                // where it would land, relative to the root
  bar: Rect | null;                 // insertion caret inside a card group
}

// Which zone of `el` the pointer sits in. Splits only accept edges — their
// middle belongs to the leaves nested inside them.
function zoneOf(el: HTMLElement, x: number, y: number, isLeafEl: boolean): DropZone {
  const r = el.getBoundingClientRect();
  const band = (size: number) => Math.min(EDGE_PX, size * EDGE_MAX_FRACTION);
  const nearest = [
    { zone: 'left' as DropZone, v: x - r.left, band: band(r.width) },
    { zone: 'right' as DropZone, v: r.right - x, band: band(r.width) },
    { zone: 'top' as DropZone, v: y - r.top, band: band(r.height) },
    { zone: 'bottom' as DropZone, v: r.bottom - y, band: band(r.height) },
  ].sort((a, b) => a.v - b.v)[0];
  if (!isLeafEl) return nearest.zone;
  return nearest.v < nearest.band ? nearest.zone : 'center';
}

function parsePath(attr: string): number[] {
  return attr === '' ? [] : attr.split('.').map(Number);
}

function relative(r: Rect, root: DOMRect): Rect {
  return { left: r.left - root.left, top: r.top - root.top, width: r.width, height: r.height };
}

// Half of `r` on the given side — a preview of the area after docking.
function halfOf(r: Rect, zone: DropZone): Rect {
  if (zone === 'left') return { ...r, width: r.width / 2 };
  if (zone === 'right') return { ...r, left: r.left + r.width / 2, width: r.width / 2 };
  if (zone === 'top') return { ...r, height: r.height / 2 };
  if (zone === 'bottom') return { ...r, top: r.top + r.height / 2, height: r.height / 2 };
  return r;
}

// Insert position for a drop into a card group: the first card whose centre the
// pointer has not passed yet in reading order.
function indexAt(leafEl: HTMLElement, x: number, y: number): { index: number; rect: Rect | null; after: boolean } {
  const cards = Array.from(leafEl.querySelectorAll<HTMLElement>('[data-ref]'));
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i].getBoundingClientRect();
    if (y < r.bottom && x < r.left + r.width / 2) {
      return { index: i, rect: r, after: false };
    }
  }
  const last = cards[cards.length - 1];
  return { index: cards.length, rect: last ? last.getBoundingClientRect() : null, after: true };
}

export function DashboardLayout({ layout, editMode, renderItem, labelOf, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Live tree while a divider is being dragged; committed on pointer up.
  const [draft, setDraft] = useState<LayoutNode | null>(null);
  const press = useRef<{ ref: string; x: number; y: number; active: boolean } | null>(null);
  const resize = useRef<
    { path: number[]; index: number; sizes: number[]; total: number; horizontal: boolean; start: number } | null
  >(null);

  const tree = draft ?? layout;

  // Escape aborts a drag in progress.
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { press.current = null; setDrag(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drag]);

  function hitTest(x: number, y: number): Pick<DragState, 'target' | 'hint' | 'bar'> {
    const rootEl = rootRef.current;
    const root = rootEl?.getBoundingClientRect();
    if (!rootEl || !root) return { target: null, hint: null, bar: null };

    // Close to the layout's own border: dock against the whole tree.
    const nearest = Math.min(x - root.left, root.right - x, y - root.top, root.bottom - y);
    if (nearest < ROOT_EDGE_PX) {
      const zone = zoneOf(rootEl, x, y, false);
      return { target: { path: [], zone }, hint: halfOf(relative(root, root), zone), bar: null };
    }

    // Deepest area under the pointer wins (leaves nest inside splits).
    let best: HTMLElement | null = null;
    let bestDepth = -1;
    for (const el of Array.from(rootEl.querySelectorAll<HTMLElement>('[data-path]'))) {
      const r = el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const depth = parsePath(el.dataset.path!).length;
      if (depth >= bestDepth) { best = el; bestDepth = depth; }
    }
    if (!best) return { target: null, hint: null, bar: null };

    const path = parsePath(best.dataset.path!);
    const isLeafEl = best.dataset.kind === 'leaf';
    const zone = zoneOf(best, x, y, isLeafEl);
    const rect = relative(best.getBoundingClientRect(), root);
    if (zone !== 'center') return { target: { path, zone }, hint: halfOf(rect, zone), bar: null };

    const { index, rect: cardRect, after } = indexAt(best, x, y);
    const bar = cardRect
      ? relative({
          left: after ? cardRect.left + cardRect.width + 4 : cardRect.left - 7,
          top: cardRect.top, width: 3, height: cardRect.height,
        }, root)
      : null;
    return { target: { path, zone: 'center', index }, hint: rect, bar };
  }

  // ── Item drag ─────────────────────────────────────────────────────────────

  function onGripDown(e: PointerEvent, ref: string) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    press.current = { ref, x: e.clientX, y: e.clientY, active: false };
  }

  function onGripMove(e: PointerEvent) {
    const p = press.current;
    if (!p) return;
    if (!p.active) {
      if (Math.abs(e.clientX - p.x) < DRAG_START_PX && Math.abs(e.clientY - p.y) < DRAG_START_PX) return;
      p.active = true;
    }
    setDrag({ ref: p.ref, x: e.clientX, y: e.clientY, ...hitTest(e.clientX, e.clientY) });
  }

  function onGripUp() {
    const p = press.current;
    const d = drag;
    press.current = null;
    setDrag(null);
    if (!p || !p.active || !d?.target) return;
    const next = moveRef(layout, d.ref, d.target);
    // Dropping an item back where it already was must not spend a request.
    if (JSON.stringify(next) !== JSON.stringify(layout)) onChange(next);
  }

  // ── Divider drag ──────────────────────────────────────────────────────────

  function onDividerDown(e: PointerEvent, path: number[], index: number) {
    const node = nodeAt(tree, path);
    if (!node || !isSplit(node)) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const container = el.parentElement!.getBoundingClientRect();
    const horizontal = node.split === 'row';
    resize.current = {
      path, index,
      sizes: [...node.sizes],
      total: horizontal ? container.width : container.height,
      horizontal,
      start: horizontal ? e.clientX : e.clientY,
    };
  }

  function onDividerMove(e: PointerEvent) {
    const r = resize.current;
    if (!r) return;
    const delta = (r.horizontal ? e.clientX : e.clientY) - r.start;
    const step = delta / Math.max(r.total, 1);
    const min = MIN_AREA_PX / Math.max(r.total, 1);
    const a = r.sizes[r.index - 1];
    const b = r.sizes[r.index];
    const clamped = Math.max(min - a, Math.min(b - min, step));
    const sizes = [...r.sizes];
    sizes[r.index - 1] = a + clamped;
    sizes[r.index] = b - clamped;
    setDraft(resizeSplit(layout, r.path, sizes));
  }

  function onDividerUp() {
    const r = resize.current;
    const next = draft;
    resize.current = null;
    setDraft(null);
    if (r && next && JSON.stringify(next) !== JSON.stringify(layout)) onChange(next);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  // Plain functions, not nested components: a nested component would be a new
  // type on every render and remount its whole subtree — which for a chart
  // means rebuilding uPlot once per snapshot.

  function itemBox(ref: string, fill: boolean): VNode | null {
    const content = renderItem(ref, fill);
    if (content == null) return null;
    const kind = refKind(ref);
    // A chart or program sharing a group takes the full row; squeezed into one
    // grid column it would be unreadable.
    const wide = !fill && (kind === 'chart' || kind === 'program');
    return (
      <div key={ref} data-ref={ref}
        class={`relative ${wide ? 'col-span-full' : ''} ${fill ? 'flex h-full min-h-0 flex-col' : ''} ${
          drag?.ref === ref ? 'opacity-40' : ''}`}>
        {editMode && (
          <button type="button"
            title="Ziehen zum Verschieben"
            aria-label={`${labelOf(ref)} verschieben`}
            onPointerDown={(e) => onGripDown(e as unknown as PointerEvent, ref)}
            onPointerMove={(e) => onGripMove(e as unknown as PointerEvent)}
            onPointerUp={onGripUp}
            onPointerCancel={onGripUp}
            class="absolute -top-2 left-1/2 z-10 -ml-4 flex h-5 w-8 cursor-grab touch-none items-center justify-center rounded border border-border bg-surface text-faint shadow-elev-2 hover:text-fg active:cursor-grabbing">
            <GripHorizontal size={12} />
          </button>
        )}
        {content}
      </div>
    );
  }

  function renderNode(node: LayoutNode, path: number[]): VNode {
    const key = path.join('.');
    if (!isSplit(node)) {
      const single = node.items.length === 1;
      return (
        <div data-path={key} data-kind="leaf"
          class={`min-h-0 min-w-0 flex-1 overflow-y-auto ${
            editMode ? 'rounded-lg border border-dashed border-border/60 p-2' : ''}`}>
          {single ? itemBox(node.items[0], true) : (
            <div class="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4 [grid-auto-flow:dense] [grid-auto-rows:minmax(72px,auto)]">
              {node.items.map((r) => itemBox(r, false))}
            </div>
          )}
        </div>
      );
    }

    const horizontal = node.split === 'row';
    const kids: VNode[] = [];
    node.children.forEach((child, i) => {
      if (i > 0) {
        // Same size in both modes so toggling edit mode doesn't shift the layout.
        kids.push(
          <div key={`d${i}`}
            onPointerDown={(e) => onDividerDown(e as unknown as PointerEvent, path, i)}
            onPointerMove={(e) => onDividerMove(e as unknown as PointerEvent)}
            onPointerUp={onDividerUp}
            onPointerCancel={onDividerUp}
            class={`shrink-0 touch-none ${horizontal ? 'w-4' : 'h-4'} ${
              editMode
                ? `${horizontal ? 'cursor-col-resize' : 'cursor-row-resize'} rounded hover:bg-accent/30`
                : ''}`} />,
        );
      }
      kids.push(
        <div key={`c${i}`} class="flex min-h-0 min-w-0 flex-col" style={{ flex: `${node.sizes[i]} 1 0` }}>
          {renderNode(child, [...path, i])}
        </div>,
      );
    });
    return <div data-path={key} class={`flex min-h-0 min-w-0 flex-1 ${horizontal ? 'flex-row' : 'flex-col'}`}>{kids}</div>;
  }

  return (
    <div ref={rootRef} class={`relative flex min-h-0 flex-1 flex-col ${drag ? 'select-none' : ''}`}>
      {renderNode(tree, [])}

      {drag?.hint && (
        <div aria-hidden class="pointer-events-none absolute z-30 rounded-lg border-2 border-accent bg-accent/10"
          style={{ left: drag.hint.left, top: drag.hint.top, width: drag.hint.width, height: drag.hint.height }} />
      )}
      {drag?.bar && (
        <div aria-hidden class="pointer-events-none absolute z-30 rounded bg-accent"
          style={{ left: drag.bar.left, top: drag.bar.top, width: drag.bar.width, height: drag.bar.height }} />
      )}
      {drag && (
        <div aria-hidden
          class="pointer-events-none fixed z-50 rounded bg-accent px-2 py-1 text-xs font-medium text-accent-fg shadow-elev-8"
          style={{ left: drag.x + 14, top: drag.y + 14 }}>
          {labelOf(drag.ref)}
        </div>
      )}
    </div>
  );
}
