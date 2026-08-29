import {
  amountCentsForPixels,
  CELL_PX,
  milestoneForRaised,
  pixelsForBudget,
  viewportForLevel,
  viewportForRaised,
  type Rect,
} from "./auction";

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
/**
 * Contact is scored as a fraction of the item's own perimeter, not as a raw
 * cell count. A wide banner has several times the perimeter of a small logo, so
 * an unnormalized count let big items outscore the distance term entirely and
 * drag the whole cluster off to whichever side already had mass.
 */
const CONTACT_WEIGHT = 20;
const DISTANCE_WEIGHT = 1.35;

/**
 * Max log-ratio a rect may drift from the creative's natural aspect (~8%).
 * Looser drift was filling leftover cells by stretching the slot, which left
 * empty bars inside the logo when object-fit is contain.
 */
const MAX_ASPECT_DRIFT = 0.08;

/**
 * Printable aspect range. Past these bounds a slot becomes a one-cell sliver
 * that reads as a line on the shirt, so extreme creatives are letterboxed into
 * the nearest printable shape rather than sized literally.
 */
export const MIN_ASPECT = 0.2;
export const MAX_ASPECT = 5;
/** Median shape of real placements, used until a buyer uploads their logo. */
export const DEFAULT_ASPECT = 2.5;

export function clampAspect(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return DEFAULT_ASPECT;
  return Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, aspect));
}

export function sortLayoutItems<T extends Pick<LayoutItem, "bidCents" | "tieBreak" | "id">>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (b.bidCents !== a.bidCents) return b.bidCents - a.bidCents;
    if (a.tieBreak !== b.tieBreak) return a.tieBreak < b.tieBreak ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
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
 * Cells to a width/height that keeps the creative's shape. Shape wins over
 * burning every purchased cell: leftover budget is better than empty bars
 * inside the logo. Area never exceeds `cells`.
 */
export function bestDimensions(
  cells: number,
  aspect: number,
  viewport: Rect,
): { w: number; h: number } {
  const safeCells = Math.max(1, Math.min(Math.round(cells), viewport.w * viewport.h));
  const safeAspect = clampAspect(aspect);
  const maxW = Math.min(viewport.w, safeCells);

  type Candidate = { w: number; h: number; aspectDiff: number; area: number };
  const tight: Candidate[] = [];
  const loose: Candidate[] = [];

  for (let w = 1; w <= maxW; w++) {
    const targetH = w / safeAspect;
    const heights = new Set<number>([
      Math.max(1, Math.round(targetH)),
      Math.max(1, Math.floor(targetH)),
      Math.max(1, Math.ceil(targetH)),
      Math.max(1, Math.min(viewport.h, Math.floor(safeCells / w))),
    ]);

    for (const h of heights) {
      if (h < 1 || h > viewport.h) continue;
      const area = w * h;
      if (area < 1 || area > safeCells) continue;

      const aspectDiff = Math.abs(Math.log(w / h / safeAspect));
      const candidate = { w, h, aspectDiff, area };
      if (aspectDiff <= MAX_ASPECT_DRIFT) tight.push(candidate);
      else loose.push(candidate);
    }
  }

  const pool = tight.length > 0 ? tight : loose;
  if (pool.length === 0) {
    return { w: 1, h: 1 };
  }

  // Prefer true shape, then spend as much of the budget as the shape allows.
  pool.sort(
    (a, b) =>
      a.aspectDiff - b.aspectDiff ||
      b.area - a.area ||
      a.w - b.w ||
      a.h - b.h,
  );
  return { w: pool[0].w, h: pool[0].h };
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

/** Ties resolve top-to-bottom then left-to-right, so packing is reproducible. */
function betterCandidate(a: Candidate, b: Candidate | null) {
  if (!b) return true;
  if (a.score !== b.score) return a.score > b.score;
  if (a.ly !== b.ly) return a.ly < b.ly;
  return a.lx < b.lx;
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

    const perimeter = 2 * (w + h);
    let touching: Candidate | null = null;
    let detached: Candidate | null = null;

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

        const candidate = {
          lx,
          ly,
          score:
            contact > 0
              ? (contact / perimeter) * CONTACT_WEIGHT - distance * DISTANCE_WEIGHT
              : -distance,
        };

        if (contact > 0) {
          if (betterCandidate(candidate, touching)) touching = candidate;
        } else if (betterCandidate(candidate, detached)) {
          detached = candidate;
        }
      }
    }

    // Free space can end up disconnected from the cluster, so a detached slot is
    // better than refusing the sale.
    const choice = anchored ? (touching ?? detached) : (detached ?? touching);
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

export type PurchaseQuote = {
  dims: { w: number; h: number };
  cells: number;
  addedCells: number;
  chargeCents: number;
  totalCents: number;
  /** Viewport after this purchase lands — may be a larger milestone. */
  viewport: Rect;
  /** True when the charge unlocks a bigger shirt than the board shows today. */
  unlocksMilestone: boolean;
};

/**
 * Turn a dollar budget into a printable rectangle. The typed budget picks the
 * milestone; the charge is then grown if needed so the payment actually crosses
 * that unlock. Shape always follows the creative — leftover cells beat empty bars.
 */
export function quotePurchase(input: {
  budgetCents: number;
  pixelsSold: number;
  raisedCents: number;
  usedCells: number;
  aspect: number;
  minAddedCells: number;
  /** Current footprint when growing an existing placement. */
  baseCells?: number;
  baseBidCents?: number;
}): PurchaseQuote {
  const baseCells = Math.max(0, input.baseCells ?? 0);
  const baseBidCents = Math.max(0, input.baseBidCents ?? 0);
  const current = milestoneForRaised(input.raisedCents);
  const budget = Math.max(0, input.budgetCents);

  // Typed amount chooses the shirt size. Never shrink back when the shaped
  // rect prices out under the unlock line — grow cells instead.
  const intent = milestoneForRaised(input.raisedCents + budget);
  const viewport = viewportForLevel(intent.level);
  const freeAdded = Math.max(0, viewport.w * viewport.h - input.usedCells);
  const unlockNeed =
    intent.level > current.level
      ? Math.max(0, intent.unlockCents - input.raisedCents)
      : 0;
  const spendFloor = Math.max(budget, unlockNeed);

  const startCells = Math.min(
    Math.max(
      input.minAddedCells,
      Math.round(pixelsForBudget(spendFloor, input.pixelsSold) / (CELL_PX * CELL_PX)),
    ),
    Math.max(input.minAddedCells, freeAdded),
  );

  let dims = { w: 1, h: 1 };
  let addedCells = 0;
  let chargeCents = 0;

  const sizeAdded = (added: number) => {
    if (baseCells > 0) {
      const next = bestDimensions(baseCells + added, input.aspect, viewport);
      return {
        dims: next,
        addedCells: Math.max(0, next.w * next.h - baseCells),
      };
    }
    const next = bestDimensions(added, input.aspect, viewport);
    return { dims: next, addedCells: next.w * next.h };
  };

  let cells = startCells;
  const cellCeiling = Math.max(startCells, freeAdded);
  while (cells <= cellCeiling) {
    const sized = sizeAdded(Math.max(input.minAddedCells, cells));
    dims = sized.dims;
    addedCells = sized.addedCells;
    chargeCents = amountCentsForPixels(
      addedCells * CELL_PX * CELL_PX,
      input.pixelsSold,
    );

    const levelAfter = milestoneForRaised(input.raisedCents + chargeCents).level;
    if (levelAfter >= intent.level && addedCells >= input.minAddedCells) break;

    // Shape can stay fixed across many cell counts; jump to the next rect.
    cells = Math.max(cells + 1, addedCells + 1);
  }

  // Keep spending toward the typed budget with the same shape — unused cells
  // are fine, a half-priced logo for a $2k bid is not.
  while (chargeCents < budget && cells < cellCeiling) {
    cells = Math.max(cells + 1, addedCells + 1);
    const sized = sizeAdded(Math.max(input.minAddedCells, cells));
    if (sized.addedCells <= addedCells) continue;
    dims = sized.dims;
    addedCells = sized.addedCells;
    chargeCents = amountCentsForPixels(
      addedCells * CELL_PX * CELL_PX,
      input.pixelsSold,
    );
  }

  return {
    dims,
    cells: dims.w * dims.h,
    addedCells,
    chargeCents,
    totalCents: baseBidCents + chargeCents,
    viewport: viewportForRaised(input.raisedCents + chargeCents),
    unlocksMilestone:
      milestoneForRaised(input.raisedCents + chargeCents).level > current.level,
  };
}
