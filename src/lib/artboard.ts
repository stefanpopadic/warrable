import {
  CELL_PX,
  formatPixelPrice,
  pricePerPixelCents,
  usdFromCents,
  WORLD_COLS,
  WORLD_ROWS,
} from "@/lib/auction";

export { CELL_PX, WORLD_COLS, WORLD_ROWS };

export function pricePerPixel(pixelsSold: number) {
  return pricePerPixelCents(pixelsSold) / 100;
}

export function cellPrice(pixelsSold: number) {
  return (CELL_PX * CELL_PX * pricePerPixelCents(pixelsSold)) / 100;
}

export { formatPixelPrice, usdFromCents as usd };

export function faviconUrlForWebsite(websiteUrl: string, size = 128) {
  try {
    const { hostname } = new URL(websiteUrl);
    if (!hostname) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`;
  } catch {
    return null;
  }
}
