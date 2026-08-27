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
