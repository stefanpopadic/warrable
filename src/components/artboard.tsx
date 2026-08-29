"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, X, AlertCircle, Minus, Plus } from "lucide-react";
import {
  CELL_PX,
  formatPixelPrice,
  usd,
} from "@/lib/artboard";
import { MIN_PRINTED_PIXELS, type Rect } from "@/lib/auction";
import {
  DEFAULT_ASPECT,
  clampAspect,
  packBoard,
  quotePurchase,
  sortLayoutItems,
  type LayoutItem,
} from "@/lib/layout";
import type { ArtboardSnapshot, PublicPlacement } from "@/lib/artboard-data";
import { emptyArtboardSnapshot } from "@/lib/artboard-data";
import { recordPlacementClick } from "@/lib/placement-clicks";
import { trimCreativeFile } from "@/lib/trim-image";

const EMPTY_SNAPSHOT = emptyArtboardSnapshot();
const MIN_CELLS = MIN_PRINTED_PIXELS / (CELL_PX * CELL_PX);

/** Layout id for the logo being previewed. Never collides with a uuid. */
const PREVIEW_ID = "__preview__";
/** Sorts last among equal bids so the newcomer never displaces an existing tie. */
const PREVIEW_TIE_BREAK = "\uffff";

type Props = {
  className?: string;
  buyOpen?: boolean;
  onClose?: () => void;
  onStartDraw?: () => void;
  initialSnapshot?: ArtboardSnapshot;
  snapshotReady?: boolean;
};

/** Position a world-space rect as a percentage of the unlocked viewport. */
function viewportStyle(rect: Rect, viewport: Rect) {
  return {
    left: `${((rect.x - viewport.x) / viewport.w) * 100}%`,
    top: `${((rect.y - viewport.y) / viewport.h) * 100}%`,
    width: `${(rect.w / viewport.w) * 100}%`,
    height: `${(rect.h / viewport.h) * 100}%`,
  };
}

function dollarsToCents(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function ArtboardGrid({
  placements,
  layout,
  preview,
  creative,
  creativeFit,
  viewport,
  buyMode,
  onPlacementActivate,
}: {
  placements: ArtboardSnapshot["placements"];
  layout: Map<string, Rect>;
  preview: Rect | null;
  creative: string | null;
  creativeFit: "contain" | "cover";
  viewport: Rect;
  buyMode: boolean;
  onPlacementActivate?: (placement: PublicPlacement) => void;
}) {
  return (
    <div className="absolute inset-0">
      {placements.map((b) => {
        const rect = layout.get(b.id) ?? b;
        const className =
          "absolute overflow-hidden ring-1 ring-white/15 transition-all duration-700 ease-out hover:z-20 hover:ring-2 hover:ring-white";
        const style = viewportStyle(rect, viewport);
        const img = (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.creative}
            alt={`${b.brand} creative`}
            className={`h-full w-full ${b.creativeFit === "cover" ? "object-cover" : "object-contain"}`}
          />
        );

        if (buyMode && onPlacementActivate) {
          return (
            <button
              key={b.id}
              type="button"
              aria-label={`Extend ${b.brand}, ${usd(b.bidCents)}`}
              onClick={() => onPlacementActivate(b)}
              className={`${className} cursor-pointer`}
              style={style}
            >
              {img}
            </button>
          );
        }

        return (
          <a
            key={b.id}
            href={b.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`${b.brand}, ${usd(b.bidCents)}`}
            onClick={() => recordPlacementClick(b.id)}
            className={className}
            style={style}
          >
            {img}
          </a>
        );
      })}

      {preview && (
        <div
          className="pointer-events-none absolute z-30 border-2 border-[var(--accent-yellow)] bg-[var(--accent-yellow)]/10 shadow-[0_0_15px_rgba(255,230,0,0.4)] transition-all duration-500 ease-out"
          style={viewportStyle(preview, viewport)}
        >
          {creative ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creative}
              alt="Your logo preview"
              draggable={false}
              className={`h-full w-full select-none ${creativeFit === "cover" ? "object-cover" : "object-contain"}`}
            />
          ) : (
            <div className="flex h-full w-full select-none items-center justify-center overflow-hidden bg-[var(--accent-yellow)]/20 p-1 text-center font-display text-[9px] font-bold uppercase tracking-wider text-[var(--accent-yellow)]">
              YOUR SPOT
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TShirtPreview({
  placements,
  layout,
  preview,
  creative,
  creativeFit,
  viewport,
  buyMode,
  onPlacementActivate,
}: {
  placements: ArtboardSnapshot["placements"];
  layout: Map<string, Rect>;
  preview: Rect | null;
  creative: string | null;
  creativeFit: "contain" | "cover";
  viewport: Rect;
  buyMode: boolean;
  onPlacementActivate?: (placement: PublicPlacement) => void;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
      <div className="relative w-[min(100%,760px)]">
        {/* T-Shirt Vector Mockup */}
        <svg
          viewBox="0 0 320 420"
          aria-hidden="true"
          className="w-full drop-shadow-[0_24px_48px_rgba(0,0,0,0.65)]"
        >
          <path
            d="M72 36 Q160 18 248 36 L320 88 L296 132 L272 132 L272 392 L48 392 L48 132 L24 132 L0 88 Z"
            fill="#121212"
            stroke="#2a2a2a"
            strokeWidth="1.5"
          />
          <path
            d="M112 38 Q160 58 208 38 Q160 72 112 38"
            fill="#080808"
            stroke="#1f1f1f"
            strokeWidth="1"
          />
          <path
            d="M48 132 L24 132 L0 88 L24 68 L48 88 Z"
            fill="#0e0e0e"
            stroke="#222"
            strokeWidth="1"
          />
          <path
            d="M272 132 L296 132 L320 88 L296 68 L272 88 Z"
            fill="#0e0e0e"
            stroke="#222"
            strokeWidth="1"
          />
          <image
            href="/1milliondollartshirt-domain.png"
            x="59.2"
            y="72"
            width="201.6"
            height="20.16"
            preserveAspectRatio="xMidYMid meet"
            opacity="0.1"
          />
        </svg>

        {/* Artboard Print Area on the back of shirt */}
        <div
          className="absolute overflow-hidden bg-[#0a0a0a] ring-1 ring-white/10 shadow-inner"
          style={{
            left: "18%",
            top: "23%",
            width: "63%",
            aspectRatio: `${viewport.w} / ${viewport.h}`,
          }}
        >
          <div className="relative h-full w-full">
            <ArtboardGrid
              placements={placements}
              layout={layout}
              preview={preview}
              creative={creative}
              creativeFit={creativeFit}
              viewport={viewport}
              buyMode={buyMode}
              onPlacementActivate={onPlacementActivate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Artboard({
  className = "",
  buyOpen = false,
  onClose,
  initialSnapshot,
}: Props) {
  const [snapshot, setSnapshot] = useState<ArtboardSnapshot>(
    initialSnapshot ?? EMPTY_SNAPSHOT,
  );
  const [creative, setCreative] = useState<string | null>(null);
  const [creativeFile, setCreativeFile] = useState<File | null>(null);
  const [creativeAspect, setCreativeAspect] = useState<number>(DEFAULT_ASPECT);
  // Cover fills the paid rect. Contain left empty bars on product shots that
  // already have black padding baked into the file.
  const [creativeFit] = useState<"contain" | "cover">("cover");
  const [brand, setBrand] = useState("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("25");
  const [bidFocused, setBidFocused] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [extending, setExtending] = useState<PublicPlacement | null>(null);
  const [extendPrompt, setExtendPrompt] = useState<PublicPlacement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const creativeObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialSnapshot) setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const viewport = snapshot.milestone.viewport;
  const pixelsSold = snapshot.stats.pixelsSold;
  /** One minimum purchase, which is what the plus and minus buttons step by. */
  const stepCents = MIN_PRINTED_PIXELS * snapshot.stats.currentPriceCents;

  // Every paid logo is a layout item; reservations are fixed obstacles.
  const paidItems = useMemo<LayoutItem[]>(
    () =>
      (snapshot.occupied ?? [])
        .filter((o) => !o.reserved)
        .map((o) => ({
          id: o.id,
          w: o.w,
          h: o.h,
          bidCents: o.bidCents,
          tieBreak: o.tieBreak,
        })),
    [snapshot.occupied],
  );

  const reservedRects = useMemo<Rect[]>(
    () =>
      (snapshot.occupied ?? [])
        .filter((o) => o.reserved)
        .map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h })),
    [snapshot.occupied],
  );

  const usedCells = useMemo(() => {
    return (
      paidItems.reduce((total, item) => total + item.w * item.h, 0) +
      reservedRects.reduce((total, rect) => total + rect.w * rect.h, 0) +
      snapshot.stats.reservedCells
    );
  }, [paidItems, reservedRects, snapshot.stats.reservedCells]);

  const raisedCents = snapshot.stats.raisedCents;
  const budgetCents = useMemo(() => dollarsToCents(amount), [amount]);

  const extendingAspect = extending ? extending.w / extending.h : 1;
  const extendingCells = extending ? extending.w * extending.h : 0;

  /**
   * Money in, shape out. If the spend would unlock the next milestone, size
   * against that larger board so the shirt zooms out instead of blocking.
   */
  const settle = useCallback(
    (budget: number) =>
      quotePurchase({
        budgetCents: budget,
        pixelsSold,
        raisedCents,
        usedCells,
        aspect: extending ? extendingAspect : creativeAspect,
        minAddedCells: extending ? 1 : MIN_CELLS,
        baseCells: extending ? extendingCells : 0,
        baseBidCents: extending ? extending.bidCents : 0,
      }),
    [
      creativeAspect,
      extending,
      extendingAspect,
      extendingCells,
      pixelsSold,
      raisedCents,
      usedCells,
    ],
  );

  const quote = useMemo(() => settle(budgetCents), [budgetCents, settle]);
  const displayViewport = buyOpen ? quote.viewport : viewport;
  const freeCells = Math.max(0, displayViewport.w * displayViewport.h - usedCells);

  const showPreview = buyOpen && !snapshot.auctionClosed && quote.addedCells > 0;

  // The whole board is a function of the bids, so a preview is just a repack with
  // the buyer's logo folded in. Others visibly shuffle as the amount changes.
  const previewItems = useMemo<LayoutItem[]>(() => {
    if (!showPreview) return paidItems;

    if (extending) {
      return paidItems.map((item) =>
        item.id === extending.id
          ? { ...item, w: quote.dims.w, h: quote.dims.h, bidCents: quote.totalCents }
          : item,
      );
    }

    return [
      ...paidItems,
      {
        id: PREVIEW_ID,
        w: quote.dims.w,
        h: quote.dims.h,
        bidCents: quote.chargeCents,
        tieBreak: PREVIEW_TIE_BREAK,
      },
    ];
  }, [extending, paidItems, quote, showPreview]);

  const packed = useMemo(
    () => packBoard(previewItems, displayViewport, { blocked: reservedRects }),
    [displayViewport, previewItems, reservedRects],
  );

  const layout = useMemo(() => {
    const map = new Map<string, Rect>();
    for (const item of packed ?? []) {
      map.set(item.id, { x: item.x, y: item.y, w: item.w, h: item.h });
    }
    return map;
  }, [packed]);

  const previewRect = showPreview
    ? layout.get(extending ? extending.id : PREVIEW_ID) ?? null
    : null;

  const myRank = useMemo(() => {
    if (!showPreview) return null;
    const id = extending ? extending.id : PREVIEW_ID;
    return sortLayoutItems(previewItems).findIndex((item) => item.id === id) + 1;
  }, [extending, previewItems, showPreview]);

  const topBidder = snapshot.leaderboard[0] ?? null;
  const isTopBidder = Boolean(myRank === 1 && showPreview);

  /**
   * Smallest spend that genuinely clears the leader. Rounding a bid into a whole
   * rectangle can shave cells, so the CTA walks up until the real price wins.
   */
  const takeTopCents = useMemo(() => {
    if (!topBidder) return null;
    const target = topBidder.bidCents;
    const startBudget = extending
      ? Math.max(stepCents, target - extending.bidCents + 1)
      : Math.max(stepCents, target + 1);

    const beats = (budget: number) => {
      const q = settle(budget);
      return (extending ? q.totalCents : q.chargeCents) > target ? q.chargeCents : null;
    };

    // Grow exponentially until we clear #1 (may need a milestone unlock), then
    // binary-search the cheapest charge. A linear walk is too slow once unlock
    // floors push the answer into the thousands of dollars.
    let hi = startBudget;
    let won: number | null = null;
    for (let i = 0; i < 24; i++) {
      won = beats(hi);
      if (won != null) break;
      hi = Math.min(hi * 2, 1_000_000_00);
    }
    if (won == null) return null;

    let lo = startBudget;
    while (hi - lo > stepCents) {
      const mid = Math.round((lo + hi) / 2 / stepCents) * stepCents;
      const charge = beats(mid);
      if (charge != null) {
        won = charge;
        hi = mid;
      } else {
        lo = mid + stepCents;
      }
    }
    return beats(hi) ?? won;
  }, [extending, settle, stepCents, topBidder]);

  const setAmountCents = useCallback((cents: number) => {
    setAmount(String(Math.max(0, Math.round(cents / 100))));
  }, []);

  const floorCells = extending ? 1 : MIN_CELLS;
  const ceilCells = Math.max(floorCells, freeCells);
  const stepFrom = extending ? quote.addedCells : quote.cells;

  /**
   * Steps by one minimum purchase. Nearby budgets often round into the same
   * rectangle, so probe upward until the settled price really moves, otherwise
   * the button would look dead. Probing budgets rather than cell counts keeps
   * the result to an amount the buyer can actually be charged.
   */
  const nudgeAmount = useCallback(
    (direction: 1 | -1) => {
      const current = quote.chargeCents;
      for (let step = 1; step <= ceilCells; step++) {
        const probe = current + direction * stepCents * step;
        if (probe < stepCents) return;

        const next = settle(probe).chargeCents;
        if (direction > 0 ? next > current : next < current) {
          setAmountCents(next);
          return;
        }
      }
    },
    [ceilCells, quote.chargeCents, setAmountCents, settle, stepCents],
  );

  const clearExtendMode = useCallback(() => {
    setExtending(null);
    setExtendPrompt(null);
    setCreative(null);
    setCreativeFile(null);
    setCreativeAspect(DEFAULT_ASPECT);
    setBrand("");
    setUrl("");
    setEmail("");
    setAmount("25");
    setHint(null);
  }, []);

  const beginExtend = useCallback(
    (placement: PublicPlacement) => {
      if (placement.isDemo) {
        setHint("Demo logos cannot be extended.");
        setExtendPrompt(null);
        return;
      }
      setExtending(placement);
      setExtendPrompt(null);
      setBrand(placement.brand);
      setUrl(placement.url.replace(/^https?:\/\//, ""));
      setCreative(placement.creative);
      setCreativeFile(null);
      setCreativeAspect(clampAspect(placement.w / placement.h));
      setAmount("100");
      setHint(null);
    },
    [],
  );

  // Closing the panel drops any half-finished extend.
  useEffect(() => {
    if (!buyOpen) {
      setExtending(null);
      setExtendPrompt(null);
    }
  }, [buyOpen]);

  // Snap the field to what the money actually buys, but never while typing. The
  // settled price is compared against the field itself: two different budgets
  // can round to the same charge, and reacting only to a price change would
  // leave the higher one on screen next to a smaller purchase.
  useEffect(() => {
    if (bidFocused) return;
    const settled = String(Math.max(0, Math.round(quote.chargeCents / 100)));
    if (settled !== amount) setAmount(settled);
  }, [amount, bidFocused, quote.chargeCents]);

  const handleCreativeUpload = (file: File) => {
    void (async () => {
      const trimmed = await trimCreativeFile(file);
      const previousUrl = creativeObjectUrlRef.current;
      creativeObjectUrlRef.current = trimmed.objectUrl;
      setCreativeFile(trimmed.file);
      setCreative(trimmed.objectUrl);
      setCreativeAspect(clampAspect(trimmed.aspect));
      if (previousUrl?.startsWith("blob:")) URL.revokeObjectURL(previousUrl);
    })();
  };

  const identityReady = Boolean(
    brand.trim() && url.trim() && email.trim() && (extending ? creative : creativeFile),
  );
  const checkoutDisabled =
    !identityReady ||
    !termsAccepted ||
    checkoutLoading ||
    snapshot.auctionClosed ||
    quote.addedCells < 1 ||
    quote.chargeCents <= 0 ||
    !packed;

  const placeBid = async () => {
    if (checkoutDisabled) return;

    setCheckoutLoading(true);
    setHint(null);

    const formData = new FormData();
    formData.set("brand", brand.trim());
    const website = url.trim();
    formData.set(
      "website",
      website.startsWith("http://") || website.startsWith("https://")
        ? website
        : `https://${website}`,
    );
    formData.set("email", email.trim());
    formData.set("creativeFit", creativeFit);
    formData.set("cells", String(quote.addedCells));
    formData.set("aspect", String(creativeAspect));
    formData.set("termsAccepted", "true");
    if (extending) {
      formData.set("extendPlacementId", extending.id);
    } else if (creativeFile) {
      formData.set("creative", creativeFile);
    }

    try {
      const response = await fetch("/api/checkout", { method: "POST", body: formData });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to start checkout.");
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      setCheckoutLoading(false);
      setHint(err instanceof Error ? err.message : "Checkout error occurred.");
    }
  };

  const quickAdds = [100_00, 500_00];

  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      {/* Main T-Shirt Mockup Area */}
      <div
        className={`h-full w-full transition-[padding] duration-500 ease-out ${
          buyOpen ? "pr-0 lg:pr-96" : "pr-0"
        }`}
      >
        <TShirtPreview
          placements={snapshot.placements}
          layout={layout}
          preview={extending ? null : previewRect}
          creative={creative}
          creativeFit={creativeFit}
          viewport={displayViewport}
          buyMode={buyOpen && !snapshot.auctionClosed}
          onPlacementActivate={(placement) => {
            if (extending?.id === placement.id) return;
            setExtendPrompt(placement);
            setHint(null);
          }}
        />
      </div>

      {extendPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm border border-border bg-card p-5 text-left shadow-2xl">
            <p className="font-condensed text-xs uppercase tracking-widest text-muted-foreground">
              Existing placement
            </p>
            <h3 className="mt-2 font-display text-2xl uppercase leading-none tracking-wide">
              Extend {extendPrompt.brand}?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {extendPrompt.isDemo
                ? "Demo logos cannot be extended. Pick a free spot for a new purchase."
                : "Add pixels to this logo and pay only for what you add. The bigger it gets, the closer to the center it moves."}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {!extendPrompt.isDemo && (
                <button
                  type="button"
                  onClick={() => beginExtend(extendPrompt)}
                  className="h-11 w-full bg-[var(--accent-yellow)] font-display text-sm tracking-wide text-black hover:bg-white"
                >
                  YES, EXTEND THIS BID
                </button>
              )}
              <button
                type="button"
                onClick={() => setExtendPrompt(null)}
                className="h-11 w-full border border-border font-display text-sm tracking-wide text-foreground hover:bg-secondary"
              >
                {extendPrompt.isDemo ? "CLOSE" : "NO, BUY A NEW SPOT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buy Panel Drawer */}
      <aside
        className={`absolute right-0 top-0 bottom-0 z-40 w-full overflow-y-auto border-l border-border bg-card/95 backdrop-blur transition-transform duration-500 ease-out sm:w-80 lg:w-96 ${
          buyOpen ? "pointer-events-auto translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border/40 bg-card/95 p-4 backdrop-blur">
          <div>
            <p className="font-display text-lg tracking-wide">
              {extending ? "ADD MORE SPACE" : "BUY SPACE ON THE SHIRT"}
            </p>
            <p className="mt-0.5 font-condensed text-xs uppercase tracking-widest text-muted-foreground">
              {formatPixelPrice(snapshot.stats.currentPriceCents)} / pixel ·{" "}
              {formatPixelPrice(stepCents)} minimum
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close buy panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-5 p-4">
          {extending ? (
            <div className="flex items-start justify-between gap-3 border border-[var(--accent-yellow)]/40 bg-[var(--accent-yellow)]/10 p-3">
              <div className="min-w-0">
                <p className="font-condensed text-[10px] uppercase tracking-widest text-[var(--accent-yellow)]">
                  Extending
                </p>
                <p className="mt-1 truncate font-display text-lg leading-none tracking-wide text-white">
                  {extending.brand}
                </p>
                <p className="mt-1 font-condensed text-xs text-muted-foreground">
                  Now {usd(extending.bidCents)} · {extending.pixels.toLocaleString()} px
                </p>
              </div>
              <button
                type="button"
                onClick={clearExtendMode}
                className="shrink-0 font-condensed text-xs uppercase tracking-wider text-muted-foreground underline hover:text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                Upload Logo / Creative
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCreativeUpload(file);
                }}
              />
              {creative ? (
                <div className="flex items-center gap-3 rounded border border-border bg-black/40 p-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-border bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={creative}
                      alt="Creative preview"
                      className={`h-full w-full ${creativeFit === "cover" ? "object-cover" : "object-contain"}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {creativeFile?.name}
                    </p>
                    <p className="font-condensed text-[11px] text-muted-foreground">
                      Ratio: {creativeAspect.toFixed(2)} : 1
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 font-condensed text-xs text-[var(--accent-yellow)] underline hover:text-white"
                    >
                      Change file
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-[270px] w-full flex-col items-center justify-center gap-2 rounded border border-dashed border-border bg-secondary/30 p-5 text-center transition-colors hover:border-foreground/40 hover:bg-secondary/50"
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="font-condensed text-xs uppercase tracking-wider text-muted-foreground">
                    Click to upload logo (PNG, JPG, WebP)
                  </span>
                  <span className="font-condensed text-[11px] text-muted-foreground/70">
                    Your space keeps your logo&apos;s own shape
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Brand Name */}
          <div>
            <label className="mb-1.5 block font-condensed text-xs uppercase tracking-widest text-muted-foreground">
              Brand Name
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Acme Corp"
              maxLength={80}
              readOnly={Boolean(extending)}
              className="h-10 w-full rounded border border-border bg-background px-3 font-sans text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none read-only:opacity-70"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="mb-1.5 block font-condensed text-xs uppercase tracking-widest text-muted-foreground">
              Website URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. acme.com"
              readOnly={Boolean(extending)}
              className="h-10 w-full rounded border border-border bg-background px-3 font-sans text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none read-only:opacity-70"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block font-condensed text-xs uppercase tracking-widest text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. you@brand.com"
              className="h-10 w-full rounded border border-border bg-background px-3 font-sans text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none"
            />
            {extending && (
              <p className="mt-1.5 font-condensed text-[11px] text-muted-foreground">
                Must match the email from your original purchase.
              </p>
            )}
          </div>

          {/* Leaderboard target */}
          {topBidder && !isTopBidder && (
            <div className="border border-[var(--accent-yellow)]/35 bg-[var(--accent-yellow)]/8 p-3">
              <div className="flex items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-condensed text-[10px] uppercase tracking-widest text-muted-foreground">
                    Current #1
                  </p>
                  <p className="mt-1 truncate font-display text-lg leading-none tracking-wide text-white">
                    {topBidder.brand}
                  </p>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <p className="font-display text-xl leading-none text-white">
                    {usd(topBidder.bidCents)}
                  </p>
                  <p className="mt-1 font-condensed text-[10px] uppercase tracking-widest text-muted-foreground">
                    {topBidder.pixels.toLocaleString()} px
                  </p>
                </div>
              </div>

              {takeTopCents ? (
                <button
                  type="button"
                  onClick={() => setAmountCents(takeTopCents)}
                  className="mt-3 h-10 w-full bg-[var(--accent-yellow)] px-3 font-display text-sm tracking-wide text-black transition hover:bg-white"
                >
                  TAKE #1 · {extending ? "+" : ""}
                  {usd(takeTopCents)}
                </button>
              ) : (
                <p className="mt-3 border-t border-white/10 pt-2 font-condensed text-xs text-muted-foreground">
                  More space must unlock before anyone can take #1.
                </p>
              )}
            </div>
          )}

          {isTopBidder && (
            <p className="border border-emerald-400/40 bg-emerald-400/10 p-3 text-center font-display text-sm tracking-wide text-emerald-300">
              YOU TAKE #1 AND THE CENTER
            </p>
          )}

          {/* Amount */}
          <div>
            <label
              htmlFor="bid-amount"
              className="mb-2 block font-condensed text-xs uppercase tracking-widest text-muted-foreground"
            >
              {extending ? "Add to your bid" : "Your bid"}
            </label>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => nudgeAmount(-1)}
                disabled={stepFrom <= floorCells}
                aria-label={`Lower by ${usd(stepCents)}`}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded border-2 border-[var(--accent-yellow)]/55 bg-background text-[var(--accent-yellow)] transition hover:border-[var(--accent-yellow)] hover:bg-[var(--accent-yellow)] hover:text-black disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:hover:bg-background"
              >
                <Minus className="h-5 w-5" />
              </button>

              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-xl text-muted-foreground">
                  $
                </span>
                <input
                  id="bid-amount"
                  type="text"
                  inputMode="numeric"
                  aria-label={extending ? "Amount to add in USD" : "Your bid in USD"}
                  value={amount}
                  onFocus={() => setBidFocused(true)}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => setBidFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                    e.preventDefault();
                    nudgeAmount(e.key === "ArrowUp" ? 1 : -1);
                  }}
                  className="h-14 w-full rounded border-2 border-[var(--accent-yellow)]/55 bg-background pl-10 pr-4 font-display text-2xl tracking-wide text-white focus:border-[var(--accent-yellow)] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => nudgeAmount(1)}
                disabled={stepFrom >= ceilCells}
                aria-label={`Raise by ${usd(stepCents)}`}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded border-2 border-[var(--accent-yellow)]/55 bg-background text-[var(--accent-yellow)] transition hover:border-[var(--accent-yellow)] hover:bg-[var(--accent-yellow)] hover:text-black disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:hover:bg-background"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {extending && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {quickAdds.map((cents) => (
                  <button
                    key={cents}
                    type="button"
                    onClick={() => setAmountCents(cents)}
                    className="h-9 border border-border font-condensed text-xs uppercase tracking-wider text-foreground transition hover:border-foreground/50 hover:bg-secondary"
                  >
                    +{usd(cents)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmountCents(extending.bidCents)}
                  className="h-9 border border-border font-condensed text-xs uppercase tracking-wider text-foreground transition hover:border-foreground/50 hover:bg-secondary"
                >
                  Double
                </button>
              </div>
            )}

            <p className="mt-2 font-condensed text-xs uppercase tracking-widest text-muted-foreground">
              {extending
                ? `+${(quote.addedCells * CELL_PX * CELL_PX).toLocaleString()} px · new total ${usd(quote.totalCents)} · ${(quote.cells * CELL_PX * CELL_PX).toLocaleString()} px`
                : `${(quote.cells * CELL_PX * CELL_PX).toLocaleString()} px`}
              {myRank ? ` · rank #${myRank}` : ""}
            </p>
          </div>

          {!packed && (
            <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                That is more space than any unlocked shirt size can hold. Try a smaller amount.
              </span>
            </div>
          )}

          {/* Terms Agreement */}
          <label className="flex cursor-pointer items-start gap-2 border-t border-border pt-3 font-condensed text-xs leading-snug text-muted-foreground">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-yellow)]"
            />
            <span>
              I agree to the{" "}
              <a href="/terms" className="underline underline-offset-2 hover:text-foreground">
                Terms
              </a>{" "}
              and{" "}
              <a href="/rules" className="underline underline-offset-2 hover:text-foreground">
                Rules
              </a>
              . All purchases are final and non-refundable.
            </span>
          </label>

          {hint && <p className="font-condensed text-xs text-red-400">{hint}</p>}

          {/* Purchase Button */}
          <button
            type="button"
            onClick={() => void placeBid()}
            disabled={checkoutDisabled}
            className="h-14 w-full rounded bg-foreground px-5 font-display text-lg tracking-wide text-background transition-colors hover:bg-accent-yellow hover:text-accent-yellow-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {snapshot.auctionClosed
              ? "AUCTION CLOSED"
              : checkoutLoading
                ? "RESERVING SPOT…"
                : extending
                  ? `ADD · ${usd(quote.chargeCents)}`
                  : `PURCHASE · ${usd(quote.chargeCents)}`}
          </button>
        </div>
      </aside>
    </div>
  );
}
