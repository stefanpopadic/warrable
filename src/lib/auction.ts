export const COLS = 60;
export const ROWS = 84;
export const CELL_PX = 10;
export const MIN_PRINTED_PIXELS = 100;
export const RESERVATION_MINUTES = 30;
export const AUCTION_END = Date.UTC(2026, 8, 10, 8, 0, 0);

export const TOTAL_PIXELS = COLS * ROWS * CELL_PX * CELL_PX;
export const TIER_PIXELS = 100_000;
export const BASE_PRICE_PER_PIXEL_CENTS = 25;

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

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
    rect.x + rect.w <= COLS &&
    rect.y + rect.h <= ROWS
  );
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
