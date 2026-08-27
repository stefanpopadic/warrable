import {
  CELL_PX,
  COLS,
  formatPixelPrice,
  pricePerPixelCents,
  ROWS,
  usdFromCents,
} from "@/lib/auction";

export { CELL_PX, COLS, ROWS };

export function pricePerPixel(pixelsSold: number) {
  return pricePerPixelCents(pixelsSold) / 100;
}

export function cellPrice(pixelsSold: number) {
  return (CELL_PX * CELL_PX * pricePerPixelCents(pixelsSold)) / 100;
}

export { formatPixelPrice, usdFromCents as usd };
