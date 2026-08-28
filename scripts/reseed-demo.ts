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
};

// Ordered oldest purchase first. The first eleven brands fill the level 0
// canvas to ~74% and tip the auction past $10k; the rest land in the level 1
// ring that opens up, so the seeded board tells the growth story on its own.
const DEMO_BRANDS: DemoBrand[] = [
  { name: "Amazon", website: "https://amazon.com", logo: "/logos/amazon.svg", dollars: 2400, aspect: 3.31 },
  { name: "Apple", website: "https://apple.com", logo: "/logos/apple.svg", dollars: 1600, aspect: 1.0 },
  { name: "Airbnb", website: "https://airbnb.com", logo: "/logos/airbnb.svg", dollars: 1400, aspect: 1.0 },
  { name: "Netflix", website: "https://netflix.com", logo: "/logos/netflix.svg", dollars: 900, aspect: 1.0 },
  { name: "YouTube", website: "https://youtube.com", logo: "/logos/youtube.svg", dollars: 750, aspect: 1.4 },
  { name: "Shopify", website: "https://shopify.com", logo: "/logos/shopify.svg", dollars: 750, aspect: 1.0 },
  { name: "Slack", website: "https://slack.com", logo: "/logos/slack.svg", dollars: 625, aspect: 1.0 },
  { name: "Dropbox", website: "https://dropbox.com", logo: "/logos/dropbox.svg", dollars: 500, aspect: 1.0 },
  { name: "Stripe", website: "https://stripe.com", logo: "/logos/stripe.svg", dollars: 400, aspect: 1.0 },
  { name: "Figma", website: "https://figma.com", logo: "/logos/figma.svg", dollars: 300, aspect: 0.72 },
  { name: "Webflow", website: "https://webflow.com", logo: "/logos/webflow.svg", dollars: 400, aspect: 1.0 },
  { name: "Notion", website: "https://notion.so", logo: "/logos/notion.svg", dollars: 1200, aspect: 1.0 },
  { name: "Vercel", website: "https://vercel.com", logo: "/logos/vercel.svg", dollars: 1200, aspect: 1.2 },
  { name: "Linear", website: "https://linear.app", logo: "/logos/linear.svg", dollars: 1050, aspect: 1.0 },
  { name: "Spotify", website: "https://spotify.com", logo: "/logos/spotify.svg", dollars: 900, aspect: 1.0 },
  { name: "GitHub", website: "https://github.com", logo: "/logos/github.svg", dollars: 900, aspect: 1.0 },
  { name: "OpenAI", website: "https://openai.com", logo: "/logos/openai.svg", dollars: 750, aspect: 1.0 },
  { name: "Adobe", website: "https://adobe.com", logo: "/logos/adobe.svg", dollars: 600, aspect: 0.72 },
  { name: "Adidas", website: "https://adidas.com", logo: "/logos/adidas.svg", dollars: 500, aspect: 1.0 },
  { name: "Nike", website: "https://nike.com", logo: "/logos/nike.svg", dollars: 450, aspect: 1.8 },
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
        ${brand.name}, ${brand.website}, ${brand.logo}, 'contain', 'image/svg+xml',
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
        `  ('${b.name}', '${b.website}', '${b.logo}', 'contain', 'image/svg+xml', ` +
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
