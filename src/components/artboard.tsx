"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { X } from "lucide-react";
import {
  COLS,
  ROWS,
  CELL_PX,
  CELL_PRICE,
  PRICE_PER_PIXEL,
  board,
  usd,
  brandToUrl,
  type Block,
} from "@/lib/artboard";

type Sel = { x: number; y: number; w: number; h: number } | null;

type Props = {
  className?: string;
  buyOpen?: boolean;
  onClose?: () => void;
};

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

export default function Artboard({ className = "", buyOpen = false, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [creative, setCreative] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Block[]>([]);
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [amount, setAmount] = useState("2200");
  const [pixels, setPixels] = useState("1000");
  const [autoNote, setAutoNote] = useState<string | null>(null);

  useEffect(() => {
    if (buyOpen) {
      setPanelOpen(true);
      setAutoNote(null);
    } else {
      setPanelOpen(false);
    }
  }, [buyOpen]);

  const occupied = useCallback(
    (x: number, y: number, w: number, h: number) => {
      if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return true;
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++) {
          if (board.grid[j * COLS + i]) return true;
          if (placed.some((p) => i >= p.x && i < p.x + p.w && j >= p.y && j < p.y + p.h))
            return true;
        }
      return false;
    },
    [placed],
  );

  const cellFrom = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    const x = clamp(Math.floor(((e.clientX - r.left) / r.width) * COLS), 0, COLS - 1);
    const y = clamp(Math.floor(((e.clientY - r.top) / r.height) * ROWS), 0, ROWS - 1);
    return { x, y };
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
    setPanelOpen(false);
    setDrag(c);
    setSel({ ...c, w: 1, h: 1 });
  };

  const onPointerMove = (e: PointerEvent) => {
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
    if (e) pointers.current.delete(e.pointerId);
    else pointers.current.clear();
    if (pointers.current.size < 2) pinch.current = null;
    setDrag(null);
    setPanning(false);
    panStart.current = null;
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        setSel(null);
        setPanelOpen(false);
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

  const resize = (dw: number, dh: number) => {
    if (!sel) return;
    const w = clamp(sel.w + dw, 1, COLS - sel.x);
    const h = clamp(sel.h + dh, 1, ROWS - sel.y);
    if (occupied(sel.x, sel.y, w, h)) {
      setHint("Can't expand — neighbouring space is sold.");
      return;
    }
    setHint(null);
    setSel({ ...sel, w, h });
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
  const price = cells * CELL_PRICE;

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
    setPanelOpen(false);
  };

  const syncFromAmount = (v: string) => {
    setAmount(v);
    const dollars = Number(v.replace(/[^0-9.]/g, "")) || 0;
    setPixels(String(Math.max(0, Math.round(dollars / PRICE_PER_PIXEL))));
  };

  const syncFromPixels = (v: string) => {
    setPixels(v);
    const px = Number(v.replace(/[^0-9.]/g, "")) || 0;
    setAmount(String(Math.round(px * PRICE_PER_PIXEL)));
  };

  const placeBid = () => {
    if (!sel) return;
    const brandName = brand || "YOUR BRAND";
    const bidUrl = url.trim() || brandToUrl(brandName);
    setPlaced((p) => [
      ...p,
      {
        id: `you${p.length}`,
        ...sel,
        brand: brandName,
        url: bidUrl,
        bg: creative ? "transparent" : "#ffffff",
        fg: "#000000",
        bid: price,
      },
    ]);
    setSel(null);
    setUrl("");
    setHint(`Bid placed: ${usd(price)} for ${selPixels.toLocaleString()} px.`);
    onClose?.();
  };

  const pct = (n: number, total: number) => `${(n / total) * 100}%`;
  const cursor = panning ? "cursor-grabbing" : spaceDown ? "cursor-grab" : "cursor-crosshair";
  const previewPx = Math.max(0, Math.round(Number(pixels) || 0));
  const previewRect = planRect(Math.max(1, previewPx / (CELL_PX * CELL_PX)));
  const previewW = previewRect.w * CELL_PX;
  const previewH = previewRect.h * CELL_PX;

  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      <div
        ref={viewportRef}
        className={`no-scrollbar absolute inset-0 flex touch-none items-center justify-center overflow-auto ${cursor}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div
          ref={ref}
          className="relative touch-none select-none bg-[#0b0b0b]"
          style={{
            aspectRatio: `${COLS} / ${ROWS}`,
            height: `${100 * zoom}%`,
            width: "auto",
            maxWidth: `${100 * zoom}%`,
            flex: "0 0 auto",
          }}
        >
          {board.blocks.map((b) => (
            <a
              key={b.id}
              href={b.url}
              target="_blank"
              rel="noreferrer"
              title={`${b.brand} — ${usd(b.bid)} — ${b.url}`}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute overflow-hidden hover:z-20 hover:ring-2 hover:ring-white"
              style={{
                left: pct(b.x, COLS),
                top: pct(b.y, ROWS),
                width: pct(b.w, COLS),
                height: pct(b.h, ROWS),
                background: b.bg,
                color: b.fg,
              }}
            >
              {b.w >= 4 && b.h >= 2 && (
                <span
                  className="absolute inset-0 flex flex-col items-center justify-center truncate px-[2px] font-display leading-none"
                  style={{ fontSize: `clamp(5px, ${b.h * 0.55 * zoom}vh, ${22 * zoom}px)` }}
                >
                  <span className="truncate">{b.brand}</span>
                  {b.w >= 8 && b.h >= 4 && (
                    <span className="mt-0.5 truncate font-mono text-[0.55em] opacity-80">
                      {b.url.replace(/^https:\/\//, "")}
                    </span>
                  )}
                </span>
              )}
            </a>
          ))}

          {placed.map((b) => (
            <a
              key={b.id}
              href={b.url}
              target="_blank"
              rel="noreferrer"
              title={`${b.brand} — ${usd(b.bid)} — ${b.url}`}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute overflow-hidden ring-1 ring-white hover:z-20 hover:ring-2"
              style={{
                left: pct(b.x, COLS),
                top: pct(b.y, ROWS),
                width: pct(b.w, COLS),
                height: pct(b.h, ROWS),
                background: creative ? "#fff" : b.bg,
              }}
            >
              {creative ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creative} alt={b.brand} className="h-full w-full object-cover" />
              ) : (
                <span
                  className="absolute inset-0 flex flex-col items-center justify-center px-[2px] text-center font-display leading-none text-black"
                  style={{ fontSize: `clamp(5px, ${b.h * 0.55 * zoom}vh, ${20 * zoom}px)` }}
                >
                  <span>{b.brand}</span>
                  {b.w >= 6 && b.h >= 3 && (
                    <span className="mt-0.5 font-mono text-[0.8em] opacity-80">
                      {b.url.replace(/^https:\/\//, "")}
                    </span>
                  )}
                </span>
              )}
            </a>
          ))}

          {sel && (
            <div
              className="pointer-events-none absolute z-10 border-2 border-white bg-white/15"
              style={{
                left: pct(sel.x, COLS),
                top: pct(sel.y, ROWS),
                width: pct(sel.w, COLS),
                height: pct(sel.h, ROWS),
              }}
            >
              {creative && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creative} alt="Your creative preview" className="h-full w-full object-cover" />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded border border-border/50 bg-black/85 p-2 backdrop-blur">
        {([1, 2, 5] as const).map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`h-11 border px-3.5 font-mono text-sm uppercase leading-none ${
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

      {buyOpen && (
        <div className="pointer-events-auto absolute right-0 top-0 bottom-0 z-40 w-80 overflow-y-auto border-l border-border bg-card/95 backdrop-blur lg:w-96">
          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border/40 bg-card/95 p-4 backdrop-blur">
            <div>
              <p className="font-display text-lg tracking-wide">BUY SPACE ON THE SHIRT</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                $2.20 / pixel · $220 minimum
              </p>
            </div>
            <button
              onClick={() => {
                setPanelOpen(false);
                onClose?.();
              }}
              aria-label="Close buy panel"
              className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center border border-border hover:bg-secondary"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-4">
            {panelOpen ? (
              <div className="flex flex-col gap-3">
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Your budget ($)
                  </span>
                  <input
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => syncFromAmount(e.target.value)}
                    className="mt-1 h-11 w-full border border-border bg-transparent px-3 font-display text-lg outline-none focus:border-foreground"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Pixels
                  </span>
                  <input
                    inputMode="numeric"
                    value={pixels}
                    onChange={(e) => syncFromPixels(e.target.value)}
                    className="mt-1 h-11 w-full border border-border bg-transparent px-3 font-display text-lg outline-none focus:border-foreground"
                  />
                </label>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {usd(previewPx * PRICE_PER_PIXEL)} = {previewPx.toLocaleString()} pixels ={" "}
                  {previewPx >= 100 ? `a ${previewW}×${previewH} px block` : "at least 100 pixels ($220)"}
                </p>
                {autoNote && <p className="font-mono text-[11px] text-foreground">{autoNote}</p>}
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    onClick={applyAmount}
                    className="h-11 bg-foreground px-5 font-display text-base tracking-wide text-background hover:opacity-90"
                  >
                    FIND MY SPACE
                  </button>
                  <button
                    onClick={() => {
                      setPanelOpen(false);
                      setHint("Drag anywhere on the black space to select your area.");
                    }}
                    className="h-11 border border-border px-5 font-mono text-[11px] uppercase tracking-widest hover:bg-secondary"
                  >
                    Drag it myself
                  </button>
                </div>
              </div>
            ) : !sel ? (
              <div className="flex flex-col gap-4">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {hint ?? "Drag anywhere on the black space to select your area."}
                </p>
                <button
                  onClick={() => setPanelOpen(true)}
                  className="h-11 border border-border px-5 font-mono text-[11px] uppercase tracking-widest hover:bg-secondary"
                >
                  Enter amount
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Selected
                    </p>
                    <p className="font-display text-xl leading-none">
                      {sel.w * CELL_PX}×{sel.h * CELL_PX} px
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {selPixels.toLocaleString()} pixels
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Your bid
                    </p>
                    <p className="font-display text-xl leading-none">{usd(price)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {([[-2, -2, "−"], [2, 2, "+"]] as const).map(([dw, dh, label]) => (
                    <button
                      key={label}
                      onClick={() => resize(dw, dh)}
                      className="h-9 w-9 border border-border font-display text-lg leading-none hover:bg-secondary"
                      aria-label={label === "+" ? "Expand selection" : "Shrink selection"}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      ["←", -1, 0],
                      ["→", 1, 0],
                      ["↑", 0, -1],
                      ["↓", 0, 1],
                    ] as const
                  ).map(([l, dx, dy]) => (
                    <button
                      key={l}
                      onClick={() => nudge(dx, dy)}
                      className="h-9 w-9 border border-border font-mono text-sm leading-none hover:bg-secondary"
                      aria-label={`Move selection ${l}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                <label className="cursor-pointer border border-border px-3 py-2.5 text-center font-mono text-[11px] uppercase tracking-widest hover:bg-secondary">
                  {creative ? "Change logo" : "Upload logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setCreative(URL.createObjectURL(f));
                    }}
                  />
                </label>

                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Brand name"
                  className="h-10 w-full border border-border bg-transparent px-3 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-foreground"
                />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourbrand.com"
                  className="h-10 w-full border border-border bg-transparent px-3 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-foreground"
                />
                <button
                  onClick={placeBid}
                  className="mt-1 w-full bg-foreground py-3 font-display text-base tracking-wide text-background hover:opacity-90"
                >
                  PLACE BID · {usd(price)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
