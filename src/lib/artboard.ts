export const COLS = 60;
export const ROWS = 76;
export const CELL_PX = 10;
export const PRICE_PER_PIXEL = 2.2;
export const CELL_PRICE = CELL_PX * CELL_PX * PRICE_PER_PIXEL;

export type Block = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  brand: string;
  url: string;
  logo?: string;
  creative?: string;
  creativeFit?: "contain" | "cover";
  bg: string;
  fg: string;
  bid: number;
};

export function brandToUrl(brand: string) {
  const slug = brand
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/\.+/g, "")
    .slice(0, 20);
  return `https://${slug || "brand"}.com`;
}

function demoBid(
  id: string,
  brand: string,
  url: string,
  x: number,
  y: number,
  w: number,
  h: number,
  bg: string,
  fg = "#000000",
): Block {
  return {
    id,
    x,
    y,
    w,
    h,
    brand,
    url,
    logo: `/logos/${id}.svg`,
    bg,
    fg,
    bid: w * h * CELL_PRICE,
  };
}

export const DEMO_BIDS: Block[] = [
  demoBid("vercel", "Vercel", "https://vercel.com", 3, 4, 14, 10, "#ffffff"),
  demoBid("linear", "Linear", "https://linear.app", 20, 3, 10, 14, "#5e6ad2", "#ffffff"),
  demoBid("notion", "Notion", "https://notion.so", 34, 5, 18, 8, "#ffffff"),
  demoBid("figma", "Figma", "https://figma.com", 5, 18, 11, 15, "#1e1e1e", "#ffffff"),
  demoBid("webflow", "Webflow", "https://webflow.com", 19, 20, 17, 9, "#4353ff", "#ffffff"),
  demoBid("stripe", "Stripe", "https://stripe.com", 40, 17, 13, 13, "#635bff", "#ffffff"),
  demoBid("shopify", "Shopify", "https://shopify.com", 3, 38, 19, 10, "#95bf47"),
  demoBid("slack", "Slack", "https://slack.com", 26, 35, 9, 16, "#ffffff"),
  demoBid("dropbox", "Dropbox", "https://dropbox.com", 39, 37, 16, 9, "#0061ff", "#ffffff"),
  demoBid("airbnb", "Airbnb", "https://airbnb.com", 15, 55, 28, 10, "#ff5a5f", "#ffffff"),
  demoBid("nike", "Nike", "https://nike.com", 0, 0, 3, 3, "#ffffff"),
  demoBid("adidas", "Adidas", "https://adidas.com", 54, 0, 6, 12, "#000000", "#ffffff"),
  demoBid("spotify", "Spotify", "https://spotify.com", 0, 15, 4, 18, "#1db954"),
  demoBid("github", "GitHub", "https://github.com", 17, 30, 8, 8, "#ffffff"),
  demoBid("openai", "OpenAI", "https://openai.com", 36, 30, 10, 6, "#10a37f", "#ffffff"),
  demoBid("adobe", "Adobe", "https://adobe.com", 47, 31, 11, 5, "#ff0000", "#ffffff"),
  demoBid("netflix", "Netflix", "https://netflix.com", 0, 50, 12, 8, "#000000", "#ffffff"),
  demoBid("youtube", "YouTube", "https://youtube.com", 45, 50, 12, 10, "#ffffff"),
  demoBid("apple", "Apple", "https://apple.com", 0, 65, 16, 10, "#f5f5f5"),
  demoBid("amazon", "Amazon", "https://amazon.com", 44, 63, 16, 12, "#232f3e", "#ffffff"),
];

const demoGrid: (string | null)[] = new Array(COLS * ROWS).fill(null);

for (const block of DEMO_BIDS) {
  for (let y = block.y; y < block.y + block.h; y += 1) {
    for (let x = block.x; x < block.x + block.w; x += 1) {
      demoGrid[y * COLS + x] = block.id;
    }
  }
}

export const board: { blocks: Block[]; grid: (string | null)[]; sold: number } = {
  blocks: DEMO_BIDS,
  grid: demoGrid,
  sold: DEMO_BIDS.reduce((total, block) => total + block.w * block.h, 0),
};

export const stats = {
  raised: board.blocks.reduce((s, b) => s + b.bid, 0),
  brands: board.blocks.length,
  pixelsSold: board.sold * CELL_PX * CELL_PX,
  pixelsTotal: COLS * ROWS * CELL_PX * CELL_PX,
};

export const leaderboard = [...board.blocks]
  .sort((a, b) => b.bid - a.bid)
  .map((b, i) => ({
    rank: i + 1,
    brand: b.brand,
    url: b.url,
    logo: b.logo,
    bid: b.bid,
    pixels: b.w * b.h * CELL_PX * CELL_PX,
  }));

export const usd = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
