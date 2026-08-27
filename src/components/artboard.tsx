"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Focus,
  Maximize2,
  Upload,
  X,
} from "lucide-react";
import {
  COLS,
  ROWS,
  CELL_PX,
  formatPixelPrice,
  usd,
} from "@/lib/artboard";
import { MIN_PRINTED_PIXELS, amountCentsForPixels, pixelsForBudget } from "@/lib/auction";
import type { ArtboardSnapshot } from "@/lib/artboard-data";

type Sel = { x: number; y: number; w: number; h: number } | null;
type ResizeCorner = "nw" | "ne" | "sw" | "se";
type SelectionTransform = {
  mode: "move" | ResizeCorner;
  start: { x: number; y: number };
  initial: NonNullable<Sel>;
};

const EMPTY_SNAPSHOT: ArtboardSnapshot = {
  placements: [],
  occupied: [],
  stats: {
    raisedCents: 0,
    pixelsSold: 0,
    pixelsTotal: COLS * ROWS * CELL_PX * CELL_PX,
    currentPriceCents: 25,
    nextPriceCents: 50,
    pixelsUntilNextTier: 100_000,
  },
  leaderboard: [],
  auctionClosed: false,
  auctionEnd: "",
};

type Props = {
  className?: string;
  buyOpen?: boolean;
  onClose?: () => void;
  onStartDraw?: () => void;
};

type ViewMode = "bidding" | "shirt";

const pct = (n: number, total: number) => `${(n / total) * 100}%`;

function ArtboardGrid({
  placements,
  sel,
  creative,
  creativeFit,
  interactive = false,
  onStartSelectionTransform,
}: {
  placements: ArtboardSnapshot["placements"];
  sel: Sel;
  creative: string | null;
  creativeFit: "contain" | "cover";
  interactive?: boolean;
  onStartSelectionTransform?: (e: PointerEvent, mode: SelectionTransform["mode"]) => void;
}) {
  return (
    <>
      {placements.map((b) => (
        <a
          key={b.id}
          href={b.url}
          target="_blank"
          rel="noreferrer"
          title={`${b.brand} — ${usd(b.bidCents)}`}
          aria-label={`${b.brand}, ${usd(b.bidCents)}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute overflow-hidden ring-1 ring-white/20 hover:z-20 hover:ring-2 hover:ring-white"
          style={{
            left: pct(b.x, COLS),
            top: pct(b.y, ROWS),
            width: pct(b.w, COLS),
            height: pct(b.h, ROWS),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.creative}
            alt={`${b.brand} creative`}
            className={`h-full w-full ${b.creativeFit === "cover" ? "object-cover" : "object-contain"}`}
          />
        </a>
      ))}

      {sel && (
        <div
          className={`group absolute z-10 border-2 border-white ${
            interactive ? "cursor-move" : "pointer-events-none"
          } ${creative ? "bg-transparent" : "bg-white/15"}`}
          style={{
            left: pct(sel.x, COLS),
            top: pct(sel.y, ROWS),
            width: pct(sel.w, COLS),
            height: pct(sel.h, ROWS),
          }}
          onPointerDown={interactive && onStartSelectionTransform ? (e) => onStartSelectionTransform(e, "move") : undefined}
        >
          {creative && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creative}
              alt="Your creative preview"
              className={`pointer-events-none h-full w-full ${
                creativeFit === "cover" ? "object-cover" : "object-contain"
              }`}
            />
          )}
          {interactive &&
            onStartSelectionTransform &&
            (
              [
                ["nw", "-left-2 -top-2 cursor-nwse-resize", "Resize from top left"],
                ["ne", "-right-2 -top-2 cursor-nesw-resize", "Resize from top right"],
                ["sw", "-bottom-2 -left-2 cursor-nesw-resize", "Resize from bottom left"],
                ["se", "-bottom-2 -right-2 cursor-nwse-resize", "Resize from bottom right"],
              ] as const
            ).map(([corner, position, label]) => (
              <button
                key={corner}
                type="button"
                aria-label={label}
                onPointerDown={(e) => onStartSelectionTransform(e, corner)}
                className={`absolute z-20 h-4 w-4 rounded-full border-2 border-black bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 ${position}`}
              />
            ))}
        </div>
      )}
    </>
  );
}

function TShirtPreview({
  placements,
  sel,
  creative,
  creativeFit,
}: {
  placements: ArtboardSnapshot["placements"];
  sel: Sel;
  creative: string | null;
  creativeFit: "contain" | "cover";
}) {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto p-6 pb-20">
      <div className="relative w-[min(100%,380px)]">
        <svg
          viewBox="0 0 320 420"
          aria-hidden="true"
          className="w-full drop-shadow-[0_24px_48px_rgba(0,0,0,0.55)]"
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
        </svg>

        <div
          className="absolute overflow-hidden bg-[#0b0b0b] ring-1 ring-white/10"
          style={{
            left: "18%",
            top: "calc(17% + 10px)",
            width: "63%",
            aspectRatio: `${COLS} / ${ROWS}`,
          }}
        >
          <div className="relative h-full w-full">
            <ArtboardGrid
              placements={placements}
              sel={sel}
              creative={creative}
              creativeFit={creativeFit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewTabs({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const tabs: { id: ViewMode; label: string }[] = [
    { id: "bidding", label: "Bidding area" },
    { id: "shirt", label: "T-shirt" },
  ];

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4">
      <div
        role="tablist"
        aria-label="Artboard view"
        className="pointer-events-auto flex items-center gap-1 rounded border border-border/50 bg-black/85 p-1 backdrop-blur"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={viewMode === tab.id}
            onClick={() => onChange(tab.id)}
            className={`h-10 px-4 font-condensed text-xs uppercase tracking-widest transition-colors ${
              viewMode === tab.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function planRect(cells: number) {
  const c = Math.max(1, Math.round(cells));
  let best = { w: 1, h: c, score: Infinity };
  for (let w = 1; w <= COLS; w++) {
    const h = Math.ceil(c / w);
    if (h > ROWS) continue;
    const score = w * h - c + Math.abs(Math.log(w / h / 1.25)) * 3;
    if (score < best.score) best = { w, h, score };
  }
  return { w: best.w, h: best.h };
}

export default function Artboard({ className = "", buyOpen = false, onClose, onStartDraw }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const selectionTransform = useRef<SelectionTransform | null>(null);
  const [creative, setCreative] = useState<string | null>(null);
  const [creativeFile, setCreativeFile] = useState<File | null>(null);
  const [creativeFit, setCreativeFit] = useState<"contain" | "cover">("contain");
  const [creativeAspect, setCreativeAspect] = useState(1);
  const [snapshot, setSnapshot] = useState<ArtboardSnapshot>(EMPTY_SNAPSHOT);
  const [brand, setBrand] = useState("");
  const [url, setUrl] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [zoom, setZoom] = useState(2);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(
    null,
  );
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [buyStep, setBuyStep] = useState<1 | 2>(1);
  const [amount, setAmount] = useState("25");
  const [pixels, setPixels] = useState(String(MIN_PRINTED_PIXELS));
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("bidding");

  const loadSnapshot = useCallback(async () => {
    const response = await fetch("/api/artboard", { cache: "no-store" });
    if (!response.ok) throw new Error("Artboard availability could not be refreshed.");
    const data = (await response.json()) as ArtboardSnapshot;
    setSnapshot(data);
    return data;
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        if (active) await loadSnapshot();
      } catch (error) {
        if (active) setHint(error instanceof Error ? error.message : "Artboard is unavailable.");
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 15_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadSnapshot]);

  useEffect(
    () => () => {
      if (creative?.startsWith("blob:")) URL.revokeObjectURL(creative);
    },
    [creative],
  );

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const measure = () => {
      const r = vp.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const rightPadding = Number.parseFloat(window.getComputedStyle(vp).paddingRight) || 0;
      const availableWidth = Math.max(1, r.width - rightPadding);
      const h = r.height;
      const w = Math.min(availableWidth, (h * COLS) / ROWS);
      setBase({ w, h: (w * ROWS) / COLS });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    return () => ro.disconnect();
  }, [buyOpen]);

  useEffect(() => {
    if (pinch.current) return;
    const frame = requestAnimationFrame(() => {
      const vp = viewportRef.current;
      if (!vp) return;
      vp.scrollLeft = Math.max(0, (vp.scrollWidth - vp.clientWidth) / 2);
      vp.scrollTop = Math.max(0, (vp.scrollHeight - vp.clientHeight) / 2);
    });
    return () => cancelAnimationFrame(frame);
  }, [zoom, base]);

  useEffect(() => {
    if (buyOpen) {
      setBuyStep(1);
      setAutoNote(null);
      void loadSnapshot().catch(() => undefined);
    }
  }, [buyOpen, loadSnapshot]);

  const occupied = useCallback(
    (x: number, y: number, w: number, h: number) => {
      if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return true;
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++) {
          if (
            snapshot.occupied.some(
              (p) => i >= p.x && i < p.x + p.w && j >= p.y && j < p.y + p.h,
            )
          )
            return true;
        }
      return false;
    },
    [snapshot.occupied],
  );

  const cellFrom = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    const x = clamp(Math.floor(((e.clientX - r.left) / r.width) * COLS), 0, COLS - 1);
    const y = clamp(Math.floor(((e.clientY - r.top) / r.height) * ROWS), 0, ROWS - 1);
    return { x, y };
  };

  const startSelectionTransform = (
    e: PointerEvent,
    mode: SelectionTransform["mode"],
  ) => {
    if (!sel) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    selectionTransform.current = {
      mode,
      start: cellFrom(e),
      initial: { ...sel },
    };
    setHint(null);
  };

  const onPointerDown = (e: PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);

    if (pointers.current.size === 2) {
      setDrag(null);
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, zoom };
      return;
    }

    if (spaceDown || panning) {
      e.preventDefault();
      const v = viewportRef.current;
      if (!v) return;
      setPanning(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: v.scrollLeft,
        scrollTop: v.scrollTop,
      };
      return;
    }

    const c = cellFrom(e);
    if (occupied(c.x, c.y, 1, 1)) {
      setHint("That space is already taken — drag over an empty area.");
      return;
    }
    setHint(null);
    setDrag(c);
    setSel({ ...c, w: 1, h: 1 });
  };

  const onPointerMove = (e: PointerEvent) => {
    const transform = selectionTransform.current;
    if (transform) {
      e.preventDefault();
      const cell = cellFrom(e);
      const { initial } = transform;

      if (transform.mode === "move") {
        const candidate = {
          ...initial,
          x: clamp(initial.x + cell.x - transform.start.x, 0, COLS - initial.w),
          y: clamp(initial.y + cell.y - transform.start.y, 0, ROWS - initial.h),
        };
        if (!occupied(candidate.x, candidate.y, candidate.w, candidate.h)) setSel(candidate);
        return;
      }

      let left = initial.x;
      let top = initial.y;
      let right = initial.x + initial.w;
      let bottom = initial.y + initial.h;

      if (transform.mode.includes("w")) left = clamp(cell.x, 0, right - 1);
      if (transform.mode.includes("e")) right = clamp(cell.x + 1, left + 1, COLS);
      if (transform.mode.includes("n")) top = clamp(cell.y, 0, bottom - 1);
      if (transform.mode.includes("s")) bottom = clamp(cell.y + 1, top + 1, ROWS);

      const candidate = { x: left, y: top, w: right - left, h: bottom - top };
      if (!occupied(candidate.x, candidate.y, candidate.w, candidate.h)) setSel(candidate);
      return;
    }

    if (pointers.current.has(e.pointerId))
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      e.preventDefault();
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
      setZoom(clamp(pinch.current.zoom * (dist / pinch.current.dist), 1, 8));
      return;
    }

    if (panning && panStart.current) {
      e.preventDefault();
      const v = viewportRef.current;
      if (!v) return;
      v.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
      v.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
      return;
    }
    if (!drag) return;
    e.preventDefault();
    const c = cellFrom(e);
    const x = Math.min(drag.x, c.x);
    const y = Math.min(drag.y, c.y);
    const w = Math.abs(c.x - drag.x) + 1;
    const h = Math.abs(c.y - drag.y) + 1;
    if (occupied(x, y, w, h)) return;
    setSel({ x, y, w, h });
  };

  const endPointer = (e?: PointerEvent) => {
    selectionTransform.current = null;
    if (e) pointers.current.delete(e.pointerId);
    else pointers.current.clear();
    if (pointers.current.size < 2) pinch.current = null;
    if (drag && sel && !buyOpen) onStartDraw?.();
    setDrag(null);
    setPanning(false);
    panStart.current = null;
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        selectionTransform.current = null;
        setSel(null);
        onClose?.();
        return;
      }
      if (e.code === "Space" && !spaceDown) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceDown(false);
        setPanning(false);
        panStart.current = null;
      }
    };
    const pointerUp = () => {
      selectionTransform.current = null;
      pointers.current.clear();
      pinch.current = null;
      setDrag(null);
      setPanning(false);
      panStart.current = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointerup", pointerUp);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointerup", pointerUp);
    };
  }, [spaceDown, onClose]);

  const expandToAvailable = () => {
    if (!sel) return;

    let best = sel;
    let bestArea = sel.w * sel.h;
    const selectedBottom = sel.y + sel.h;

    for (let top = sel.y; top >= 0; top -= 1) {
      for (let bottom = selectedBottom; bottom <= ROWS; bottom += 1) {
        const height = bottom - top;
        if (occupied(sel.x, top, sel.w, height)) continue;

        let left = sel.x;
        while (left > 0 && !occupied(left - 1, top, 1, height)) left -= 1;

        let right = sel.x + sel.w;
        while (right < COLS && !occupied(right, top, 1, height)) right += 1;

        const area = (right - left) * height;
        if (area > bestArea) {
          best = { x: left, y: top, w: right - left, h: height };
          bestArea = area;
        }
      }
    }

    if (bestArea === sel.w * sel.h) {
      setHint("This selection already fills all available space around it.");
      return;
    }

    setHint(null);
    setSel(best);
  };

  const fitSelectionToLogo = () => {
    if (!sel) return;

    const area = sel.w * sel.h;
    const targetW = clamp(Math.round(Math.sqrt(area * creativeAspect)), 1, COLS);
    const targetH = clamp(Math.ceil(area / targetW), 1, ROWS);
    const currentCenterX = sel.x + sel.w / 2;
    const currentCenterY = sel.y + sel.h / 2;
    let nearest: Sel = null;
    let nearestDistance = Infinity;

    for (let y = 0; y <= ROWS - targetH; y += 1) {
      for (let x = 0; x <= COLS - targetW; x += 1) {
        if (occupied(x, y, targetW, targetH)) continue;
        const distance =
          Math.abs(x + targetW / 2 - currentCenterX) + Math.abs(y + targetH / 2 - currentCenterY);
        if (distance < nearestDistance) {
          nearest = { x, y, w: targetW, h: targetH };
          nearestDistance = distance;
        }
      }
    }

    if (!nearest) {
      setHint("There isn't enough free space nearby to fit this logo ratio.");
      return;
    }

    setHint(null);
    setSel(nearest);
  };

  const nudge = (dx: number, dy: number) => {
    if (!sel) return;
    const x = clamp(sel.x + dx, 0, COLS - sel.w);
    const y = clamp(sel.y + dy, 0, ROWS - sel.h);
    if (occupied(x, y, sel.w, sel.h)) {
      setHint("Can't move there — that space is sold.");
      return;
    }
    setHint(null);
    setSel({ ...sel, x, y });
  };

  const cells = sel ? sel.w * sel.h : 0;
  const selPixels = cells * CELL_PX * CELL_PX;
  const priceCents = amountCentsForPixels(selPixels, snapshot.stats.pixelsSold);

  const findFree = useCallback(
    (targetCells: number) => {
      for (let c = Math.max(1, targetCells); c >= 1; c--) {
        const { w, h } = planRect(c);
        for (let y = 0; y <= ROWS - h; y++)
          for (let x = 0; x <= COLS - w; x++)
            if (!occupied(x, y, w, h)) return { x, y, w, h, exact: c === targetCells };
      }
      return null;
    },
    [occupied],
  );

  const applyAmount = () => {
    const px = Math.max(100, Math.round(Number(pixels) || 0));
    const targetCells = Math.max(1, Math.round(px / (CELL_PX * CELL_PX)));
    const found = findFree(targetCells);
    if (!found) {
      setAutoNote("The shirt is completely sold out.");
      return;
    }
    setSel({ x: found.x, y: found.y, w: found.w, h: found.h });
    setAutoNote(
      found.exact
        ? null
        : `Not that much free space left — reserved the largest free block instead (${found.w * found.h * CELL_PX * CELL_PX} px).`,
    );
  };

  const syncFromAmount = (v: string) => {
    setAmount(v);
    const dollars = Number(v.replace(/[^0-9.]/g, "")) || 0;
    setPixels(
      String(pixelsForBudget(Math.round(dollars * 100), snapshot.stats.pixelsSold)),
    );
  };

  const syncFromPixels = (v: string) => {
    setPixels(v);
    const px = Number(v.replace(/[^0-9.]/g, "")) || 0;
    setAmount(String(Math.round(amountCentsForPixels(px, snapshot.stats.pixelsSold) / 100)));
  };

  const placeBid = async () => {
    if (!sel || !creativeFile || !termsAccepted || checkoutLoading) return;

    setCheckoutLoading(true);
    setHint(null);
    const formData = new FormData();
    formData.set("brand", brand.trim());
    formData.set("website", url.trim());
    formData.set("creativeFit", creativeFit);
    formData.set("x", String(sel.x));
    formData.set("y", String(sel.y));
    formData.set("w", String(sel.w));
    formData.set("h", String(sel.h));
    formData.set("termsAccepted", "true");
    formData.set("creative", creativeFile);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { checkoutUrl?: string; error?: string };

      if (!response.ok || !result.checkoutUrl) {
        if (response.status === 409) {
          await loadSnapshot().catch(() => undefined);
        }
        setHint(result.error ?? "Checkout could not be started.");
        return;
      }

      window.location.assign(result.checkoutUrl);
    } catch {
      setHint("Checkout could not be reached. Check your connection and try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const cursor =
    viewMode === "shirt"
      ? "cursor-default"
      : panning
        ? "cursor-grabbing"
        : spaceDown
          ? "cursor-grab"
          : "cursor-crosshair";
  const previewPx = Math.max(0, Math.round(Number(pixels) || 0));
  const previewRect = planRect(Math.max(1, previewPx / (CELL_PX * CELL_PX)));
  const previewW = previewRect.w * CELL_PX;
  const previewH = previewRect.h * CELL_PX;
  const identityReady = Boolean(creativeFile && brand.trim() && url.trim());
  const checkoutDisabled = !termsAccepted || checkoutLoading || snapshot.auctionClosed;

  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      <ViewTabs viewMode={viewMode} onChange={setViewMode} />

      {viewMode === "bidding" ? (
        <div
          ref={viewportRef}
          className={`no-scrollbar absolute inset-0 touch-none overflow-auto pt-14 ${
            buyOpen ? "pr-80 lg:pr-96" : ""
          } ${cursor}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        >
          <div
            ref={ref}
            className="relative m-auto touch-none select-none bg-[#0b0b0b]"
            style={{
              width: base ? `${base.w * zoom}px` : "100%",
              height: base ? `${base.h * zoom}px` : "auto",
              aspectRatio: base ? undefined : `${COLS} / ${ROWS}`,
              flex: "0 0 auto",
            }}
          >
            <ArtboardGrid
              placements={snapshot.placements}
              sel={sel}
              creative={creative}
              creativeFit={creativeFit}
              interactive
              onStartSelectionTransform={startSelectionTransform}
            />
          </div>
        </div>
      ) : (
        <div
          className={`absolute inset-0 overflow-hidden pt-14 ${buyOpen ? "pr-80 lg:pr-96" : ""}`}
        >
          <TShirtPreview
            placements={snapshot.placements}
            sel={sel}
            creative={creative}
            creativeFit={creativeFit}
          />
        </div>
      )}

      {viewMode === "bidding" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex items-center justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded border border-border/50 bg-black/85 p-2 backdrop-blur">
            {([1, 2, 5] as const).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`h-11 border px-3.5 font-condensed text-sm uppercase leading-none ${
                  Math.abs(zoom - z) < 0.05
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                aria-label={`Zoom ${z}x`}
              >
                {z}×
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className={`absolute right-0 top-0 bottom-0 z-40 w-80 overflow-y-auto border-l border-border bg-card/95 backdrop-blur transition-[translate] duration-500 ease-out lg:w-96 ${
          buyOpen ? "pointer-events-auto translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border/40 bg-card/95 p-4 backdrop-blur">
          <div>
            <p className="font-display text-lg tracking-wide">BUY SPACE ON THE SHIRT</p>
            <p className="mt-0.5 font-condensed text-xs uppercase tracking-widest text-muted-foreground">
              {formatPixelPrice(snapshot.stats.currentPriceCents)} / pixel ·{" "}
              {formatPixelPrice(MIN_PRINTED_PIXELS * snapshot.stats.currentPriceCents)} minimum
              {snapshot.stats.nextPriceCents
                ? ` · next ${formatPixelPrice(snapshot.stats.nextPriceCents)}`
                : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close buy panel"
            className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center border border-border hover:bg-secondary"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3 font-condensed text-xs uppercase tracking-widest">
            <span className="text-foreground">Step {buyStep} of 2</span>
            <span className="text-muted-foreground">{buyStep === 1 ? "Your brand" : "Your position"}</span>
          </div>

          {buyStep === 1 ? (
            <div>
              <label className="relative mt-4 flex h-44 cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border bg-black/20 text-center transition-colors hover:border-foreground hover:bg-black/35">
                {creative ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creative}
                    alt="Uploaded logo preview"
                    className={`h-full w-full ${creativeFit === "cover" ? "object-cover" : "object-contain"}`}
                  />
                ) : (
                  <Upload aria-hidden="true" size={34} strokeWidth={1.5} className="text-muted-foreground" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/85 py-2.5 font-condensed text-xs uppercase tracking-widest text-white">
                  {creative ? "Change logo" : "Upload logo"}
                </span>
                <input
                  type="file"
                    accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                      if (file.size > 4 * 1024 * 1024) {
                        setHint("Image must be 4 MB or smaller.");
                        e.currentTarget.value = "";
                        return;
                      }
                    const objectUrl = URL.createObjectURL(file);
                    const image = new window.Image();
                    image.onload = () => {
                      if (image.naturalHeight > 0) {
                        setCreativeAspect(image.naturalWidth / image.naturalHeight);
                      }
                    };
                    image.src = objectUrl;
                    setCreativeFit(file.type === "image/jpeg" ? "cover" : "contain");
                      setCreativeFile(file);
                    setCreative(objectUrl);
                      setTermsAccepted(false);
                      setHint(null);
                  }}
                />
              </label>

              <label className="mt-4 block">
                <span className="font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                  Brand name
                </span>
                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Your brand"
                  className="mt-1.5 h-12 w-full border border-border bg-transparent px-3 font-condensed text-base outline-none placeholder:text-muted-foreground focus:border-foreground"
                />
              </label>

              <label className="mt-3 block">
                <span className="font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                  Website
                </span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourbrand.com"
                  className="mt-1.5 h-12 w-full border border-border bg-transparent px-3 font-condensed text-base outline-none placeholder:text-muted-foreground focus:border-foreground"
                />
              </label>

              <button
                type="button"
                disabled={!identityReady}
                onClick={() => setBuyStep(2)}
                className="mt-4 h-12 w-full bg-foreground px-5 font-display text-base tracking-wide text-background transition-colors hover:bg-accent-yellow hover:text-accent-yellow-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                NEXT · CHOOSE POSITION
              </button>
              {!identityReady && (
                <p className="mt-2 text-center font-condensed text-xs text-muted-foreground">
                  Add your logo, brand name and website to continue.
                </p>
              )}
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setBuyStep(1)}
                className="mt-4 flex items-center gap-2 font-condensed text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft aria-hidden="true" size={14} />
                Edit brand
              </button>

              {!sel ? (
                <div className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                        Budget ($)
                      </span>
                      <input
                        inputMode="numeric"
                        value={amount}
                        onChange={(e) => syncFromAmount(e.target.value)}
                        className="mt-1.5 h-12 w-full border border-border bg-transparent px-3 font-display text-lg outline-none focus:border-foreground"
                      />
                    </label>
                    <label className="block">
                      <span className="font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                        Pixels
                      </span>
                      <input
                        inputMode="numeric"
                        value={pixels}
                        onChange={(e) => syncFromPixels(e.target.value)}
                        className="mt-1.5 h-12 w-full border border-border bg-transparent px-3 font-display text-lg outline-none focus:border-foreground"
                      />
                    </label>
                  </div>

                  <div className="mt-3 border border-border bg-black/20 p-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                          Estimated block
                        </p>
                        <p className="mt-1 font-display text-2xl leading-none">
                          {previewW}×{previewH} px
                        </p>
                      </div>
                      <p className="font-display text-xl leading-none">
                        {usd(amountCentsForPixels(previewPx, snapshot.stats.pixelsSold))}
                      </p>
                    </div>
                  </div>

                  {autoNote && <p className="mt-3 font-condensed text-xs text-foreground">{autoNote}</p>}
                  {hint && <p className="mt-3 font-condensed text-xs text-muted-foreground">{hint}</p>}

                  <button
                    type="button"
                    onClick={applyAmount}
                    className="mt-4 h-12 w-full bg-foreground px-5 font-display text-base tracking-wide text-background transition-colors hover:bg-accent-yellow hover:text-accent-yellow-foreground"
                  >
                    FIND MY SPACE
                  </button>
                  <button
                    type="button"
                    onClick={() => setHint("Drag over any free area on the artboard.")}
                    className="mt-2 h-11 w-full border border-border px-5 font-condensed text-xs uppercase tracking-widest hover:bg-secondary"
                  >
                    Draw on artboard
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <div className="grid grid-cols-2 border border-border bg-black/20">
                    <div className="border-r border-border p-3">
                      <p className="font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                        Selected
                      </p>
                      <p className="mt-1 font-display text-xl leading-none">
                        {sel.w * CELL_PX}×{sel.h * CELL_PX} px
                      </p>
                      <p className="mt-1 font-condensed text-xs text-muted-foreground">
                        {selPixels.toLocaleString()} pixels
                      </p>
                    </div>
                    <div className="p-3">
                      <p className="font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                        Your bid
                      </p>
                      <p className="mt-1 font-display text-2xl leading-none">{usd(priceCents)}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                      Size
                    </p>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      {[
                        { label: "Fit logo", Icon: Focus, action: fitSelectionToLogo },
                        { label: "Expand", Icon: Maximize2, action: expandToAvailable },
                      ].map(({ label, Icon, action }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={action}
                            title={label === "Expand" ? "Expand to fill all available space" : undefined}
                            className="flex h-11 items-center justify-center gap-2 border border-border font-condensed text-xs uppercase tracking-widest hover:bg-secondary"
                          >
                            <Icon aria-hidden="true" size={15} />
                            {label}
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                      Position
                    </p>
                    <div className="mt-1.5 grid grid-cols-4 gap-2">
                      {(
                        [
                          ["Left", -1, 0, ArrowLeft],
                          ["Right", 1, 0, ArrowRight],
                          ["Up", 0, -1, ArrowUp],
                          ["Down", 0, 1, ArrowDown],
                        ] as const
                      ).map(([label, dx, dy, Icon]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => nudge(dx, dy)}
                          className="h-11 border border-border font-display text-base leading-none hover:bg-secondary"
                          aria-label={`Move selection ${label}`}
                        >
                          <Icon aria-hidden="true" className="mx-auto" size={16} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="mt-4 flex cursor-pointer items-start gap-2 border-t border-border pt-4 font-condensed text-xs leading-snug text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(event) => setTermsAccepted(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-yellow)]"
                    />
                    <span>
                      I understand this purchase is final and non-refundable once payment is
                      confirmed.
                    </span>
                  </label>

                  {hint && <p className="mt-3 font-condensed text-xs text-foreground">{hint}</p>}

                  <button
                    type="button"
                    onClick={() => void placeBid()}
                    disabled={checkoutDisabled}
                    className="mt-4 h-14 w-full bg-foreground px-5 font-display text-lg tracking-wide text-background transition-colors hover:bg-accent-yellow hover:text-accent-yellow-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {snapshot.auctionClosed
                      ? "AUCTION CLOSED"
                      : checkoutLoading
                        ? "RESERVING…"
                        : `RESERVE & PAY · ${usd(priceCents)}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSel(null)}
                    className="mt-2 h-10 w-full font-condensed text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  >
                    Choose another position
                  </button>
                </div>
              )}
              </div>
          )}
        </div>
      </div>
    </div>
  );
}
