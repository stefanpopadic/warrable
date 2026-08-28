import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import {
  isRectInViewport,
  milestoneForRaised,
  rectsOverlap,
  viewportForLevel,
  type Rect,
} from "../src/lib/auction";

type PlacementRow = {
  id: string;
  brand_name: string;
  x: number;
  y: number;
  width_cells: number;
  height_cells: number;
  amount_cents: number;
  status: "paid" | "reserved";
};

type PackedPlacement = PlacementRow & Rect;

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function asRect(row: PlacementRow): Rect {
  return {
    x: Number(row.x),
    y: Number(row.y),
    w: Number(row.width_cells),
    h: Number(row.height_cells),
  };
}

function edgeContact(rect: Rect, placed: Rect[]) {
  let contact = 0;
  for (const other of placed) {
    const overlapX = Math.max(
      0,
      Math.min(rect.x + rect.w, other.x + other.w) - Math.max(rect.x, other.x),
    );
    const overlapY = Math.max(
      0,
      Math.min(rect.y + rect.h, other.y + other.h) - Math.max(rect.y, other.y),
    );

    if (rect.y + rect.h === other.y || other.y + other.h === rect.y) {
      contact += overlapX;
    }
    if (rect.x + rect.w === other.x || other.x + other.w === rect.x) {
      contact += overlapY;
    }
  }
  return contact;
}

function stableVariation(id: string, max: number) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return max > 0 ? hash % max : 0;
}

function packByBid(rows: PlacementRow[], viewport: Rect): PackedPlacement[] {
  const placed: PackedPlacement[] = [];
  const centerX = viewport.x + viewport.w / 2;
  const centerY = viewport.y + viewport.h / 2;

  for (const row of rows) {
    const w = Number(row.width_cells);
    const h = Number(row.height_cells);
    if (w > viewport.w || h > viewport.h) {
      throw new Error(`${row.brand_name} is larger than the active viewport`);
    }

    const candidates: Array<Rect & { score: number }> = [];
    for (let y = viewport.y; y <= viewport.y + viewport.h - h; y++) {
      for (let x = viewport.x; x <= viewport.x + viewport.w - w; x++) {
        const rect = { x, y, w, h };
        if (placed.some((other) => rectsOverlap(rect, other))) continue;

        const contact = edgeContact(rect, placed);
        if (placed.length > 0 && contact === 0) continue;

        const distance = Math.hypot(
          x + w / 2 - centerX,
          (y + h / 2 - centerY) * 0.72,
        );
        candidates.push({
          ...rect,
          score: contact * 1.8 - distance * 1.35,
        });
      }
    }

    if (candidates.length === 0) {
      throw new Error(`No legal in-bounds position remains for ${row.brand_name}`);
    }

    candidates.sort((a, b) => b.score - a.score);
    const topChoices = Math.min(14, candidates.length);
    const choice =
      placed.length === 0 ? candidates[0] : candidates[stableVariation(row.id, topChoices)];

    placed.push({ ...row, ...choice });
  }

  return placed;
}

function findLayoutProblems(rows: PlacementRow[], viewport: Rect) {
  const outside = rows.filter((row) => !isRectInViewport(asRect(row), viewport));
  const overlaps: Array<[PlacementRow, PlacementRow]> = [];

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rectsOverlap(asRect(rows[i]), asRect(rows[j]))) {
        overlaps.push([rows[i], rows[j]]);
      }
    }
  }

  return { outside, overlaps };
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");

  const sql = neon(process.env.DATABASE_URL);
  const paid = (await sql`
    SELECT
      id,
      brand_name,
      x,
      y,
      width_cells,
      height_cells,
      amount_cents,
      status
    FROM placements
    WHERE status = 'paid'
    ORDER BY amount_cents DESC, paid_at ASC, created_at ASC
  `) as PlacementRow[];
  const reserved = (await sql`
    SELECT
      id,
      brand_name,
      x,
      y,
      width_cells,
      height_cells,
      amount_cents,
      status
    FROM placements
    WHERE status = 'reserved'
      AND reservation_expires_at > now()
    ORDER BY created_at ASC
  `) as PlacementRow[];

  const raisedCents = paid.reduce((total, row) => total + Number(row.amount_cents), 0);
  const milestone = milestoneForRaised(raisedCents);
  const viewport = viewportForLevel(milestone.level);
  const activeRows = [...paid, ...reserved];
  const currentProblems = findLayoutProblems(activeRows, viewport);
  const forceRepack = process.argv.includes("--repack");
  const fixInvalid = process.argv.includes("--fix");

  if (currentProblems.outside.length === 0 && currentProblems.overlaps.length === 0) {
    console.log(
      `Placement bounds OK: ${activeRows.length} active assets inside ` +
        `L${milestone.level} ${viewport.w}x${viewport.h} viewport`,
    );
    if (!forceRepack) return;
  } else if (!fixInvalid && !forceRepack) {
    for (const row of currentProblems.outside) {
      console.error(`${row.brand_name} is outside the active viewport`);
    }
    for (const [a, b] of currentProblems.overlaps) {
      console.error(`${a.brand_name} overlaps ${b.brand_name}`);
    }
    process.exitCode = 1;
    return;
  }

  if (reserved.length > 0) {
    throw new Error("Cannot repack while checkout reservations are active");
  }

  const packed = packByBid(paid, viewport);
  const packedRows = packed.map<PlacementRow>((row) => ({
    id: row.id,
    brand_name: row.brand_name,
    x: row.x,
    y: row.y,
    width_cells: row.w,
    height_cells: row.h,
    amount_cents: row.amount_cents,
    status: row.status,
  }));
  const packedProblems = findLayoutProblems(packedRows, viewport);
  if (packedProblems.outside.length > 0 || packedProblems.overlaps.length > 0) {
    throw new Error("Generated layout failed bounds validation");
  }

  const ids = paid.map((row) => row.id);
  await sql.transaction((tx) => [
    tx`
      UPDATE placements
      SET status = 'payment_review'
      WHERE id::text = ANY(${ids})
        AND status = 'paid'
    `,
    ...packed.map((row) => tx`
      UPDATE placements
      SET x = ${row.x}, y = ${row.y}
      WHERE id = ${row.id}::uuid
        AND status = 'payment_review'
    `),
    tx`
      UPDATE placements
      SET status = 'paid'
      WHERE id::text = ANY(${ids})
        AND status = 'payment_review'
    `,
  ]);

  console.log(
    `Repacked ${packed.length} assets inside L${milestone.level} ` +
      `${viewport.w}x${viewport.h}; largest bids remain closest to center`,
  );
}

void main();
