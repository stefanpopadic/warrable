import { AUCTION_END, CELL_PX, COLS, ROWS, TOTAL_PIXELS, pricePerPixelCents, nextPricePerPixelCents, pixelsUntilNextTier } from "@/lib/auction";
import type { Rect } from "@/lib/auction";

export type PublicPlacement = Rect & {
  id: string;
  brand: string;
  url: string;
  creative: string;
  creativeFit: "contain" | "cover";
  bidCents: number;
  pixels: number;
  isDemo: boolean;
};

export type OccupiedRect = Rect & {
  id: string;
  reserved: boolean;
};

export type LeaderboardEntry = {
  rank: number;
  brand: string;
  url: string;
  logo: string;
  bidCents: number;
  pixels: number;
};

export type ArtboardSnapshot = {
  placements: PublicPlacement[];
  occupied: OccupiedRect[];
  stats: {
    raisedCents: number;
    pixelsSold: number;
    pixelsTotal: number;
    currentPriceCents: number;
    nextPriceCents: number | null;
    pixelsUntilNextTier: number;
  };
  leaderboard: LeaderboardEntry[];
  auctionClosed: boolean;
  auctionEnd: string;
};

export function emptyArtboardSnapshot(): ArtboardSnapshot {
  return {
    placements: [],
    occupied: [],
    stats: {
      raisedCents: 0,
      pixelsSold: 0,
      pixelsTotal: TOTAL_PIXELS,
      currentPriceCents: pricePerPixelCents(0),
      nextPriceCents: nextPricePerPixelCents(0),
      pixelsUntilNextTier: pixelsUntilNextTier(0),
    },
    leaderboard: [],
    auctionClosed: false,
    auctionEnd: new Date(AUCTION_END).toISOString(),
  };
}
