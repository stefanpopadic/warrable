import { describe, expect, it } from "vitest";
import {
  amountCents,
  amountCentsForPixels,
  BASE_PRICE_PER_PIXEL_CENTS,
  findAutoStackPlacement,
  formatPixelPrice,
  freeCellsInViewport,
  getMilestoneState,
  getPricingTier,
  isRectInBounds,
  isRectInViewport,
  MAX_MILESTONE_LEVEL,
  MILESTONES,
  milestoneForRaised,
  MIN_PRINTED_PIXELS,
  nextMilestone,
  nextPricePerPixelCents,
  pricePerPixelCents,
  printedPixels,
  TIER_PIXELS,
  TOTAL_PIXELS,
  viewportForLevel,
  WORLD_COLS,
  WORLD_ROWS,
} from "./auction";

describe("tiered auction pricing", () => {
  it("starts at $0.25 per printed pixel with $0.50 next", () => {
    expect(pricePerPixelCents(0)).toBe(25);
    expect(nextPricePerPixelCents(0)).toBe(50);
    expect(formatPixelPrice(25)).toBe("$0.25");
    expect(formatPixelPrice(50)).toBe("$0.50");
  });

  it("doubles the price every 100k sold pixels for the next marginal pixel", () => {
    expect(pricePerPixelCents(TIER_PIXELS)).toBe(50);
    expect(pricePerPixelCents(TIER_PIXELS * 2)).toBe(100);
    expect(getPricingTier(TIER_PIXELS - 1).currentPriceCents).toBe(25);
    expect(getPricingTier(TIER_PIXELS).currentPriceCents).toBe(50);
  });

  it("prices the minimum block at the current tier rate", () => {
    const minCells = MIN_PRINTED_PIXELS / 100;
    const rect = { w: minCells, h: 1 };
    expect(printedPixels(rect)).toBe(MIN_PRINTED_PIXELS);
    expect(amountCents(rect, 0)).toBe(MIN_PRINTED_PIXELS * BASE_PRICE_PER_PIXEL_CENTS);
  });

  it("splits a large purchase across tier boundaries", () => {
    expect(amountCentsForPixels(100_000, 0)).toBe(25_000_00);
    expect(amountCentsForPixels(100_000, 50_000)).toBe(12_500_00 + 25_000_00);
    expect(amountCentsForPixels(250_000, 0)).toBe(25_000_00 + 50_000_00 + 50_000_00);
  });
});

describe("artboard geometry", () => {
  it("accepts a rectangle touching the bottom-right world boundary", () => {
    expect(isRectInBounds({ x: WORLD_COLS - 1, y: WORLD_ROWS - 1, w: 1, h: 1 })).toBe(true);
  });

  it("rejects fractional, zero-sized and overflowing rectangles", () => {
    expect(isRectInBounds({ x: 0.5, y: 0, w: 1, h: 1 })).toBe(false);
    expect(isRectInBounds({ x: 0, y: 0, w: 0, h: 1 })).toBe(false);
    expect(isRectInBounds({ x: WORLD_COLS - 1, y: WORLD_ROWS - 1, w: 2, h: 1 })).toBe(false);
  });

  it("auto-stacks placements cleanly without overlapping existing placements", () => {
    const viewport = viewportForLevel(0);
    const existing = [{ x: viewport.x, y: viewport.y, w: 5, h: 5 }];
    const placed = findAutoStackPlacement({
      placements: existing,
      targetCells: 16,
      creativeAspect: 1.0,
      viewport,
    });
    expect(placed).not.toBeNull();
    if (placed) {
      expect(isRectInViewport(placed, viewport)).toBe(true);
      const overlapExisting =
        placed.x < existing[0].x + existing[0].w &&
        placed.x + placed.w > existing[0].x &&
        placed.y < existing[0].y + existing[0].h &&
        placed.y + placed.h > existing[0].y;
      expect(overlapExisting).toBe(false);
    }
  });

  it("never rounds a placement above the buyer's cell budget", () => {
    const viewport = viewportForLevel(1);

    for (const targetCells of [1, 2, 7, 17, 33, 97, 149]) {
      for (const creativeAspect of [0.35, 0.75, 1, 1.8, 4]) {
        const placed = findAutoStackPlacement({
          placements: [],
          targetCells,
          creativeAspect,
          viewport,
        });

        expect(placed).not.toBeNull();
        if (placed) expect(placed.w * placed.h).toBeLessThanOrEqual(targetCells);
      }
    }
  });
});

describe("milestone thresholds", () => {
  it("stays on level 0 below the first threshold", () => {
    expect(milestoneForRaised(0).level).toBe(0);
    expect(milestoneForRaised(9_999_99).level).toBe(0);
  });

  it("advances a level exactly at each unlock amount", () => {
    for (const milestone of MILESTONES) {
      expect(milestoneForRaised(milestone.unlockCents).level).toBe(milestone.level);
      if (milestone.level > 0) {
        expect(milestoneForRaised(milestone.unlockCents - 1).level).toBe(milestone.level - 1);
      }
    }
  });

  it("caps at the final level and reports no next milestone", () => {
    const top = MILESTONES[MAX_MILESTONE_LEVEL];
    expect(milestoneForRaised(1_000_000_00).level).toBe(top.level);
    expect(nextMilestone(1_000_000_00)).toBeNull();
    expect(getMilestoneState(1_000_000_00).progressRatio).toBe(1);
  });

  it("reports progress toward the next unlock", () => {
    const state = getMilestoneState(5_000_00);
    expect(state.level).toBe(0);
    expect(state.nextUnlockCents).toBe(10_000_00);
    expect(state.progressRatio).toBeCloseTo(0.5);
  });
});

describe("milestone viewports", () => {
  it("centers every viewport on integer coordinates", () => {
    for (const milestone of MILESTONES) {
      const viewport = viewportForLevel(milestone.level);
      expect(Number.isInteger(viewport.x)).toBe(true);
      expect(Number.isInteger(viewport.y)).toBe(true);
      expect(viewport.x * 2 + viewport.w).toBe(WORLD_COLS);
      expect(viewport.y * 2 + viewport.h).toBe(WORLD_ROWS);
    }
  });

  it("keeps the 5:7 aspect ratio at every level", () => {
    for (const milestone of MILESTONES) {
      expect(milestone.cols * 7).toBe(milestone.rows * 5);
    }
  });

  it("grows monotonically and never exceeds the world grid", () => {
    let previousArea = 0;
    for (const milestone of MILESTONES) {
      const viewport = viewportForLevel(milestone.level);
      const area = viewport.w * viewport.h;
      expect(area).toBeGreaterThan(previousArea);
      previousArea = area;
      expect(viewport.x + viewport.w).toBeLessThanOrEqual(WORLD_COLS);
      expect(viewport.y + viewport.h).toBeLessThanOrEqual(WORLD_ROWS);
    }
  });

  it("clamps out-of-range levels to a valid viewport", () => {
    expect(viewportForLevel(-3)).toEqual(viewportForLevel(0));
    expect(viewportForLevel(99)).toEqual(viewportForLevel(MAX_MILESTONE_LEVEL));
  });

  it("sizes the world so a full sellout can exceed $1M", () => {
    expect(TOTAL_PIXELS).toBe(WORLD_COLS * WORLD_ROWS * 100);
    expect(amountCentsForPixels(TOTAL_PIXELS, 0)).toBeGreaterThan(1_000_000_00);
  });
});

describe("viewport-constrained placement", () => {
  it("never returns a rectangle outside the unlocked viewport", () => {
    for (const milestone of MILESTONES) {
      const viewport = viewportForLevel(milestone.level);
      const placed = findAutoStackPlacement({
        placements: [],
        targetCells: 25,
        creativeAspect: 1.0,
        viewport,
      });
      expect(placed).not.toBeNull();
      if (placed) expect(isRectInViewport(placed, viewport)).toBe(true);
    }
  });

  it("clamps a request larger than the level 0 viewport", () => {
    const viewport = viewportForLevel(0);
    const placed = findAutoStackPlacement({
      placements: [],
      targetCells: viewport.w * viewport.h * 10,
      creativeAspect: 1.0,
      viewport,
    });
    expect(placed).not.toBeNull();
    if (placed) expect(isRectInViewport(placed, viewport)).toBe(true);
  });

  it("keeps every shuffle variation inside the viewport", () => {
    const viewport = viewportForLevel(0);
    const existing = [{ x: viewport.x + 4, y: viewport.y + 6, w: 6, h: 8 }];
    for (let variationIndex = 0; variationIndex < 12; variationIndex++) {
      const placed = findAutoStackPlacement({
        placements: existing,
        targetCells: 9,
        creativeAspect: 1.0,
        variationIndex,
        viewport,
      });
      expect(placed).not.toBeNull();
      if (placed) expect(isRectInViewport(placed, viewport)).toBe(true);
    }
  });

  it("counts free cells inside the viewport only", () => {
    const viewport = viewportForLevel(0);
    expect(freeCellsInViewport([], viewport)).toBe(viewport.w * viewport.h);

    // A rect sitting entirely in the still-locked ring must not consume capacity.
    const outside = [{ x: 0, y: 0, w: 4, h: 4 }];
    expect(freeCellsInViewport(outside, viewport)).toBe(viewport.w * viewport.h);

    const inside = [{ x: viewport.x, y: viewport.y, w: 4, h: 4 }];
    expect(freeCellsInViewport(inside, viewport)).toBe(viewport.w * viewport.h - 16);
  });
});
