"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BuyButton, PageShell } from "@/components/page-shell";
import { usd, formatPixelPrice } from "@/lib/artboard";
import { AUCTION_END } from "@/lib/auction";
import type { ArtboardSnapshot, LeaderboardEntry } from "@/lib/artboard-data";

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
      ["Days", d],
      ["Hours", h],
      ["Minutes", m],
      ["Seconds", s],
    ] as const;
  })();
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-3 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <p className="shrink-0 font-condensed text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Auction closes in
        </p>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex items-center">
        {parts.map(([label, value], index) => (
          <Fragment key={label}>
            <div className="min-w-0 flex-1 border border-border bg-card/20 px-1 py-4 text-center">
              <span className="block font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-none">
                {left === null ? "--" : String(value).padStart(2, "0")}
              </span>
              <span className="mx-auto my-3 block h-px w-3/4 border-t border-dashed border-border" />
              <span className="block font-condensed text-[9px] uppercase tracking-[0.22em] text-muted-foreground sm:text-[10px]">
                {label}
              </span>
            </div>
            {index < parts.length - 1 && (
              <span className="w-3 shrink-0 text-center font-condensed text-sm text-muted-foreground">
                :
              </span>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function LeaderboardTable({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? leaderboard : leaderboard.slice(0, 10);
  return (
    <div className="mt-2">
      <div className="border-t border-white/20">
        {visible.map((r) => {
          const domain = r.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
          const isFirst = r.rank === 1;
          return (
            <a
              key={r.rank}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className={`group grid grid-cols-[3rem_minmax(0,1fr)_auto] items-stretch border-b transition-[background-color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-yellow sm:grid-cols-[3.75rem_minmax(0,1fr)_auto] ${
                isFirst
                  ? "border-black/20 bg-white text-black hover:bg-accent-yellow"
                  : r.rank === 2
                    ? "border-white/20 bg-white/15 hover:bg-white/20"
                    : r.rank === 3
                      ? "border-white/20 bg-white/[0.08] hover:bg-white/15"
                      : r.rank >= 7
                        ? "border-white/20 opacity-70 hover:bg-white/5 hover:opacity-100"
                        : "border-white/20 hover:bg-white/10"
              }`}
            >
              <span
                className={`flex min-h-16 items-center justify-center border-r font-display text-xl leading-none sm:text-2xl ${
                  isFirst ? "border-black/20" : "border-white/20"
                }`}
              >
                {r.logo ? (
                  <span className="h-10 w-10 overflow-hidden rounded-sm sm:h-12 sm:w-12">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.logo}
                      alt={`${r.brand} logo`}
                      className="h-full w-full object-cover"
                    />
                  </span>
                ) : (
                  String(r.rank).padStart(2, "0")
                )}
              </span>
              <div className="flex min-w-0 items-center self-center px-3 py-3 sm:px-4">
                <div className="min-w-0">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base uppercase leading-tight tracking-wide sm:text-lg">
                      {r.brand}
                    </p>
                  </div>
                  <p
                    className={`truncate font-condensed text-xs leading-none sm:text-sm ${
                      isFirst ? "text-black/60" : "text-muted-foreground"
                    }`}
                  >
                    {domain}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end justify-center px-3 text-right sm:px-4">
                <div className="flex items-center justify-end gap-2">
                  {r.rank <= 3 && (
                    <span
                      className={`shrink-0 px-2 py-0.5 font-condensed text-[10px] font-semibold uppercase leading-none tracking-widest ${
                        isFirst
                          ? "bg-accent-yellow text-accent-yellow-foreground"
                          : r.rank === 2
                            ? "bg-white text-black"
                            : "border border-white/50 text-white"
                      }`}
                    >
                      Top {String(r.rank).padStart(2, "0")}
                    </span>
                  )}
                  <span className="font-display text-lg leading-none sm:text-xl">
                    {usd(r.bidCents)}
                  </span>
                </div>
                <span
                  className={`mt-1 font-condensed text-xs leading-none ${
                    isFirst ? "text-black/60" : "text-muted-foreground"
                  }`}
                >
                  {r.pixels.toLocaleString()} px
                </span>
              </div>
            </a>
          );
        })}
      </div>

      {leaderboard.length > 10 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full border border-border py-2 font-condensed text-xs uppercase tracking-widest text-muted-foreground hover:bg-secondary"
        >
          {expanded ? "Show less" : "See more"}
        </button>
      )}
    </div>
  );
}

type Shirt = {
  name: string;
  year: string;
  price: string;
  note: string;
  image: string;
  imageAlt: string;
  source: string;
};

const SHIRTS: Shirt[] = [
  {
    name: "Superlative Luxury diamond tee",
    year: "2012",
    price: "$400,000",
    note: "Claimed list price · 16 diamonds · no documented buyer (CNBC)",
    image: "/shirts/superlative-luxury.png",
    imageAlt: "Black Superlative Luxury diamond T-shirt",
    source: "https://www.cnbc.com/2012/01/19/the-400000-tshirt.html",
  },
  {
    name: "Hermès Noir Crocodile",
    year: "SS13",
    price: "$91,500",
    note: "Store list price · crocodile chiffon, Madison Ave",
    image: "/shirts/hermes-crocodile.jpg",
    imageAlt: "Hermès black crocodile chiffon T-shirt on the Spring 2013 runway",
    source: "https://www.today.com/style/hermes-selling-91-500-crocodile-t-shirt-1c9078567",
  },
  {
    name: "Supreme 1-of-1 tie-dye box logo sample",
    year: "c. 2006–07",
    price: "$52,000",
    note: "Sold · Hyp_ auction, Sept 2020",
    image: "/shirts/supreme-tie-dye.jpg",
    imageAlt: "One-of-one Supreme tie-dye box logo T-shirt",
    source: "https://www.highsnobiety.com/p/supreme-box-logo-sold-auction-52k/",
  },
  {
    name: "Kurt Cobain Sonic Youth tee",
    year: "1994",
    price: "$25,000",
    note: "Auction · Julien's, 7 Nov 2014",
    image: "/shirts/kurt-cobain-sonic-youth.jpg",
    imageAlt: "Sonic Youth T-shirt worn on stage by Kurt Cobain",
    source: "https://www.defunkd.com/blog/2010/01/20/vintage-nirvana-t-shirts/",
  },
  {
    name: "Grateful Dead 1967 Gut Terk tee",
    year: "1967",
    price: "$17,640",
    note: "Auction · Sotheby's, Oct 2021",
    image: "/shirts/grateful-dead-1967.jpg",
    imageAlt: "Yellow 1967 Grateful Dead T-shirt designed by Gut Terk",
    source: "https://www.upi.com/Odd_News/2021/10/19/Grateful-Dead-T-shirt-record-price-Sothebys/3281634675204/",
  },
  {
    name: "Grateful Dead Cornell Steal Your Face",
    year: "1977",
    price: "$15,120",
    note: "Auction · Sotheby's, Oct 2021",
    image: "/shirts/grateful-dead-cornell-2.jpg",
    imageAlt: "1977 Grateful Dead Cornell Steal Your Face ringer T-shirt",
    source: "https://loudwire.com/grateful-dead-vintage-t-shirt-most-expensive-sold-auction/",
  },
  {
    name: "Madonna worn Healthy/Swimmer tee",
    year: "1980s",
    price: "$15,000",
    note: "Auction · Julien's, May 2014 (mixed lot)",
    image: "/shirts/madonna-healthy.jpg",
    imageAlt: "Madonna wearing the blue Healthy Swimmer crop top",
    source: "https://wehotimes.com/way-back-weho-to-madonna-and-her-famous-healthy-photoshoot-shot-in-west-hollywood/",
  },
  {
    name: "Supreme x Nate Lowman Box Logo Shibuya",
    year: "2012",
    price: "$11,564",
    note: "Auction · Artcurial, May 2018",
    image: "/shirts/supreme-nate-lowman.jpg",
    imageAlt: "Supreme x Nate Lowman Shibuya box logo T-shirt",
    source: "https://artwithoutskin.com/2018/05/17/audace-supreme-par-artcurial-un-tee-shirt-paye-9-800-euros/",
  },
  {
    name: "Led Zeppelin Knebworth backstage tee",
    year: "1979",
    price: "$10,000",
    note: "Sold · eBay, May 2011",
    image: "/shirts/led-zeppelin-knebworth.jpg",
    imageAlt: "Led Zeppelin 1979 Knebworth backstage T-shirt",
    source: "https://www.defunkd.com/blog/2011/04/26/vintage-led-zeppein-t-shirt/",
  },
];

function ExpensiveShirts({ raisedCents }: { raisedCents: number }) {
  const [activeShirt, setActiveShirt] = useState<Shirt | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => setPortalReady(true), []);

  const movePreview = (clientX: number, clientY: number) => {
    if (!previewRef.current) return;
    const previewWidth = 240;
    const previewHeight = 304;
    const gap = 24;
    const edge = 16;
    const x =
      clientX + gap + previewWidth > window.innerWidth - edge
        ? clientX - previewWidth - gap
        : clientX + gap;
    const y = Math.min(
      window.innerHeight - previewHeight - edge,
      Math.max(edge, clientY - previewHeight / 2),
    );
    previewRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const parsePrice = (price: string) => Number(price.replace(/[$,]/g, ""));
  const ranked = SHIRTS.map((shirt) => ({
    ...shirt,
    value: parsePrice(shirt.price),
    isMdt: false,
  }));
  ranked.push({
    name: "MILLION DOLLAR T-SHIRT",
    year: "",
    price: usd(raisedCents),
    note: "Current total value of all sold shirt space",
    image: "/shirts/1milliondollartshirt.jpg",
    imageAlt: "Million Dollar T-Shirt covered with sponsor artwork",
    source: "",
    value: raisedCents / 100,
    isMdt: true,
  });
  ranked.sort((a, b) => b.value - a.value);

  return (
    <>
      <ol className="mt-8 border-t border-white/20" onPointerLeave={() => setActiveShirt(null)}>
        {ranked.map((item, i) => (
          <li key={item.name}>
            <a
              href={item.source || item.image}
              target="_blank"
              rel="noreferrer"
              onPointerEnter={(event) => {
                if (!item.image) {
                  setActiveShirt(null);
                  return;
                }
                setActiveShirt(item);
                movePreview(event.clientX, event.clientY);
              }}
              onPointerMove={(event) => {
                if (item.image) movePreview(event.clientX, event.clientY);
              }}
              className={`group grid grid-cols-[4rem_minmax(0,1fr)_auto] items-stretch border-b border-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-yellow sm:grid-cols-[5.25rem_minmax(0,1fr)_auto] ${
                item.isMdt ? "bg-white text-black" : "hover:bg-white/10"
              }`}
            >
              <span
                className={`flex min-h-24 items-center justify-center border-r font-display text-3xl leading-none sm:min-h-28 sm:text-4xl ${
                  item.isMdt ? "border-black/20 text-black" : "border-white/20 text-foreground"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 self-center px-3 py-5 sm:px-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={`font-display text-lg uppercase leading-tight tracking-wide sm:text-xl ${
                      item.isMdt ? "text-black" : ""
                    }`}
                  >
                    {item.name}
                  </span>
                  {item.year && (
                    <span className="font-condensed text-sm text-muted-foreground sm:text-base">
                      {item.year}
                    </span>
                  )}
                </div>
                <p
                  className={`mt-1.5 text-sm leading-snug sm:text-base ${
                    item.isMdt ? "text-black/70" : "text-muted-foreground"
                  }`}
                >
                  {item.note}
                </p>
              </div>
              <span
                className={`self-center px-3 font-display text-xl leading-none sm:px-5 sm:text-3xl ${
                  item.isMdt ? "text-black" : ""
                }`}
              >
                {item.price}
              </span>
            </a>
          </li>
        ))}
      </ol>

      {portalReady &&
        createPortal(
          <div
            ref={previewRef}
            aria-hidden="true"
            className={`pointer-events-none fixed left-0 top-0 z-[60] hidden w-60 border border-border bg-background p-2 shadow-[8px_8px_0_rgba(0,0,0,0.18)] transition-opacity duration-150 md:block ${
              activeShirt ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="relative aspect-square overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeShirt?.image} alt="" className="h-full w-full object-contain" />
            </div>
            <div className="px-1 pb-1 pt-2">
              <p className="font-display text-sm uppercase leading-tight tracking-wide">
                {activeShirt?.name}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

const FRIENDLY_QUESTIONS: [string, string][] = [
  [
    "How does the pricing work?",
    "Pricing starts at $0.25 per printed pixel and doubles every 100,000 pixels sold. Large purchases are split across tiers automatically. Minimum purchase is 100 pixels.",
  ],
  [
    "Can another buyer outbid my placement?",
    "No. Version one sells only free space. Once Dodo confirms your payment, that placement is yours and cannot be displaced.",
  ],
  [
    "What artwork should I upload?",
    "A square or rectangular PNG, JPG or WebP logo up to 4 MB. Transparent PNGs stay transparent; photographs fill the selected region.",
  ],
  [
    "When do I pay?",
    "At checkout. Dodo reserves your space for 30 minutes, and the logo goes live only after payment is confirmed. Completed purchases are final and non-refundable.",
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

function HomeContent({
  initialSnapshot,
  snapshotReady: initialReady,
}: {
  initialSnapshot: ArtboardSnapshot;
  snapshotReady: boolean;
}) {
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [snapshotReady, setSnapshotReady] = useState(initialReady);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/artboard", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as ArtboardSnapshot;
        if (active) setSnapshot(data);
      } catch {
        // Keep the last known public snapshot during transient failures.
      } finally {
        if (active) setSnapshotReady(true);
      }
    };
    void load();
    const interval = window.setInterval(load, 15_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const { stats, leaderboard } = snapshot;

  return (
    <PageShell
      leftRef={leftPanelRef}
      initialSnapshot={initialSnapshot}
      snapshotReady={initialReady}
    >
      <section id="top" className="border-b border-border px-6 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto mt-5 max-w-3xl text-left">
          <h1 className="text-center font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-tight">
            THE WORLD&apos;S
            <br />
            MOST EXPENSIVE
            <br />
            T-SHIRT.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-center text-lg text-muted-foreground">
            Every pixel is an auction. Buy space on a real shirt, promote your brand, and become part of
            internet history.
          </p>

          <div className="mt-8 flex flex-col items-center">
            <div className="w-full text-center">
              <Countdown />
            </div>
            {!snapshot.auctionClosed && (
              <BuyButton className="mt-8 bg-foreground px-7 py-3 font-display text-base tracking-wide text-background transition-colors hover:bg-accent-yellow hover:text-accent-yellow-foreground" />
            )}
          </div>

          <dl className="mt-8 grid grid-cols-3 border-y border-border">
            {[
              ["Total raised", usd(stats.raisedCents), null],
              [
                "Cost per px",
                formatPixelPrice(stats.currentPriceCents),
                stats.nextPriceCents ? `next ${formatPixelPrice(stats.nextPriceCents)}` : null,
              ],
              ["Pixels sold", stats.pixelsSold.toLocaleString(), null],
            ].map(([k, v, sub]) => (
              <div key={k} className="border-r border-border py-4 text-center last:border-r-0">
                <dt className="mb-[5px] font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                  {k}
                </dt>
                <dd className="mt-1 font-display text-2xl leading-none">{v}</dd>
                {sub ? (
                  <dd className="mt-1 font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                    {sub}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>

          <div id="leaderboard" className="mt-6 scroll-mt-6 text-left">
            {leaderboard.length > 0 && (
              <p className="font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                Largest current bidders
              </p>
            )}
            {!snapshotReady ? (
              <div className="border-y border-border px-4 py-7 text-center">
                <p className="font-condensed text-xs uppercase tracking-widest text-muted-foreground">
                  Loading bidders…
                </p>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="border-y border-border px-4 py-7 text-center">
                <div>
                  <h2 className="font-display text-3xl uppercase leading-none tracking-tight">
                    NO BIDS YET.
                    <br />
                    TAKE THE FIRST SPOT.
                  </h2>
                  <BuyButton className="mt-4 w-fit whitespace-nowrap bg-foreground px-5 py-3 font-display text-sm tracking-wide text-background transition-colors hover:bg-accent-yellow hover:text-accent-yellow-foreground">
                    BUY SPACE
                  </BuyButton>
                </div>
              </div>
            ) : (
              <LeaderboardTable leaderboard={leaderboard} />
            )}
          </div>
        </div>
      </section>

      <section id="top-shirts" className="scroll-mt-6 border-b border-border px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="section-heading">
            MOST
            <br />
            EXPENSIVE
            <br />
            T-SHIRTS
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Documented prices only. Million Dollar T-Shirt enters the ranking at the total value of all space
            sold — currently {usd(stats.raisedCents)}. Target: $1,000,000.
          </p>
          <ExpensiveShirts raisedCents={stats.raisedCents} />
        </div>
      </section>

      <section id="faq" className="scroll-mt-6 border-b border-border px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="section-heading">
            FREQUENTLY
            <br />
            ASKED
            <br />
            QUESTIONS
          </h2>
          <div className="mt-10 border-t border-border">
            {FRIENDLY_QUESTIONS.map(([q, a], index) => (
              <details key={q} open={index === 0} className="group border-b border-border">
                <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-3 py-5 [&::-webkit-details-marker]:hidden">
                  <h3 className="font-display text-xl uppercase leading-tight tracking-wide">{q}</h3>
                  <span
                    aria-hidden="true"
                    className="text-center font-condensed text-2xl leading-none text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 pr-8 leading-relaxed text-muted-foreground">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="section-heading">
            BUY SPACE ON
            <br />
            THE SHIRT.
          </h2>
          <BuyButton className="mt-6 inline-block bg-foreground px-8 py-4 font-display text-2xl tracking-wide text-background transition-colors hover:bg-accent-yellow hover:text-accent-yellow-foreground">
            CLAIM YOUR PIXELS
          </BuyButton>
        </div>
      </section>
    </PageShell>
  );
}

export function HomePage({
  initialSnapshot,
  snapshotReady,
}: {
  initialSnapshot: ArtboardSnapshot;
  snapshotReady: boolean;
}) {
  return <HomeContent initialSnapshot={initialSnapshot} snapshotReady={snapshotReady} />;
}
