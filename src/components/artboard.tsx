"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, X, AlertCircle, Trophy } from "lucide-react";
import {
  CELL_PX,
  formatPixelPrice,
  usd,
} from "@/lib/artboard";
import {
  MIN_PRINTED_PIXELS,
  amountCentsForPixels,
  pixelsForBudget,
  findAutoStackPlacement,
  freeCellsInViewport,
  isRectInViewport,
  rectContains,
  rectsOverlap,
  type Rect,
} from "@/lib/auction";
import type { ArtboardSnapshot, PublicPlacement } from "@/lib/artboard-data";
import { emptyArtboardSnapshot } from "@/lib/artboard-data";
import { recordPlacementClick } from "@/lib/placement-clicks";

type Sel = Rect | null;

const EMPTY_SNAPSHOT = emptyArtboardSnapshot();

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

const CORNERS = ["nw", "ne", "sw", "se"] as const;
type Corner = (typeof CORNERS)[number];

const CORNER_STYLES: Record<Corner, string> = {
  nw: "-left-1 -top-1 cursor-nwse-resize",
  ne: "-right-1 -top-1 cursor-nesw-resize",
  sw: "-left-1 -bottom-1 cursor-nesw-resize",
  se: "-right-1 -bottom-1 cursor-nwse-resize",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function moveRect(rect: Rect, dx: number, dy: number, viewport: Rect): Rect {
  return {
    ...rect,
    x: clamp(rect.x + dx, viewport.x, viewport.x + viewport.w - rect.w),
    y: clamp(rect.y + dy, viewport.y, viewport.y + viewport.h - rect.h),
  };
}

/** Drag a corner while the opposite corner stays pinned. Never smaller than one cell. */
function resizeRect(rect: Rect, corner: Corner, dx: number, dy: number, viewport: Rect): Rect {
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  const maxX = viewport.x + viewport.w;
  const maxY = viewport.y + viewport.h;

  let { x, y, w, h } = rect;

  if (corner === "nw" || corner === "sw") {
    x = clamp(rect.x + dx, viewport.x, right - 1);
    w = right - x;
  } else {
    w = clamp(rect.w + dx, 1, maxX - rect.x);
  }

  if (corner === "nw" || corner === "ne") {
    y = clamp(rect.y + dy, viewport.y, bottom - 1);
    h = bottom - y;
  } else {
    h = clamp(rect.h + dy, 1, maxY - rect.y);
  }

  return { x, y, w, h };
}

type DragState = {
  kind: "move" | "resize";
  corner: Corner;
  pointerX: number;
  pointerY: number;
  origin: Rect;
};

function ArtboardGrid({
  placements,
  occupied = [],
  sel,
  creative,
  creativeFit,
  viewport,
  interactive,
  mustContain = null,
  onSelChange,
  onPlacementActivate,
}: {
  placements: ArtboardSnapshot["placements"];
  occupied?: Rect[];
  sel: Sel;
  creative: string | null;
  creativeFit: "contain" | "cover";
  viewport: Rect;
  interactive: boolean;
  mustContain?: Rect | null;
  onSelChange: (rect: Rect) => void;
  onPlacementActivate?: (placement: PublicPlacement) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);

  const beginDrag = (event: React.PointerEvent, kind: DragState["kind"], corner: Corner) => {
    if (!interactive || !sel) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind,
      corner,
      pointerX: event.clientX,
      pointerY: event.clientY,
      origin: sel,
    };
    setDragging(true);
  };

  const continueDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const box = gridRef.current?.getBoundingClientRect();
    if (!drag || !box || box.width === 0 || box.height === 0) return;

    const dx = Math.round((event.clientX - drag.pointerX) / (box.width / viewport.w));
    const dy = Math.round((event.clientY - drag.pointerY) / (box.height / viewport.h));

    const next =
      drag.kind === "move"
        ? moveRect(drag.origin, dx, dy, viewport)
        : resizeRect(drag.origin, drag.corner, dx, dy, viewport);

    if (mustContain && !rectContains(next, mustContain)) return;

    // Reject rather than clamp on collision, so the box sticks at the last legal
    // spot instead of tunnelling through a sold or reserved logo.
    const blockers = occupied.length > 0 ? occupied : placements;
    if (blockers.some((p) => rectsOverlap(next, p))) return;
    onSelChange(next);
  };

  const endDrag = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div ref={gridRef} className="absolute inset-0">
      {/* Existing Placements */}
      {placements.filter((b) => isRectInViewport(b, viewport)).map((b) => {
        const className =
          "absolute overflow-hidden ring-1 ring-white/15 transition-all duration-700 ease-out hover:z-20 hover:ring-2 hover:ring-white";
        const style = viewportStyle(b, viewport);
        const img = (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.creative}
            alt={`${b.brand} creative`}
            className={`h-full w-full ${b.creativeFit === "cover" ? "object-cover" : "object-contain p-1.5"} bg-black/50 transition-transform duration-150`}
          />
        );

        if (interactive && onPlacementActivate) {
          return (
            <button
              key={b.id}
              type="button"
              aria-label={`Extend ${b.brand}, ${usd(b.bidCents)}`}
              onPointerDown={(e) => e.stopPropagation()}
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
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => recordPlacementClick(b.id)}
            className={className}
            style={style}
          >
            {img}
          </a>
        );
      })}

      {/* User Selection Preview — draggable and resizable while the buy panel is open */}
      {sel && (
        <div
          onPointerDown={(e) => beginDrag(e, "move", "se")}
          onPointerMove={continueDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={`absolute z-25 border-2 border-[var(--accent-yellow)] bg-[var(--accent-yellow)]/10 shadow-[0_0_15px_rgba(255,230,0,0.4)] ${
            interactive
              ? `touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`
              : "pointer-events-none animate-pulse overflow-hidden"
          }`}
          style={viewportStyle(sel, viewport)}
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

          {interactive &&
            CORNERS.map((corner) => (
              <span
                key={corner}
                role="presentation"
                onPointerDown={(e) => beginDrag(e, "resize", corner)}
                onPointerMove={continueDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className={`absolute h-2.5 w-2.5 touch-none rounded-[1px] border border-black/70 bg-[var(--accent-yellow)] ${CORNER_STYLES[corner]}`}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function TShirtPreview({
  placements,
  occupied = [],
  sel,
  creative,
  creativeFit,
  viewport,
  interactive,
  mustContain = null,
  onSelChange,
  onPlacementActivate,
}: {
  placements: ArtboardSnapshot["placements"];
  occupied?: Rect[];
  sel: Sel;
  creative: string | null;
  creativeFit: "contain" | "cover";
  viewport: Rect;
  interactive: boolean;
  mustContain?: Rect | null;
  onSelChange: (rect: Rect) => void;
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
              occupied={occupied}
              sel={sel}
              creative={creative}
              creativeFit={creativeFit}
              viewport={viewport}
              interactive={interactive}
              mustContain={mustContain}
              onSelChange={onSelChange}
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
  snapshotReady = false,
}: Props) {
  const [snapshot, setSnapshot] = useState<ArtboardSnapshot>(
    initialSnapshot ?? EMPTY_SNAPSHOT,
  );
  const [creative, setCreative] = useState<string | null>(null);
  const [creativeFile, setCreativeFile] = useState<File | null>(null);
  const [creativeAspect, setCreativeAspect] = useState<number>(1.0);
  const [creativeFit, setCreativeFit] = useState<"contain" | "cover">("contain");
  const [brand, setBrand] = useState("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("25");
  const [bidFocused, setBidFocused] = useState(false);
  const [pixels, setPixels] = useState(String(MIN_PRINTED_PIXELS));
  const [manualSel, setManualSel] = useState<Sel>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [extending, setExtending] = useState<PublicPlacement | null>(null);
  const [extendPrompt, setExtendPrompt] = useState<PublicPlacement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialSnapshot) {
      setSnapshot(initialSnapshot);
    }
  }, [initialSnapshot]);

  const viewport = snapshot.milestone.viewport;

  // Existing placed rects for collision (paid + reserved + pending extensions).
  // While extending, ignore the placement being grown so the box can cover it.
  const placedRects: Rect[] = useMemo(() => {
    const source =
      snapshot.occupied && snapshot.occupied.length > 0
        ? snapshot.occupied
        : (snapshot.placements ?? []).map((p) => ({
            id: p.id,
            x: p.x,
            y: p.y,
            w: p.w,
            h: p.h,
            reserved: false,
          }));
    return source
      .filter((p) => !extending || p.id !== extending.id)
      .map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }));
  }, [snapshot.occupied, snapshot.placements, extending]);

  const freeCells = useMemo(
    () => freeCellsInViewport(placedRects, viewport),
    [placedRects, viewport],
  );

  // Nobody can buy more than the current milestone has unlocked, so both inputs
  // clamp to it rather than quoting a price for space that does not exist yet.
  const maxPurchasablePx = Math.max(MIN_PRINTED_PIXELS, freeCells * CELL_PX * CELL_PX);

  // Target pixels from input
  const targetPx = useMemo(() => {
    const raw = Number(pixels.replace(/[^0-9.]/g, "")) || 0;
    return Math.min(maxPurchasablePx, Math.max(MIN_PRINTED_PIXELS, Math.round(raw)));
  }, [pixels, maxPurchasablePx]);

  // Target grid cells (1 cell = 100 printed pixels)
  const targetCells = useMemo(() => {
    return Math.max(1, Math.round(targetPx / (CELL_PX * CELL_PX)));
  }, [targetPx]);

  // Calculate auto-stack placement (new buys only — extend always uses the original rect).
  const autoPlacedSel: Sel = useMemo(() => {
    if (!buyOpen || extending) return null;
    return findAutoStackPlacement({
      placements: placedRects,
      targetCells,
      creativeAspect,
      variationIndex: 0,
      viewport,
    });
  }, [buyOpen, extending, placedRects, targetCells, creativeAspect, viewport]);

  // A hand-placed rect always wins over the auto-stacker until the buyer resets it.
  const sel: Sel = manualSel ?? autoPlacedSel;

  const effectivePixels = sel ? sel.w * sel.h * CELL_PX * CELL_PX : targetPx;

  const pixelsSoldForPricing = extending
    ? Math.max(0, snapshot.stats.pixelsSold - extending.pixels)
    : snapshot.stats.pixelsSold;

  const totalCents = useMemo(() => {
    return amountCentsForPixels(effectivePixels, pixelsSoldForPricing);
  }, [effectivePixels, pixelsSoldForPricing]);

  const chargeCents = extending
    ? Math.max(0, totalCents - extending.bidCents)
    : totalCents;
  const addedPixels = extending
    ? Math.max(0, effectivePixels - extending.pixels)
    : effectivePixels;

  const topBidder = snapshot.leaderboard[0] ?? null;
  const minimumPurchaseCents = amountCentsForPixels(
    MIN_PRINTED_PIXELS,
    snapshot.stats.pixelsSold,
  );
  const takesTopSpot = Boolean(topBidder && totalCents > topBidder.bidCents);
  const topBidTarget = useMemo(() => {
    if (!topBidder || extending) return null;

    // The logo's aspect ratio means not every cell count forms a valid rectangle.
    // Find the first layout whose real checkout total beats the leader, so the CTA
    // never promises one amount and produces another.
    const firstCandidateCells = Math.max(
      1,
      Math.ceil(
        pixelsForBudget(
          topBidder.bidCents + minimumPurchaseCents,
          snapshot.stats.pixelsSold,
        ) /
          (CELL_PX * CELL_PX),
      ),
    );

    for (let cells = firstCandidateCells; cells <= freeCells; cells++) {
      const placement = findAutoStackPlacement({
        placements: placedRects,
        targetCells: cells,
        creativeAspect,
        variationIndex: 0,
        viewport,
      });
      if (!placement) continue;

      const placementPixels = placement.w * placement.h * CELL_PX * CELL_PX;
      const placementCents = amountCentsForPixels(
        placementPixels,
        snapshot.stats.pixelsSold,
      );
      if (placementCents > topBidder.bidCents) {
        return { cents: placementCents, pixels: placementPixels };
      }
    }

    return null;
  }, [
    creativeAspect,
    extending,
    freeCells,
    minimumPurchaseCents,
    placedRects,
    snapshot.stats.pixelsSold,
    topBidder,
    viewport,
  ]);

  const clampPx = useCallback(
    (px: number) => Math.min(maxPurchasablePx, Math.max(MIN_PRINTED_PIXELS, px)),
    [maxPurchasablePx],
  );

  // Typing a budget or a pixel count means "size this for me", so it hands control
  // back to the auto-stacker.
  const syncFromAmount = useCallback(
    (v: string) => {
      if (extending) return;
      setAmount(v);
      setManualSel(null);
      const dollars = Number(v.replace(/[^0-9.]/g, "")) || 0;
      const px = pixelsForBudget(Math.round(dollars * 100), snapshot.stats.pixelsSold);
      setPixels(String(clampPx(px)));
    },
    [snapshot.stats.pixelsSold, clampPx, extending],
  );

  const beatTopBid = useCallback(() => {
    if (extending) return;
    const targetCents = topBidTarget?.cents ?? minimumPurchaseCents;
    syncFromAmount(String(targetCents / 100));
  }, [extending, minimumPurchaseCents, syncFromAmount, topBidTarget]);

  // Dragging or resizing drives the price, so the budget and pixel fields follow the rect.
  const handleSelChange = useCallback(
    (rect: Rect) => {
      setManualSel(rect);
      const px = rect.w * rect.h * CELL_PX * CELL_PX;
      setPixels(String(px));
      const priced = amountCentsForPixels(
        px,
        extending
          ? Math.max(0, snapshot.stats.pixelsSold - extending.pixels)
          : snapshot.stats.pixelsSold,
      );
      const display = extending ? Math.max(0, priced - extending.bidCents) : priced;
      setAmount(String(Math.round(display / 100)));
    },
    [snapshot.stats.pixelsSold, extending],
  );

  const clearExtendMode = useCallback(() => {
    setExtending(null);
    setExtendPrompt(null);
    setManualSel(null);
    setCreative(null);
    setCreativeFile(null);
    setCreativeAspect(1);
    setBrand("");
    setUrl("");
    setHint(null);
  }, []);

  const beginExtend = useCallback((placement: PublicPlacement) => {
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
    setCreativeFit(placement.creativeFit);
    setManualSel({ x: placement.x, y: placement.y, w: placement.w, h: placement.h });
    setPixels(String(placement.pixels));
    setAmount("0");
    setHint(null);

    const img = new Image();
    img.onload = () => {
      if (img.width && img.height) setCreativeAspect(img.width / img.height);
    };
    img.src = placement.creative;
  }, []);

  // Closing the panel, or the shirt growing to a new milestone, drops a stale rect.
  useEffect(() => {
    if (!buyOpen) {
      setManualSel(null);
      setExtending(null);
      setExtendPrompt(null);
    }
  }, [buyOpen]);

  useEffect(() => {
    setManualSel((current) => {
      if (!current) return null;
      if (extending && !rectContains(current, extending)) return { ...extending };
      const stillValid =
        isRectInViewport(current, viewport) &&
        !placedRects.some((p) => rectsOverlap(current, p));
      return stillValid ? current : extending ? { ...extending } : null;
    });
  }, [viewport, placedRects, extending]);

  useEffect(() => {
    if (!bidFocused) setAmount(String(chargeCents / 100));
  }, [bidFocused, chargeCents]);

  const handleCreativeUpload = (file: File) => {
    setCreativeFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCreative(objectUrl);

    // Detect image dimensions to preserve natural aspect ratio
    const img = new Image();
    img.onload = () => {
      if (img.width && img.height) {
        const aspect = img.width / img.height;
        setCreativeAspect(aspect);
      }
    };
    img.src = objectUrl;
  };

  const identityReady = Boolean(
    brand.trim() &&
      url.trim() &&
      email.trim() &&
      (extending ? creative : creativeFile),
  );
  const checkoutDisabled =
    !identityReady ||
    !termsAccepted ||
    checkoutLoading ||
    !sel ||
    snapshot.auctionClosed ||
    (extending ? chargeCents <= 0 : false);

  const placeBid = async () => {
    if (!termsAccepted || checkoutLoading || !sel) return;
    if (!extending && !creativeFile) return;
    if (extending && chargeCents <= 0) {
      setHint("Drag the corners to grow your space before purchasing.");
      return;
    }

    setCheckoutLoading(true);
    setHint(null);

    const formData = new FormData();
    formData.set("brand", brand.trim());
    const website = url.trim();
    const websiteWithProtocol =
      website.startsWith("http://") || website.startsWith("https://")
        ? website
        : `https://${website}`;
    formData.set("website", websiteWithProtocol);
    formData.set("email", email.trim());
    formData.set("creativeFit", creativeFit);
    formData.set("x", String(sel.x));
    formData.set("y", String(sel.y));
    formData.set("w", String(sel.w));
    formData.set("h", String(sel.h));
    formData.set("termsAccepted", "true");
    if (extending) {
      formData.set("extendPlacementId", extending.id);
    } else if (creativeFile) {
      formData.set("creative", creativeFile);
    }

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        body: formData,
      });

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
          occupied={placedRects}
          sel={sel}
          creative={creative}
          creativeFit={creativeFit}
          viewport={viewport}
          interactive={buyOpen && !snapshot.auctionClosed}
          mustContain={extending}
          onSelChange={handleSelChange}
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
                : "Grow this logo and pay only for the new pixels. Use the same email from the original purchase."}
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
            <p className="font-display text-lg tracking-wide">BUY SPACE ON THE SHIRT</p>
            <p className="mt-0.5 font-condensed text-xs uppercase tracking-widest text-muted-foreground">
              {formatPixelPrice(snapshot.stats.currentPriceCents)} / pixel ·{" "}
              {formatPixelPrice(MIN_PRINTED_PIXELS * snapshot.stats.currentPriceCents)} minimum
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
          {/* Creative Upload */}
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
                  {!extending && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 font-condensed text-xs text-[var(--accent-yellow)] underline hover:text-white"
                    >
                      Change file
                    </button>
                  )}
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
              </button>
            )}
          </div>

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

          {extending && (
            <div className="flex items-start justify-between gap-3 border border-[var(--accent-yellow)]/40 bg-[var(--accent-yellow)]/10 p-3">
              <div>
                <p className="font-condensed text-[10px] uppercase tracking-widest text-[var(--accent-yellow)]">
                  Extending
                </p>
                <p className="mt-1 font-display text-lg leading-none tracking-wide text-white">
                  {extending.brand}
                </p>
                <p className="mt-1 font-condensed text-xs text-muted-foreground">
                  Drag corners to grow. Pay only for new pixels.
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
          )}

          {/* Bid amount and live leaderboard target */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="bid-amount"
                className="font-condensed text-xs uppercase tracking-widest text-muted-foreground"
              >
                {extending ? "Add to bid" : "Your Bid"}
              </label>
            </div>

            {!extending && topBidder ? (
              <div
                className={`mb-3 border p-3 ${
                  takesTopSpot
                    ? "border-emerald-400/40 bg-emerald-400/10"
                    : "border-[var(--accent-yellow)]/35 bg-[var(--accent-yellow)]/8"
                }`}
              >
                <div className="flex items-center">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--accent-yellow)]/50 text-[var(--accent-yellow)]">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div className="ml-3 min-w-0 flex-1">
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

                {takesTopSpot ? (
                  <p className="mt-3 border-t border-emerald-400/20 pt-2 font-condensed text-sm font-semibold text-emerald-300">
                    YOU&apos;RE #1 BY {usd(totalCents - topBidder.bidCents)}
                  </p>
                ) : topBidTarget ? (
                  <button
                    type="button"
                    onClick={beatTopBid}
                    className="mt-3 h-10 w-full bg-[var(--accent-yellow)] px-3 font-display text-sm tracking-wide text-black transition hover:bg-white"
                  >
                    TAKE #1 WITH {usd(topBidTarget.cents)}
                  </button>
                ) : (
                  <p className="mt-3 border-t border-white/10 pt-2 font-condensed text-xs text-muted-foreground">
                    More space must unlock before a new logo can take #1.
                  </p>
                )}
              </div>
            ) : !extending ? (
              <button
                type="button"
                onClick={beatTopBid}
                className="mb-4 h-11 w-full rounded bg-[var(--accent-yellow)] px-3 font-display text-sm tracking-wide text-black transition hover:bg-white"
              >
                BE THE FIRST TOP BIDDER · {usd(minimumPurchaseCents)}
              </button>
            ) : null}

            {extending ? (
              <div className="border-2 border-[var(--accent-yellow)]/55 bg-background px-4 py-3">
                <p className="font-display text-2xl tracking-wide text-white">
                  {usd(chargeCents)}
                </p>
                <p className="mt-1 font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                  +{addedPixels.toLocaleString()} px · new total {usd(totalCents)}
                </p>
              </div>
            ) : (
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-xl text-muted-foreground">
                  $
                </span>
                <input
                  id="bid-amount"
                  type="text"
                  inputMode="numeric"
                  aria-label="Your bid in USD"
                  value={amount}
                  onFocus={() => setBidFocused(true)}
                  onChange={(e) => syncFromAmount(e.target.value)}
                  onBlur={() => setBidFocused(false)}
                  className="h-14 w-full rounded border-2 border-[var(--accent-yellow)]/55 bg-background pl-10 pr-4 font-display text-2xl tracking-wide text-white focus:border-[var(--accent-yellow)] focus:outline-none"
                />
              </div>
            )}
          </div>

          {!sel && (
            <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>No available spot at this bid.</span>
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
                  ? `ADD · ${usd(chargeCents)}`
                  : `PURCHASE · ${usd(chargeCents)}`}
          </button>

        </div>
      </aside>
    </div>
  );
}
