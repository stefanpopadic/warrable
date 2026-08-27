import { describe, expect, it } from "vitest";
import {
  amountCents,
  amountCentsForPixels,
  BASE_PRICE_PER_PIXEL_CENTS,
  formatPixelPrice,
  getPricingTier,
  isRectInBounds,
  MIN_PRINTED_PIXELS,
  nextPricePerPixelCents,
  pricePerPixelCents,
  printedPixels,
  TIER_PIXELS,
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
  it("accepts a rectangle touching the bottom-right boundary", () => {
    expect(isRectInBounds({ x: 59, y: 83, w: 1, h: 1 })).toBe(true);
  });

  it("rejects fractional, zero-sized and overflowing rectangles", () => {
    expect(isRectInBounds({ x: 0.5, y: 0, w: 1, h: 1 })).toBe(false);
    expect(isRectInBounds({ x: 0, y: 0, w: 0, h: 1 })).toBe(false);
    expect(isRectInBounds({ x: 59, y: 83, w: 2, h: 1 })).toBe(false);
  });
});
