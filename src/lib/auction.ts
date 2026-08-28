// World grid: the fixed maximum coordinate space. Every x/y/width/height stored
// in the database is a world coordinate, so milestone growth never migrates rows.
export const WORLD_COLS = 80;
export const WORLD_ROWS = 112;

export const CELL_PX = 10;
export const MIN_PRINTED_PIXELS = 100;
export const RESERVATION_MINUTES = 30;
export const AUCTION_END = Date.UTC(2026, 8, 10, 8, 0, 0);

export const TOTAL_PIXELS = WORLD_COLS * WORLD_ROWS * CELL_PX * CELL_PX;
export const TIER_PIXELS = 100_000;
export const BASE_PRICE_PER_PIXEL_CENTS = 25;

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Milestone = {
  level: number;
  unlockCents: number;
  cols: number;
  rows: number;
};

// Every level is a multiple of 5x7, so the artboard aspect ratio never changes.
// Only cell density changes, which is what produces the zoom-out effect.
export const MILESTONES: Milestone[] = [
  { level: 0, unlockCents: 0, cols: 20, rows: 28 },
  { level: 1, unlockCents: 10_000_00, cols: 30, rows: 42 },
  { level: 2, unlockCents: 25_000_00, cols: 40, rows: 56 },
  { level: 3, unlockCents: 50_000_00, cols: 50, rows: 70 },
  { level: 4, unlockCents: 100_000_00, cols: 60, rows: 84 },
  { level: 5, unlockCents: 250_000_00, cols: 70, rows: 98 },
];

export const MAX_MILESTONE_LEVEL = MILESTONES.length - 1;

export function milestoneForRaised(raisedCents: number): Milestone {
  let current = MILESTONES[0];
  for (const milestone of MILESTONES) {
    if (raisedCents >= milestone.unlockCents) current = milestone;
    else break;
  }
  return current;
}

export function nextMilestone(raisedCents: number): Milestone | null {
  return MILESTONES.find((m) => raisedCents < m.unlockCents) ?? null;
}

/** Centered sub-rectangle of the world grid for a milestone level. */
export function viewportForLevel(level: number): Rect {
  const clamped = Math.min(Math.max(0, Math.round(level)), MAX_MILESTONE_LEVEL);
  const { cols, rows } = MILESTONES[clamped];
  return {
    x: (WORLD_COLS - cols) / 2,
    y: (WORLD_ROWS - rows) / 2,
    w: cols,
    h: rows,
  };
}

export function viewportForRaised(raisedCents: number): Rect {
  return viewportForLevel(milestoneForRaised(raisedCents).level);
}

export type MilestoneState = {
  level: number;
  cols: number;
  rows: number;
  viewport: Rect;
  unlockCents: number;
  nextUnlockCents: number | null;
  progressRatio: number;
  capacityPixels: number;
};

export function getMilestoneState(raisedCents: number): MilestoneState {
  const current = milestoneForRaised(raisedCents);
  const next = nextMilestone(raisedCents);
  const span = next ? next.unlockCents - current.unlockCents : 0;
  const progressRatio =
    next && span > 0
      ? Math.min(1, Math.max(0, (raisedCents - current.unlockCents) / span))
      : 1;

  return {
    level: current.level,
    cols: current.cols,
    rows: current.rows,
    viewport: viewportForLevel(current.level),
    unlockCents: current.unlockCents,
    nextUnlockCents: next?.unlockCents ?? null,
    progressRatio,
    capacityPixels: current.cols * current.rows * CELL_PX * CELL_PX,
  };
}

export type PricingTier = {
  currentPriceCents: number;
  nextPriceCents: number | null;
  pixelsUntilNextTier: number;
};

export function tierIndexForPixelsSold(pixelsSold: number) {
  if (TIER_PIXELS <= 0) return 0;
  const maxTier = Math.max(0, Math.ceil(TOTAL_PIXELS / TIER_PIXELS) - 1);
  return Math.min(Math.max(0, Math.floor(pixelsSold / TIER_PIXELS)), maxTier);
}

export function pricePerPixelCentsForTier(tierIndex: number) {
  return BASE_PRICE_PER_PIXEL_CENTS * 2 ** tierIndex;
}

export function pricePerPixelCents(pixelsSold: number) {
  return pricePerPixelCentsForTier(tierIndexForPixelsSold(pixelsSold));
}

export function nextPricePerPixelCents(pixelsSold: number) {
  const nextTier = tierIndexForPixelsSold(pixelsSold) + 1;
  const maxTier = Math.max(0, Math.ceil(TOTAL_PIXELS / TIER_PIXELS) - 1);
  if (nextTier > maxTier) return null;
  return pricePerPixelCentsForTier(nextTier);
}

export function pixelsUntilNextTier(pixelsSold: number) {
  const tier = tierIndexForPixelsSold(pixelsSold);
  const nextThreshold = (tier + 1) * TIER_PIXELS;
  if (nextThreshold > TOTAL_PIXELS) return 0;
  return Math.max(0, nextThreshold - pixelsSold);
}

export function getPricingTier(pixelsSold: number): PricingTier {
  return {
    currentPriceCents: pricePerPixelCents(pixelsSold),
    nextPriceCents: nextPricePerPixelCents(pixelsSold),
    pixelsUntilNextTier: pixelsUntilNextTier(pixelsSold),
  };
}

export function formatPixelPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function isIntegerRect(rect: Rect) {
  return [rect.x, rect.y, rect.w, rect.h].every(Number.isInteger);
}

export function isRectInBounds(rect: Rect) {
  return (
    isIntegerRect(rect) &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.w >= 1 &&
    rect.h >= 1 &&
    rect.x + rect.w <= WORLD_COLS &&
    rect.y + rect.h <= WORLD_ROWS
  );
}

/** A rect must sit inside the unlocked viewport, not just inside the world grid. */
export function isRectInViewport(rect: Rect, viewport: Rect) {
  return (
    isRectInBounds(rect) &&
    rect.x >= viewport.x &&
    rect.y >= viewport.y &&
    rect.x + rect.w <= viewport.x + viewport.w &&
    rect.y + rect.h <= viewport.y + viewport.h
  );
}

/** True when outer fully covers inner (inclusive cell ranges). */
export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.w >= inner.x + inner.w &&
    outer.y + outer.h >= inner.y + inner.h
  );
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export type AutoStackOptions = {
  placements: Rect[];
  targetCells: number;
  creativeAspect?: number;
  variationIndex?: number;
  /** Unlocked area of the world grid. Defaults to the level 0 viewport. */
  viewport?: Rect;
};

export type AutoStackResult = {
  x: number;
  y: number;
  w: number;
  h: number;
  exact: boolean;
};

/** Free cells left inside the unlocked viewport. */
export function freeCellsInViewport(placements: Rect[], viewport: Rect) {
  let occupied = 0;
  for (let y = viewport.y; y < viewport.y + viewport.h; y++) {
    for (let x = viewport.x; x < viewport.x + viewport.w; x++) {
      if (placements.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h)) {
        occupied++;
      }
    }
  }
  return viewport.w * viewport.h - occupied;
}

export function findAutoStackPlacement(options: AutoStackOptions): AutoStackResult | null {
  const {
    placements,
    targetCells,
    creativeAspect = 1.0,
    variationIndex = 0,
    viewport = viewportForLevel(0),
  } = options;

  const safeCells = Math.max(1, Math.min(targetCells, viewport.w * viewport.h));
  const aspect = Math.max(0.2, Math.min(5.0, creativeAspect));

  // Occupancy map spans the whole world so placements just outside the viewport
  // still register as cluster contact along the viewport edge.
  const grid = Array.from({ length: WORLD_ROWS }, () => new Uint8Array(WORLD_COLS));

  for (const p of placements) {
    for (let y = p.y; y < p.y + p.h; y++) {
      for (let x = p.x; x < p.x + p.w; x++) {
        if (y >= 0 && y < WORLD_ROWS && x >= 0 && x < WORLD_COLS) {
          grid[y][x] = 1;
        }
      }
    }
  }

  const minX = viewport.x;
  const minY = viewport.y;
  const maxX = viewport.x + viewport.w;
  const maxY = viewport.y + viewport.h;
  const centerX = viewport.x + viewport.w / 2;
  const centerY = viewport.y + viewport.h / 2;

  // Calculate ideal W based on the uploaded image's aspect ratio
  const idealW = Math.max(1, Math.round(Math.sqrt(safeCells * aspect)));

  // Generate strict candidate dimensions near the natural aspect ratio
  const candidateDimensions: { w: number; h: number; areaDiff: number; aspectDiff: number }[] = [];

  for (let dw = -4; dw <= 4; dw++) {
    const w = idealW + dw;
    if (w < 1 || w > viewport.w || w > safeCells) continue;
    // A bid is a hard spending ceiling. Round the second dimension down so
    // preserving the creative's aspect ratio can never create more paid cells
    // than the buyer requested.
    const h = Math.max(1, Math.floor(safeCells / w));
    if (h > viewport.h) continue;

    const area = w * h;
    const curAspect = w / h;
    const aspectDiff = Math.abs(Math.log(curAspect / aspect));

    // Strict constraint: prevent distorting into thin strips (max ~30% aspect variance)
    if (aspectDiff > 0.32) continue;

    const areaDiff = Math.abs(area - safeCells);
    candidateDimensions.push({ w, h, areaDiff, aspectDiff });
  }

  // Fallback candidate if none passed the strict filter
  if (candidateDimensions.length === 0) {
    const w = Math.min(viewport.w, safeCells, Math.max(1, idealW));
    const h = Math.min(viewport.h, Math.max(1, Math.floor(safeCells / w)));
    candidateDimensions.push({
      w,
      h,
      aspectDiff: 0,
      areaDiff: Math.abs(w * h - safeCells),
    });
  }

  // Sort candidates by closest aspect match and area fit
  candidateDimensions.sort((a, b) => a.aspectDiff * 2 + a.areaDiff - (b.aspectDiff * 2 + b.areaDiff));

  const validOptions: { x: number; y: number; w: number; h: number; score: number; exact: boolean }[] = [];

  for (const dim of candidateDimensions) {
    const { w, h } = dim;

    for (let y = minY; y <= maxY - h; y++) {
      for (let x = minX; x <= maxX - w; x++) {
        // Overlap test
        let blocked = false;
        for (let dy = 0; dy < h && !blocked; dy++) {
          for (let dx = 0; dx < w && !blocked; dx++) {
            if (grid[y + dy][x + dx] !== 0) blocked = true;
          }
        }
        if (blocked) continue;

        // Count ONLY actual contact with other placements (do not count canvas borders)
        let clusterContact = 0;
        if (y > 0) {
          for (let dx = 0; dx < w; dx++) {
            if (grid[y - 1][x + dx] !== 0) clusterContact++;
          }
        }
        if (y + h < WORLD_ROWS) {
          for (let dx = 0; dx < w; dx++) {
            if (grid[y + h][x + dx] !== 0) clusterContact++;
          }
        }
        if (x > 0) {
          for (let dy = 0; dy < h; dy++) {
            if (grid[y + dy][x - 1] !== 0) clusterContact++;
          }
        }
        if (x + w < WORLD_COLS) {
          for (let dy = 0; dy < h; dy++) {
            if (grid[y + dy][x + w] !== 0) clusterContact++;
          }
        }

        // Radial distance from the center of the unlocked viewport
        const rectCenterX = x + w / 2;
        const rectCenterY = y + h / 2;
        const distFromCenter = Math.hypot(
          (rectCenterX - centerX) * 1.0,
          (rectCenterY - centerY) * 0.72,
        );

        // When cluster exists, require placement to touch the cluster
        if (placements.length > 0 && clusterContact === 0) {
          continue;
        }

        // Center vs Perimeter affinity:
        // - Large bids (high cell count) are pulled strongly towards the core center.
        // - Small bids (low cell count) are pushed towards the outer perimeter / edges to frame the core.
        const sizeRatio = Math.min(1.0, Math.max(0, (safeCells - 1) / 36));
        const centerScore = sizeRatio >= 0.25
          ? -distFromCenter * (1.5 + sizeRatio * 4.5) // Large bids pull inward to center
          : distFromCenter * 1.8;                      // Small bids push outward to perimeter edges

        const score =
          clusterContact * 12 +
          centerScore -
          dim.aspectDiff * 50 -
          dim.areaDiff * 5;

        validOptions.push({ x, y, w, h, score, exact: w * h === safeCells });
      }
    }
  }

  // Sort best positions
  validOptions.sort((a, b) => b.score - a.score);

  if (validOptions.length > 0) {
    const idx = Math.abs(variationIndex) % validOptions.length;
    return validOptions[idx];
  }

  // Fallback: if no adjacent placement was found, place closest to center with exact aspect
  let fallbackDist = Infinity;
  let fallbackBest: AutoStackResult | null = null;

  for (let c = safeCells; c >= 1; c--) {
    const w = Math.min(c, Math.max(1, Math.round(Math.sqrt(c * aspect))));
    const h = Math.max(1, Math.floor(c / w));
    if (w <= viewport.w && h <= viewport.h) {
      for (let y = minY; y <= maxY - h; y++) {
        for (let x = minX; x <= maxX - w; x++) {
          let blocked = false;
          for (let dy = 0; dy < h && !blocked; dy++) {
            for (let dx = 0; dx < w && !blocked; dx++) {
              if (grid[y + dy][x + dx] !== 0) blocked = true;
            }
          }
          if (!blocked) {
            const d = Math.hypot(x + w / 2 - centerX, (y + h / 2 - centerY) * 0.72);
            if (d < fallbackDist) {
              fallbackDist = d;
              fallbackBest = { x, y, w, h, exact: c === safeCells };
            }
          }
        }
      }
      if (fallbackBest) return fallbackBest;
    }
  }

  return fallbackBest;
}

export function printedPixels(rect: Pick<Rect, "w" | "h">) {
  return rect.w * rect.h * CELL_PX * CELL_PX;
}

export function amountCentsForPixels(pixelCount: number, pixelsSoldBefore = 0) {
  if (pixelCount <= 0) return 0;

  let remaining = pixelCount;
  let sold = pixelsSoldBefore;
  let totalCents = 0;
  const maxTier = Math.max(0, Math.ceil(TOTAL_PIXELS / TIER_PIXELS) - 1);

  while (remaining > 0) {
    const tier = Math.min(Math.max(0, Math.floor(sold / TIER_PIXELS)), maxTier);
    const priceCents = pricePerPixelCentsForTier(tier);
    const nextThreshold = Math.min((tier + 1) * TIER_PIXELS, TOTAL_PIXELS);
    const pixelsLeftInTier = Math.max(0, nextThreshold - sold);
    if (pixelsLeftInTier === 0) break;

    const chunk = Math.min(remaining, pixelsLeftInTier);
    totalCents += chunk * priceCents;
    remaining -= chunk;
    sold += chunk;
  }

  return totalCents;
}

export function pixelsForBudget(budgetCents: number, pixelsSoldBefore = 0) {
  const maxAvailable = Math.max(0, TOTAL_PIXELS - pixelsSoldBefore);
  if (budgetCents <= 0 || maxAvailable === 0) return 0;

  let lo = 0;
  let hi = maxAvailable;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (amountCentsForPixels(mid, pixelsSoldBefore) <= budgetCents) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function amountCents(rect: Pick<Rect, "w" | "h">, pixelsSold = 0) {
  return amountCentsForPixels(printedPixels(rect), pixelsSold);
}

export function usdFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
