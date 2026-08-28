/**
 * Confirms the SQL side of the milestone system: reserve_placement must reject
 * a rectangle in the still-locked ring, accept one inside the viewport, and
 * price it identically to the TypeScript pricing ladder.
 *
 * Run with: npx tsx scripts/verify-milestone-guard.ts
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { amountCentsForPixels, milestoneForRaised, viewportForLevel } from "../src/lib/auction";

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

async function main() {
  loadEnv();
  const sql = neon(process.env.DATABASE_URL!);

  const [totals] = (await sql`
    SELECT
      COALESCE(SUM(amount_cents), 0)::bigint AS raised_cents,
      COALESCE(SUM(pixel_count), 0)::int AS pixels_sold
    FROM placements
    WHERE status = 'paid'
  `) as { raised_cents: string; pixels_sold: number }[];

  const raisedCents = Number(totals.raised_cents);
  const pixelsSold = Number(totals.pixels_sold);
  const level = milestoneForRaised(raisedCents).level;
  const viewport = viewportForLevel(level);
  console.log(
    `Raised $${(raisedCents / 100).toLocaleString()} · L${level} · viewport ${viewport.w}x${viewport.h} @ (${viewport.x},${viewport.y})`,
  );

  const reserve = (x: number, y: number, w: number, h: number) => sql`
    SELECT id, amount_cents FROM reserve_placement(
      'Guard Test', 'https://example.com', 'contain',
      ${x}, ${y}, ${w}, ${h}, ${`guard-${Date.now()}-${x}-${y}`},
      ${new Date(Date.now() + 60_000).toISOString()}::timestamptz
    )
  `;

  // Inside the world grid but in the ring that this milestone has not unlocked.
  try {
    await reserve(viewport.x - 2, viewport.y - 2, 2, 2);
    console.error("FAIL: locked ring accepted a reservation");
    process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      message.includes("outside_viewport")
        ? "PASS: locked ring rejected with outside_viewport"
        : `FAIL: unexpected error ${message}`,
    );
    if (!message.includes("outside_viewport")) process.exitCode = 1;
  }

  // A free cell inside the unlocked viewport, priced against the TS ladder.
  const rows = (await reserve(viewport.x, viewport.y, 2, 2)) as { id: string; amount_cents: number }[];
  const expected = amountCentsForPixels(400, pixelsSold);
  const actual = Number(rows[0].amount_cents);
  console.log(
    actual === expected
      ? `PASS: in-viewport reservation priced at $${actual / 100}, matching TypeScript`
      : `FAIL: SQL charged ${actual} but TypeScript expects ${expected}`,
  );
  if (actual !== expected) process.exitCode = 1;

  await sql`DELETE FROM placements WHERE id = ${rows[0].id}`;
  console.log("Cleaned up test reservation");
}

void main();
