import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import {
  isRectInViewport,
  milestoneForRaised,
  rectsOverlap,
  viewportForLevel,
  type Rect,
} from "../src/lib/auction";
import { packBoard, type LayoutItem } from "../src/lib/layout";

type PlacementRow = {
  id: string;
  brand_name: string;
  x: number;
  y: number;
  width_cells: number;
  height_cells: number;
  amount_cents: number;
  sort_at: string;
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

/** Same packer the app runs at settle time, so the CLI can never drift from it. */
function packByBid(rows: PlacementRow[], viewport: Rect): PackedPlacement[] {
  const items: LayoutItem[] = rows.map((row) => ({
    id: row.id,
    w: Number(row.width_cells),
    h: Number(row.height_cells),
    bidCents: Number(row.amount_cents),
    tieBreak: new Date(row.sort_at).toISOString(),
  }));

  const packed = packBoard(items, viewport);
  if (!packed) throw new Error("No legal layout exists for the current board");

  const byId = new Map(rows.map((row) => [row.id, row]));
  return packed.map((item) => ({ ...byId.get(item.id)!, x: item.x, y: item.y, w: item.w, h: item.h }));
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
      COALESCE(paid_at, created_at) AS sort_at,
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
      created_at AS sort_at,
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
    sort_at: row.sort_at,
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
