import { describe, expect, it } from "vitest";
import { isRectInViewport, rectsOverlap, viewportForLevel, type Rect } from "./auction";
import { bestDimensions, packBoard, sortLayoutItems, type LayoutItem } from "./layout";

const viewport = viewportForLevel(0);

function item(id: string, w: number, h: number, bidCents: number, tieBreak = id): LayoutItem {
  return { id, w, h, bidCents, tieBreak };
}

function distanceFromCenter(rect: Rect, view: Rect) {
  return Math.hypot(
    rect.x + rect.w / 2 - (view.x + view.w / 2),
    (rect.y + rect.h / 2 - (view.y + view.h / 2)) * 0.72,
  );
}

const board: LayoutItem[] = [
  item("amazon", 6, 4, 240_000),
  item("byaside", 4, 3, 120_000),
  item("milena", 3, 3, 60_000),
  item("nova", 3, 2, 30_000),
  item("tiny", 2, 1, 5_000),
  item("micro", 1, 1, 2_500),
];

describe("sortLayoutItems", () => {
  it("orders by bid, then earliest tie break, then id", () => {
    const sorted = sortLayoutItems([
      item("b", 1, 1, 100, "2024-02-01"),
      item("a", 1, 1, 500, "2024-03-01"),
      item("c", 1, 1, 100, "2024-01-01"),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["a", "c", "b"]);
  });

  it("does not mutate the input", () => {
    const input = [item("a", 1, 1, 100), item("b", 1, 1, 900)];
    sortLayoutItems(input);
    expect(input.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("bestDimensions", () => {
  it("keeps a wide logo wide", () => {
    const dims = bestDimensions(24, 3, viewport);
    expect(dims.w).toBeGreaterThan(dims.h);
  });

  it("keeps a tall logo tall", () => {
    const dims = bestDimensions(24, 0.4, viewport);
    expect(dims.h).toBeGreaterThan(dims.w);
  });

  it("never bills more cells than requested", () => {
    for (let cells = 1; cells <= 200; cells++) {
      for (const aspect of [0.3, 0.75, 1, 1.9, 4]) {
        const dims = bestDimensions(cells, aspect, viewport);
        expect(dims.w * dims.h).toBeLessThanOrEqual(cells);
        expect(dims.w).toBeGreaterThanOrEqual(1);
        expect(dims.h).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("stays inside the viewport", () => {
    const dims = bestDimensions(viewport.w * viewport.h * 4, 1, viewport);
    expect(dims.w).toBeLessThanOrEqual(viewport.w);
    expect(dims.h).toBeLessThanOrEqual(viewport.h);
  });
});

describe("packBoard", () => {
  it("is deterministic across runs", () => {
    const first = packBoard(board, viewport);
    const second = packBoard([...board].reverse(), viewport);
    expect(first).not.toBeNull();
    expect(second).toEqual(first);
  });

  it("places every item without overlap and inside the viewport", () => {
    const packed = packBoard(board, viewport);
    expect(packed).not.toBeNull();
    expect(packed!).toHaveLength(board.length);

    for (const rect of packed!) {
      expect(isRectInViewport(rect, viewport)).toBe(true);
    }
    for (let i = 0; i < packed!.length; i++) {
      for (let j = i + 1; j < packed!.length; j++) {
        expect(rectsOverlap(packed![i], packed![j])).toBe(false);
      }
    }
  });

  it("gives the center to the biggest bid", () => {
    const packed = packBoard(board, viewport)!;
    const leader = packed.find((p) => p.id === "amazon")!;
    const others = packed.filter((p) => p.id !== "amazon");

    for (const other of others) {
      expect(distanceFromCenter(leader, viewport)).toBeLessThan(
        distanceFromCenter(other, viewport),
      );
    }
  });

  it("moves a logo to the center once it outbids the leader", () => {
    const before = packBoard(board, viewport)!;
    const promoted = board.map((i) =>
      i.id === "milena" ? { ...i, w: 7, h: 5, bidCents: 500_000 } : i,
    );
    const after = packBoard(promoted, viewport)!;

    const was = before.find((p) => p.id === "milena")!;
    const now = after.find((p) => p.id === "milena")!;

    expect(distanceFromCenter(now, viewport)).toBeLessThan(distanceFromCenter(was, viewport));
    expect(
      after.every((p) => p.id === "milena" ||
        distanceFromCenter(now, viewport) < distanceFromCenter(p, viewport)),
    ).toBe(true);
  });

  it("keeps every logo touching the cluster", () => {
    const packed = packBoard(board, viewport)!;
    const [, ...rest] = packed;

    for (const rect of rest) {
      const touches = packed.some((other) => {
        if (other.id === rect.id) return false;
        const sharesRow = rect.y < other.y + other.h && other.y < rect.y + rect.h;
        const sharesColumn = rect.x < other.x + other.w && other.x < rect.x + rect.w;
        const stacked = rect.y + rect.h === other.y || other.y + other.h === rect.y;
        const sideBySide = rect.x + rect.w === other.x || other.x + other.w === rect.x;
        return (stacked && sharesColumn) || (sideBySide && sharesRow);
      });
      expect(touches).toBe(true);
    }
  });

  it("centers the whole cluster, not just the leader", () => {
    // Scoring contact as a raw cell count let wide items chase existing mass and
    // drag the cluster to one side, leaving the leader centered inside a blob
    // that was visibly off-center on the shirt.
    const mixed: LayoutItem[] = [
      item("wide", 19, 5, 475_000),
      item("banner", 16, 4, 400_000),
      item("box", 8, 6, 300_000),
      ...Array.from({ length: 12 }, (_, i) => item(`s${i}`, 4 + (i % 3), 3, 90_000 - i * 1_000)),
    ];
    const packed = packBoard(mixed, viewportForLevel(2))!;
    const view = viewportForLevel(2);

    const left = Math.min(...packed.map((r) => r.x)) - view.x;
    const right = view.x + view.w - Math.max(...packed.map((r) => r.x + r.w));
    const top = Math.min(...packed.map((r) => r.y)) - view.y;
    const bottom = view.y + view.h - Math.max(...packed.map((r) => r.y + r.h));

    expect(Math.abs(left - right)).toBeLessThanOrEqual(4);
    expect(Math.abs(top - bottom)).toBeLessThanOrEqual(4);
  });

  it("never lands on a reserved rect", () => {
    const blocked: Rect[] = [{ x: viewport.x + 8, y: viewport.y + 12, w: 5, h: 5 }];
    const packed = packBoard(board, viewport, { blocked })!;

    for (const rect of packed) {
      expect(rectsOverlap(rect, blocked[0])).toBe(false);
    }
  });

  it("returns null when an item cannot fit the viewport", () => {
    expect(packBoard([item("huge", viewport.w + 1, 2, 1_000)], viewport)).toBeNull();
  });

  it("returns null when the board runs out of capacity", () => {
    const oversized = Array.from({ length: 40 }, (_, i) =>
      item(`b${i}`, viewport.w, 1, 1_000 - i),
    );
    expect(packBoard(oversized, viewport)).toBeNull();
  });

  it("packs a full milestone board fast enough for live preview", () => {
    const big = viewportForLevel(5);
    const many = Array.from({ length: 40 }, (_, i) => item(`b${i}`, 5, 4, 100_000 - i * 100));

    const started = Date.now();
    expect(packBoard(many, big)).not.toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
