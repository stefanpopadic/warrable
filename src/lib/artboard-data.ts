import {
  AUCTION_END,
  getMilestoneState,
  pricePerPixelCents,
  nextPricePerPixelCents,
  pixelsUntilNextTier,
} from "@/lib/auction";
import type { MilestoneState, Rect } from "@/lib/auction";

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
  id: string;
  brand: string;
  url: string;
  logo: string | null;
  creative: string;
  bidCents: number;
  pixels: number;
  linkClicks: number;
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
  milestone: MilestoneState;
  leaderboard: LeaderboardEntry[];
  auctionClosed: boolean;
  auctionEnd: string;
};

export function emptyArtboardSnapshot(): ArtboardSnapshot {
  const milestone = getMilestoneState(0);
  return {
    placements: [],
    occupied: [],
    stats: {
      raisedCents: 0,
      pixelsSold: 0,
      pixelsTotal: milestone.capacityPixels,
      currentPriceCents: pricePerPixelCents(0),
      nextPriceCents: nextPricePerPixelCents(0),
      pixelsUntilNextTier: pixelsUntilNextTier(0),
    },
    milestone,
    leaderboard: [],
    auctionClosed: false,
    auctionEnd: new Date(AUCTION_END).toISOString(),
  };
}
