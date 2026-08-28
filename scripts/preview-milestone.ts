/**
 * Temporarily inflates demo revenue so the next milestone unlocks, letting you
 * eyeball the zoom-out. Pass `revert` to undo.
 *
 *   npx tsx scripts/preview-milestone.ts bump
 *   npx tsx scripts/preview-milestone.ts revert
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { milestoneForRaised, nextMilestone, viewportForLevel } from "../src/lib/auction";

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

const BUMP_BRAND = "Amazon";

async function main() {
  loadEnv();
  const sql = neon(process.env.DATABASE_URL!);
  const mode = process.argv[2] ?? "bump";

  const raised = async () => {
    const [row] = (await sql`
      SELECT COALESCE(SUM(amount_cents), 0)::bigint AS c FROM placements WHERE status = 'paid'
    `) as { c: string }[];
    return Number(row.c);
  };

  if (mode === "revert") {
    await sql`
      UPDATE placements
      SET amount_cents = width_cells * height_cells * 100 * 25
      WHERE is_demo = true
    `;
  } else {
    const before = await raised();
    const next = nextMilestone(before);
    if (!next) {
      console.log("Already at the final milestone.");
      return;
    }
    const bump = next.unlockCents - before + 100_00;
    await sql`
      UPDATE placements
      SET amount_cents = amount_cents + ${bump}
      WHERE is_demo = true AND brand_name = ${BUMP_BRAND}
    `;
  }

  const after = await raised();
  const level = milestoneForRaised(after).level;
  const viewport = viewportForLevel(level);
  console.log(
    `Raised $${(after / 100).toLocaleString()} · L${level} · viewport ${viewport.w}x${viewport.h} @ (${viewport.x},${viewport.y})`,
  );
}

void main();
