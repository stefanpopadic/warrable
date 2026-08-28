import type { Rect } from "@/lib/auction";

/**
 * Deterministic board packer.
 *
 * Nobody picks coordinates on this artboard. Money buys two things: size and
 * closeness to the center. The board is a pure function of the current bids, so
 * the client preview and the server write can never disagree about where a logo
 * ends up.
 */

export type LayoutItem = {
  id: string;
  w: number;
  h: number;
  bidCents: number;
  /** Secondary sort for equal bids. Use paid_at (ISO) so earlier money wins. */
  tieBreak: string;
};

export type PlacedItem = LayoutItem & Rect;

/** Vertical distance counts a little less, so clusters read as wide, not tall. */
const Y_SQUASH = 0.72;
const CONTACT_WEIGHT = 1.8;
const DISTANCE_WEIGHT = 1.35;
const TOP_CHOICES = 14;

/** Max log-ratio a rect may drift from the creative's natural aspect (~30%). */
const MAX_ASPECT_DRIFT = 0.32;

export function sortLayoutItems<T extends Pick<LayoutItem, "bidCents" | "tieBreak" | "id">>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (b.bidCents !== a.bidCents) return b.bidCents - a.bidCents;
    if (a.tieBreak !== b.tieBreak) return a.tieBreak < b.tieBreak ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function stableVariation(id: string, max: number) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return max > 0 ? hash % max : 0;
}

/**
 * Summed-area table over the viewport, so an overlap or edge-contact test is a
 * constant-time lookup instead of a scan. The preview repacks the whole board on
 * every keystroke, which is only affordable at O(1) per candidate position.
 */
class Occupancy {
  private readonly gw: number;
  private readonly gh: number;
  private readonly cells: Uint8Array;
  private sat: Int32Array;
  private dirty = true;

  constructor(private readonly viewport: Rect) {
    this.gw = viewport.w;
    this.gh = viewport.h;
    this.cells = new Uint8Array(this.gw * this.gh);
    this.sat = new Int32Array((this.gw + 1) * (this.gh + 1));
  }

  add(rect: Rect) {
    const x0 = Math.max(0, rect.x - this.viewport.x);
    const y0 = Math.max(0, rect.y - this.viewport.y);
    const x1 = Math.min(this.gw, rect.x + rect.w - this.viewport.x);
    const y1 = Math.min(this.gh, rect.y + rect.h - this.viewport.y);

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) this.cells[y * this.gw + x] = 1;
    }
    this.dirty = true;
  }

  private rebuild() {
    const stride = this.gw + 1;
    for (let y = 0; y < this.gh; y++) {
      let rowSum = 0;
      for (let x = 0; x < this.gw; x++) {
        rowSum += this.cells[y * this.gw + x];
        this.sat[(y + 1) * stride + (x + 1)] = this.sat[y * stride + (x + 1)] + rowSum;
      }
    }
    this.dirty = false;
  }

  /** Occupied cells inside a viewport-local box, clipped to the grid. */
  count(lx: number, ly: number, w: number, h: number) {
    if (this.dirty) this.rebuild();

    const x0 = Math.max(0, lx);
    const y0 = Math.max(0, ly);
    const x1 = Math.min(this.gw, lx + w);
    const y1 = Math.min(this.gh, ly + h);
    if (x1 <= x0 || y1 <= y0) return 0;

    const stride = this.gw + 1;
    return (
      this.sat[y1 * stride + x1] -
      this.sat[y0 * stride + x1] -
      this.sat[y1 * stride + x0] +
      this.sat[y0 * stride + x0]
    );
  }
}

/**
 * Cells to a width/height that keeps the creative's shape. Height rounds down so
 * a bid is a hard ceiling: preserving the aspect ratio can never bill more cells
 * than the buyer asked for.
 */
export function bestDimensions(
  cells: number,
  aspect: number,
  viewport: Rect,
): { w: number; h: number } {
  const safeCells = Math.max(1, Math.min(Math.round(cells), viewport.w * viewport.h));
  const safeAspect = Math.max(0.2, Math.min(5.0, aspect || 1));
  const idealW = Math.max(1, Math.round(Math.sqrt(safeCells * safeAspect)));

  const candidates: { w: number; h: number; aspectDiff: number; areaDiff: number }[] = [];

  for (let dw = -4; dw <= 4; dw++) {
    const w = idealW + dw;
    if (w < 1 || w > viewport.w || w > safeCells) continue;

    const h = Math.max(1, Math.floor(safeCells / w));
    if (h > viewport.h) continue;

    const aspectDiff = Math.abs(Math.log(w / h / safeAspect));
    if (aspectDiff > MAX_ASPECT_DRIFT) continue;

    candidates.push({ w, h, aspectDiff, areaDiff: Math.abs(w * h - safeCells) });
  }

  if (candidates.length === 0) {
    const w = Math.min(viewport.w, safeCells, Math.max(1, idealW));
    const h = Math.min(viewport.h, Math.max(1, Math.floor(safeCells / w)));
    return { w, h };
  }

  candidates.sort((a, b) => a.aspectDiff * 2 + a.areaDiff - (b.aspectDiff * 2 + b.areaDiff));
  return { w: candidates[0].w, h: candidates[0].h };
}

/**
 * Nearest-to-center free rect of an exact size. A fresh reservation needs real
 * coordinates for the overlap constraint, but they are only a holding spot: the
 * packer decides the final position once the payment settles.
 */
export function findFreeRect(
  w: number,
  h: number,
  occupied: Rect[],
  viewport: Rect,
): Rect | null {
  if (w < 1 || h < 1 || w > viewport.w || h > viewport.h) return null;

  const occupancy = new Occupancy(viewport);
  for (const rect of occupied) occupancy.add(rect);

  const centerX = viewport.w / 2;
  const centerY = viewport.h / 2;
  let best: { lx: number; ly: number; distance: number } | null = null;

  for (let ly = 0; ly <= viewport.h - h; ly++) {
    for (let lx = 0; lx <= viewport.w - w; lx++) {
      if (occupancy.count(lx, ly, w, h) > 0) continue;

      const distance = Math.hypot(lx + w / 2 - centerX, (ly + h / 2 - centerY) * Y_SQUASH);
      if (!best || distance < best.distance) best = { lx, ly, distance };
    }
  }

  return best ? { x: viewport.x + best.lx, y: viewport.y + best.ly, w, h } : null;
}

export type PackOptions = {
  /** Rects that must not move, such as live checkout reservations. */
  blocked?: Rect[];
};

type Candidate = { lx: number; ly: number; score: number };

function betterCandidate(a: Candidate, b: Candidate) {
  if (a.score !== b.score) return a.score > b.score;
  if (a.ly !== b.ly) return a.ly < b.ly;
  return a.lx < b.lx;
}

/** Keep only the best TOP_CHOICES slots, so a full scan never sorts thousands. */
function insertTop(top: Candidate[], candidate: Candidate) {
  if (top.length === TOP_CHOICES && !betterCandidate(candidate, top[top.length - 1])) return;

  let i = top.length;
  while (i > 0 && betterCandidate(candidate, top[i - 1])) i--;
  top.splice(i, 0, candidate);
  if (top.length > TOP_CHOICES) top.pop();
}

/**
 * Place every item, biggest bid first, so the leader owns the center and the
 * rest cluster around it. Returns null when the board cannot hold the set, which
 * is the single feasibility gate used by both the preview and checkout.
 */
export function packBoard(
  items: LayoutItem[],
  viewport: Rect,
  options: PackOptions = {},
): PlacedItem[] | null {
  const blocked = options.blocked ?? [];
  const occupancy = new Occupancy(viewport);
  for (const rect of blocked) occupancy.add(rect);

  const centerX = viewport.w / 2;
  const centerY = viewport.h / 2;
  const ordered = sortLayoutItems(items);
  const placed: PlacedItem[] = [];
  let anchored = blocked.length > 0;

  for (const item of ordered) {
    const { w, h } = item;
    if (w < 1 || h < 1 || w > viewport.w || h > viewport.h) return null;

    let nearest: Candidate | null = null;
    const top: Candidate[] = [];
    let touchingCount = 0;

    for (let ly = 0; ly <= viewport.h - h; ly++) {
      for (let lx = 0; lx <= viewport.w - w; lx++) {
        if (occupancy.count(lx, ly, w, h) > 0) continue;

        const distance = Math.hypot(
          lx + w / 2 - centerX,
          (ly + h / 2 - centerY) * Y_SQUASH,
        );

        const contact =
          occupancy.count(lx, ly - 1, w, 1) +
          occupancy.count(lx, ly + h, w, 1) +
          occupancy.count(lx - 1, ly, 1, h) +
          occupancy.count(lx + w, ly, 1, h);

        if (contact > 0) {
          touchingCount++;
          insertTop(top, {
            lx,
            ly,
            score: contact * CONTACT_WEIGHT - distance * DISTANCE_WEIGHT,
          });
        } else if (!nearest || -distance > nearest.score) {
          nearest = { lx, ly, score: -distance };
        }
      }
    }

    // Free space can end up disconnected from the cluster, so a detached slot is
    // better than refusing the sale.
    let choice: Candidate | null = null;
    if (anchored && touchingCount > 0) {
      choice = top[stableVariation(item.id, Math.min(TOP_CHOICES, touchingCount))] ?? top[0];
    } else if (nearest) {
      choice = nearest;
    } else if (touchingCount > 0) {
      choice = top[0];
    }

    if (!choice) return null;

    const rect: Rect = {
      x: viewport.x + choice.lx,
      y: viewport.y + choice.ly,
      w,
      h,
    };
    occupancy.add(rect);
    placed.push({ ...item, ...rect });
    anchored = true;
  }

  return placed;
}
