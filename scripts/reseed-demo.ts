/**
 * Rebuilds the demo placements in the new milestone world grid.
 *
 * Bids are replayed newest-money-last so each logo lands in the viewport that
 * was unlocked at the moment it was bought. That is what produces a cluster
 * which grew outward instead of one laid out against the final canvas size.
 *
 * Run with: npx tsx scripts/reseed-demo.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import {
  CELL_PX,
  findAutoStackPlacement,
  milestoneForRaised,
  pixelsForBudget,
  viewportForLevel,
  type Rect,
} from "../src/lib/auction";

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

/**
 * The Neon HTTP driver rejects multi-statement queries, so the migration is
 * split on semicolons that sit outside a $$ ... $$ function body.
 */
function splitSqlStatements(source: string) {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;

  for (let i = 0; i < source.length; i++) {
    if (source.startsWith("$$", i)) {
      inDollarQuote = !inDollarQuote;
      current += "$$";
      i++;
      continue;
    }
    if (source[i] === ";" && !inDollarQuote) {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += source[i];
  }

  if (current.trim()) statements.push(current.trim());
  return statements.filter((s) => !/^(--[^\n]*\n?)*$/.test(s));
}

type DemoBrand = {
  name: string;
  website: string;
  logo: string;
  dollars: number;
  aspect: number;
  variation: number;
};

// Ordered by bid descending so the biggest demo ads claim the center first.
// Variation values deliberately spread later ads around the growing cluster.
const DEMO_BRANDS: DemoBrand[] = [
  { name: "Launch Club", website: "https://launchclub.ai/", logo: "/placeholders/launch-club.webp", dollars: 1600, aspect: 1, variation: 0 },
  { name: "Voximo", website: "https://voximo.io/", logo: "/placeholders/voximo.webp", dollars: 1125, aspect: 1.88, variation: 7 },
  { name: "daily.fun", website: "https://x.com/dailyfun", logo: "/placeholders/daily-fun.webp", dollars: 1000, aspect: 2.6, variation: 19 },
  { name: "Outdo", website: "https://outdo.lol/", logo: "/placeholders/outdo.webp", dollars: 1000, aspect: 1.51, variation: 3 },
  { name: "Viktor", website: "https://ref.viktor.com/1milllionpixels", logo: "/placeholders/viktor.webp", dollars: 900, aspect: 2.2, variation: 31 },
  { name: "Zoom Into Art", website: "https://zoominto.art/collections/phone-cases", logo: "/placeholders/zoom-into-art.webp", dollars: 900, aspect: 1, variation: 11 },
  { name: "BuyerBuilds", website: "https://buyerbuilds.com/", logo: "/placeholders/buyerbuilds.webp", dollars: 900, aspect: 1, variation: 23 },
  { name: "MakePost AI", website: "https://makepostai.com/", logo: "/placeholders/makepost-ai.webp", dollars: 750, aspect: 3.42, variation: 5 },
  { name: "Replit", website: "https://replit.com/", logo: "/placeholders/replit.webp", dollars: 750, aspect: 3.25, variation: 37 },
  { name: "Metrician", website: "https://www.metrician.io/?utm_source=1millionpixels", logo: "/placeholders/metrician.webp", dollars: 750, aspect: 3.5, variation: 13 },
  { name: "Rolevate", website: "https://rolevate.com/en", logo: "/placeholders/rolevate.webp", dollars: 750, aspect: 3.44, variation: 29 },
  { name: "Solbid", website: "https://solbid.lol/", logo: "/placeholders/solbid.webp", dollars: 675, aspect: 3, variation: 17 },
  { name: "GoldRock AI", website: "https://utk.ai/", logo: "/placeholders/goldrock-ai.webp", dollars: 675, aspect: 3, variation: 41 },
  { name: "Auctra", website: "https://sellonauctra.com/", logo: "/placeholders/auctra.webp", dollars: 675, aspect: 3.06, variation: 2 },
  { name: "ATC.com", website: "https://www.atc.com/", logo: "/placeholders/atc.webp", dollars: 675, aspect: 3, variation: 34 },
  { name: "Agent Outbid", website: "https://agentoutbid.com/", logo: "/placeholders/agent-outbid.webp", dollars: 675, aspect: 3, variation: 8 },
  { name: "DingDong", website: "https://www.dingdong.so/?utm_source=1millionpixels", logo: "/placeholders/dingdong.webp", dollars: 675, aspect: 3, variation: 26 },
  { name: "GigaFaze", website: "https://gigafaze.com/", logo: "/placeholders/gigafaze.webp", dollars: 675, aspect: 3.02, variation: 14 },
  { name: "Freyja", website: "https://freyja.software/", logo: "/placeholders/freyja.webp", dollars: 625, aspect: 1, variation: 38 },
  { name: "Bazarak", website: "https://www.bazarak.me/", logo: "/placeholders/bazarak.webp", dollars: 625, aspect: 1, variation: 4 },
  { name: "Adonis", website: "https://www.meetadonis.ai/", logo: "/placeholders/adonis.webp", dollars: 625, aspect: 1, variation: 32 },
  { name: "Ranla", website: "https://ranla.ai/", logo: "/placeholders/ranla.webp", dollars: 600, aspect: 1.5, variation: 10 },
  { name: "Ignite Images", website: "https://ignite-images.co.uk/ai-photo-booth/", logo: "/placeholders/ignite-images.webp", dollars: 600, aspect: 2.58, variation: 22 },
  { name: "Still Lit", website: "https://stilllit.live/", logo: "/placeholders/still-lit.webp", dollars: 600, aspect: 0.67, variation: 6 },
  { name: "Digital Finest", website: "https://www.digitalfinest.com/", logo: "/placeholders/digital-finest.webp", dollars: 525, aspect: 2.14, variation: 35 },
  { name: "BlueAlpha", website: "https://bluealpha.ai/", logo: "/placeholders/bluealpha.webp", dollars: 500, aspect: 5, variation: 12 },
  { name: "The Lobby", website: "https://www.thelobbynews.com/", logo: "/placeholders/the-lobby.webp", dollars: 500, aspect: 5, variation: 28 },
  { name: "React Bits Pro", website: "https://pro.reactbits.dev/", logo: "/placeholders/react-bits-pro.webp", dollars: 400, aspect: 1, variation: 16 },
];

type PlacedBrand = DemoBrand & { rect: Rect; amountCents: number; targetCells: number };

function buildLayout() {
  const placed: PlacedBrand[] = [];
  const rects: Rect[] = [];
  let raisedCents = 0;
  let pixelsSold = 0;

  for (const brand of DEMO_BRANDS) {
    const budgetCents = brand.dollars * 100;
    const targetCells = Math.max(
      1,
      Math.round(pixelsForBudget(budgetCents, pixelsSold) / (CELL_PX * CELL_PX)),
    );
    const viewport = viewportForLevel(milestoneForRaised(raisedCents).level);

    const rect = findAutoStackPlacement({
      placements: rects,
      targetCells,
      creativeAspect: brand.aspect,
      variationIndex: brand.variation,
      viewport,
    });

    if (!rect) {
      throw new Error(`No room left for ${brand.name} at $${brand.dollars}`);
    }

    const amountCents = rect.w * rect.h * CELL_PX * CELL_PX * 25;
    placed.push({ ...brand, rect, amountCents, targetCells });
    rects.push(rect);
    raisedCents += amountCents;
    pixelsSold += rect.w * rect.h * CELL_PX * CELL_PX;
  }

  return { placed, raisedCents, pixelsSold };
}

async function main() {
  loadEnv();
  const sql = neon(process.env.DATABASE_URL!);

  const migration = readFileSync("drizzle/0006_milestone_world_grid.sql", "utf8");
  const statements = splitSqlStatements(migration);
  console.log(`Applying drizzle/0006_milestone_world_grid.sql (${statements.length} statements)`);
  for (const statement of statements) {
    await sql.query(statement);
  }

  const { placed, raisedCents, pixelsSold } = buildLayout();

  console.log("Clearing demo placements");
  await sql`DELETE FROM placements WHERE is_demo = true`;

  for (const brand of placed) {
    await sql`
      INSERT INTO placements (
        brand_name, website_url, creative_url, creative_fit, mime_type,
        x, y, width_cells, height_cells, amount_cents,
        status, requester_hash, reservation_expires_at, is_demo, paid_at
      ) VALUES (
        ${brand.name}, ${brand.website}, ${brand.logo}, 'cover', 'image/webp',
        ${brand.rect.x}, ${brand.rect.y}, ${brand.rect.w}, ${brand.rect.h}, ${brand.amountCents},
        'paid', 'demo-seed', now(), true, now()
      )
    `;
  }

  const finalMilestone = milestoneForRaised(raisedCents);
  const viewport = viewportForLevel(finalMilestone.level);
  const fill = (placed.reduce((n, b) => n + b.rect.w * b.rect.h, 0) / (viewport.w * viewport.h)) * 100;

  console.table(
    placed.map((b) => ({
      brand: b.name,
      x: b.rect.x,
      y: b.rect.y,
      w: b.rect.w,
      h: b.rect.h,
      cells: b.rect.w * b.rect.h,
      wanted: b.targetCells,
      usd: b.amountCents / 100,
    })),
  );

  const shrunk = placed.filter((b) => b.rect.w * b.rect.h < b.targetCells * 0.9);
  if (shrunk.length > 0) {
    console.warn(
      `Trimmed to fit: ${shrunk.map((b) => `${b.name} (${b.rect.w * b.rect.h}/${b.targetCells})`).join(", ")}`,
    );
  }

  console.log(`Raised $${(raisedCents / 100).toLocaleString()} · ${pixelsSold.toLocaleString()} px`);
  console.log(
    `Milestone L${finalMilestone.level} · viewport ${viewport.w}x${viewport.h} @ (${viewport.x},${viewport.y}) · ${fill.toFixed(0)}% full`,
  );

  writeFileSync("drizzle/seed-development.sql", renderSeedSql(placed, raisedCents));
  console.log("Rewrote drizzle/seed-development.sql");
}

function renderSeedSql(placed: PlacedBrand[], raisedCents: number) {
  const values = placed
    .map(
      (b) =>
        `  ('${b.name}', '${b.website}', '${b.logo}', 'cover', 'image/webp', ` +
        `${b.rect.x}, ${b.rect.y}, ${b.rect.w}, ${b.rect.h}, ${b.amountCents}, ` +
        `'paid', 'demo-seed', now(), true, now())`,
    )
    .join(",\n");

  return `-- Dev-only demo placements (~$${(raisedCents / 100).toLocaleString()} raised, ${placed.length} brands).
-- Generated by scripts/reseed-demo.ts against the 80x112 milestone world grid.
-- Do not hand-edit: rerun the script instead so coordinates stay milestone-legal.
DELETE FROM placements WHERE is_demo = true;

INSERT INTO placements (
  brand_name,
  website_url,
  creative_url,
  creative_fit,
  mime_type,
  x,
  y,
  width_cells,
  height_cells,
  amount_cents,
  status,
  requester_hash,
  reservation_expires_at,
  is_demo,
  paid_at
)
VALUES
${values};
`;
}

void main();
