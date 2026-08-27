"use client";

import { useEffect, useRef, useState } from "react";
import { PageShell, useBuyPanel } from "@/components/page-shell";
import { leaderboard, stats, usd } from "@/lib/artboard";

const AUCTION_END = Date.UTC(2026, 8, 10, 8, 0, 0);

function Countdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, AUCTION_END - Date.now()));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);
  const parts = (() => {
    const t = left ?? 0;
    const d = Math.floor(t / 86400000);
    const h = Math.floor(t / 3600000) % 24;
    const m = Math.floor(t / 60000) % 60;
    const s = Math.floor(t / 1000) % 60;
    return [
      ["D", d],
      ["H", h],
      ["M", m],
      ["S", s],
    ] as const;
  })();
  return (
    <div className="flex justify-center gap-4 font-display text-[clamp(1.75rem,4.5vw,3rem)] leading-none text-foreground">
      {parts.map(([l, v]) => (
        <span key={l}>
          {left === null ? "--" : String(v).padStart(2, "0")}
          <span className="ml-1 font-mono text-sm text-muted-foreground">{l}</span>
        </span>
      ))}
    </div>
  );
}

function LeaderboardTable() {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? leaderboard : leaderboard.slice(0, 10);
  return (
    <div className="mt-2">
      <div className="border-t border-border">
        {visible.map((r) => {
          const domain = r.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
          return (
            <a
              key={r.rank}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 border-b border-border/60 px-1 py-3 hover:bg-secondary/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                alt={`${r.brand} logo`}
                loading="lazy"
                className="h-9 w-9 shrink-0 rounded-sm bg-secondary object-contain p-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg leading-tight tracking-wide group-hover:underline">
                  {r.brand}
                </p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{domain}</p>
              </div>
              <div className="text-right font-mono text-xs text-muted-foreground">
                {r.pixels.toLocaleString()} px
              </div>
              <div className="w-24 text-right font-display text-lg">{usd(r.bid)}</div>
            </a>
          );
        })}
      </div>

      {leaderboard.length > 10 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full border border-border py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:bg-secondary"
        >
          {expanded ? "Show less" : "See more"}
        </button>
      )}
    </div>
  );
}

const SHIRTS: [string, string, string, string][] = [
  ["Superlative Luxury diamond tee", "2012", "$400,000", "Claimed list price · 16 diamonds · no documented buyer (CNBC)"],
  ["Hermès Noir Crocodile", "SS13", "$91,500", "Store list price · crocodile chiffon, Madison Ave"],
  ["Supreme 1-of-1 tie-dye box logo sample", "c. 2006–07", "$52,000", "Sold · Hyp_ auction, Sept 2020"],
  ["Kurt Cobain Sonic Youth tee", "1994", "$25,000", "Auction · Julien's, 7 Nov 2014"],
  ["Grateful Dead 1967 Gut Terk tee", "1967", "$17,640", "Auction · Sotheby's, Oct 2021"],
  ["Grateful Dead Cornell Steal Your Face", "1977", "$15,120", "Auction · Sotheby's, Oct 2021"],
  ["Madonna worn Healthy/Swimmer tee", "1980s", "$15,000", "Auction · Julien's, May 2014 (mixed lot)"],
  ["Supreme x Nate Lowman Box Logo Shibuya", "2012", "$11,564", "Auction · Artcurial, May 2018"],
  ["Led Zeppelin Knebworth backstage tee", "1979", "$10,000", "Sold · eBay, May 2011"],
  ["John Lennon 'You Are Here' worn tee", "1970s", "$7,088", "Auction · Gotta Have Rock and Roll, 2008"],
];

const FAQ: [string, string][] = [
  [
    "How does the pricing work?",
    "Space is priced per printed pixel — $2.20 per pixel, 100 pixels ($220) minimum. Drag a bigger area, pay more, get more of the shirt.",
  ],
  [
    "Can I increase my bid later?",
    "Yes. You can top up to expand your area into adjacent free space, or outbid for a more central placement while the auction is open.",
  ],
  [
    "What artwork should I upload?",
    "A square or rectangular PNG/JPG logo at least 2x the pixel size of your area. We fit it to your exact region — no text smaller than legible print.",
  ],
  [
    "When do I pay?",
    "At bid time. If your placement is outbid or can't be printed, you're refunded in full.",
  ],
  [
    "What happens when the auction closes?",
    "The artboard is locked, exported at print resolution and printed edge-to-edge on the back of a black shirt. Every buyer gets the final artwork file.",
  ],
  [
    "What do I actually get?",
    "Your creative on a real, worn shirt, photographed and featured in content around the project — plus a permanent spot in the archived artboard.",
  ],
];

function HomeContent() {
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const { openBuy } = useBuyPanel();

  return (
    <PageShell leftRef={leftPanelRef}>
      <section id="top" className="border-b border-border px-6 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-3xl text-left">
          <h1 className="text-center font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-tight">
            THE WORLD&apos;S
            <br />
            MOST EXPENSIVE
            <br />
            T-SHIRT.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-center text-lg text-muted-foreground">
            Every pixel is an auction. Buy space on a real shirt, get your brand seen, and become part of
            internet history.
          </p>

          <div className="mt-8 flex flex-col items-center">
            <div className="text-center">
              <p className="mb-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Auction closes in
              </p>
              <Countdown />
            </div>
            <button
              type="button"
              onClick={openBuy}
              className="mt-8 bg-foreground px-7 py-3 font-display text-xl tracking-wide text-background hover:opacity-90"
            >
              BUY SPACE
            </button>
          </div>

          <dl className="mt-8 grid grid-cols-3 border-y border-border">
            {[
              ["Total raised", usd(stats.raised)],
              ["Brands", String(stats.brands)],
              ["Pixels sold", stats.pixelsSold.toLocaleString()],
            ].map(([k, v]) => (
              <div key={k} className="border-r border-border py-4 pr-4 last:border-r-0">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {k}
                </dt>
                <dd className="mt-1 font-display text-2xl leading-none">{v}</dd>
              </div>
            ))}
          </dl>

          <div id="leaderboard" className="mt-6 scroll-mt-6 text-left">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Largest current bidders
            </p>
            {leaderboard.length === 0 ? (
              <p className="mt-2 border border-dashed border-border px-3 py-4 font-display text-lg tracking-wide text-muted-foreground">
                NO BIDS YET — THE SHIRT IS COMPLETELY EMPTY.
              </p>
            ) : (
              <LeaderboardTable />
            )}
          </div>
        </div>
      </section>

      <section id="top-shirts" className="scroll-mt-6 border-b border-border px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl tracking-tight">MOST EXPENSIVE T-SHIRTS</h2>
          <p className="mt-2 text-muted-foreground">
            Documented prices only. Million Dollar T-Shirt enters the ranking at the total value of all space
            sold — currently {usd(stats.raised)}. Target: $1,000,000.
          </p>
          <ol className="mt-6 border-t border-border">
            {(() => {
              const parsePrice = (s: string) => Number(s.replace(/[$,]/g, ""));
              const all = SHIRTS.map(([name, year, price, note]) => ({
                name,
                year,
                price,
                note,
                value: parsePrice(price),
                isMdt: false,
              }));
              all.push({
                name: "MILLION DOLLAR T-SHIRT",
                year: "",
                price: usd(stats.raised),
                note: "Current total value of all sold shirt space",
                value: stats.raised,
                isMdt: true,
              });
              all.sort((a, b) => b.value - a.value);
              return all.map((item, i) => (
                <li
                  key={item.name}
                  className={`flex items-start gap-4 border-b border-border px-3 py-4 ${
                    item.isMdt ? "bg-accent-yellow/10" : ""
                  }`}
                >
                  <span className="w-10 shrink-0 font-display text-2xl leading-none text-muted-foreground/40">
                    #{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span
                        className={`font-display tracking-wide ${
                          item.isMdt ? "text-xl text-accent-yellow" : ""
                        }`}
                      >
                        {item.name}
                      </span>
                      {item.year && (
                        <span className="font-mono text-xs text-muted-foreground">{item.year}</span>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-sm ${
                        item.isMdt ? "text-accent-yellow/80" : "text-muted-foreground"
                      }`}
                    >
                      {item.note}
                    </p>
                  </div>
                  <span className={`shrink-0 font-display text-lg ${item.isMdt ? "text-accent-yellow" : ""}`}>
                    {item.price}
                  </span>
                </li>
              ));
            })()}
          </ol>
        </div>
      </section>

      <section id="faq" className="scroll-mt-6 border-b border-border px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl tracking-tight">FAQ / AUCTION RULES</h2>
          <div className="mt-6 grid gap-y-6">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <h3 className="font-display text-lg tracking-wide">{q.toUpperCase()}</h3>
                <p className="mt-1 text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-[clamp(2rem,4vw,3.5rem)] leading-[0.95] tracking-tight">
            BUY SPACE ON
            <br />
            THE SHIRT.
          </h2>
          <button
            type="button"
            onClick={openBuy}
            className="mt-6 inline-block bg-foreground px-8 py-4 font-display text-2xl tracking-wide text-background hover:opacity-90"
          >
            CLAIM YOUR PIXELS
          </button>
        </div>
      </section>
    </PageShell>
  );
}

export function HomePage() {
  return <HomeContent />;
}
