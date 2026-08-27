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
  bg: string;
  fg: string;
  bid: number;
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BRANDS = [
  "REPLIT",
  "VOXIMO",
  "MakePost AI",
  "Digital Finest",
  "FORBIDDEN",
  "LaunchClub",
  "SOLBID",
  "ATC.com",
  "BlueAlpha",
  "uiktor",
  "ShinyGen",
  "WorkForge",
  "habitlab",
  "OPENLEDGER",
  "GoldRock.ai",
  "INDEXDD",
  "zentry",
  "PIXUDI",
  "KOMBO",
  "Olgan",
  "crevode",
  "Opłema",
  "Vibto",
  "ding dong",
  "ACODE",
  "PHALA",
  "b/",
  "AJD",
  "SG",
  "PJ",
  "EPI",
  "GLITCH",
  "NORDIS",
  "hexa",
  "Loopr",
  "Kavu",
  "MONOS",
  "tinyfox",
  "QRT",
  "Solace",
  "dyna",
  "Frame0",
  "Nomad",
  "ZAPT",
  "kettl",
  "Orbis",
  "Pique",
  "Vault",
  "YOLO",
  "mim",
  "Basil",
  "Crux",
  "Nyx",
  "Peak",
  "Slate",
  "Terra",
  "Umbra",
  "Vela",
  "Wren",
  "Zeal",
  "Auro",
  "Brim",
  "Cove",
  "Dune",
  "Echo",
  "Flux",
  "Gale",
  "Halo",
  "Iris",
  "Juno",
  "Kilo",
  "Lumen",
  "Mesa",
  "Nova",
  "Onyx",
  "Prism",
  "Quill",
  "Rune",
  "Sable",
  "Talon",
  "Ulta",
  "Verve",
  "Wisp",
  "Xeno",
  "Yarn",
  "Zinc",
];

const PALETTE: [string, string][] = [
  ["#ffffff", "#000000"],
  ["#ff2d55", "#ffffff"],
  ["#ffd60a", "#000000"],
  ["#0a84ff", "#ffffff"],
  ["#30d158", "#000000"],
  ["#ff9f0a", "#000000"],
  ["#bf5af2", "#ffffff"],
  ["#64d2ff", "#000000"],
  ["#111111", "#ffffff"],
  ["#ff375f", "#ffffff"],
  ["#e8e8e8", "#000000"],
  ["#1c7ed6", "#ffffff"],
  ["#f76707", "#ffffff"],
  ["#12b886", "#000000"],
  ["#fa5252", "#ffffff"],
];

export function brandToUrl(brand: string) {
  const slug = brand
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/\.+/g, "")
    .slice(0, 20);
  return `https://${slug || "brand"}.com`;
}

export function buildPlaceholderBoard(count = 30, seed = 42) {
  const rnd = mulberry32(seed);
  const grid: (string | null)[] = new Array(COLS * ROWS).fill(null);
  const blocks: Block[] = [];

  const free = (x: number, y: number, w: number, h: number) => {
    if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return false;
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if (grid[j * COLS + i]) return false;
    return true;
  };

  const fill = (b: Block) => {
    for (let j = b.y; j < b.y + b.h; j++)
      for (let i = b.x; i < b.x + b.w; i++) grid[j * COLS + i] = b.id;
    blocks.push(b);
  };

  const desiredSizes: [number, number][] = [
    [20, 8],
    [18, 8],
    [16, 7],
    [14, 7],
    [14, 6],
    [12, 7],
    [12, 6],
    [10, 8],
    [10, 6],
    [10, 5],
    [9, 6],
    [9, 5],
    [8, 6],
    [8, 5],
    [8, 4],
    [7, 6],
    [7, 5],
    [7, 4],
    [6, 5],
    [6, 4],
    [5, 5],
    [5, 4],
    [5, 3],
    [4, 5],
    [4, 4],
    [4, 3],
    [3, 4],
    [3, 3],
    [2, 3],
    [2, 2],
  ];

  let id = 0;
  for (let idx = 0; idx < count; idx++) {
    let [w, h] = desiredSizes[idx] ?? [
      Math.max(1, Math.floor(rnd() * 4) + 1),
      Math.max(1, Math.floor(rnd() * 4) + 1),
    ];
    let placed = false;
    for (let shrink = 0; shrink < 8 && !placed; shrink++) {
      const attempts = w * h > 40 ? 400 : 2500;
      for (let a = 0; a < attempts; a++) {
        const x = Math.floor(rnd() * (COLS - w + 1));
        const y = Math.floor(rnd() * (ROWS - h + 1));
        if (!free(x, y, w, h)) continue;
        const [bg, fg] = PALETTE[Math.floor(rnd() * PALETTE.length)]!;
        const area = w * h * CELL_PX * CELL_PX;
        const brand = BRANDS[Math.floor(rnd() * BRANDS.length)]!;
        fill({
          id: `p${id++}`,
          x,
          y,
          w,
          h,
          brand,
          url: brandToUrl(brand),
          bg,
          fg,
          bid: area * PRICE_PER_PIXEL,
        });
        placed = true;
        break;
      }
      if (!placed) {
        w = Math.max(1, w - 1);
        h = Math.max(1, h - 1);
      }
    }
    if (!placed) break;
  }

  const sold = blocks.reduce((s, b) => s + b.w * b.h, 0);
  return { blocks, grid, sold };
}

export const board = buildPlaceholderBoard(30, 42);

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
    bid: b.bid,
    pixels: b.w * b.h * CELL_PX * CELL_PX,
  }));

export const usd = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
