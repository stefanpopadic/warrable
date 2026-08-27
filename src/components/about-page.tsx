"use client";

import { BuyButton, PageShell } from "@/components/page-shell";

function AboutContent() {
  return (
    <PageShell>
      <section className="border-b border-border px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-tight">
            ABOUT
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Million Dollar T-Shirt is a wearable version of the classic Million Dollar Homepage idea:
            instead of buying pixels on a website, brands buy real visual space on a T-shirt.
          </p>
        </div>
      </section>

      <section className="border-b border-border px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="section-heading">THE IDEA</h2>
          <p className="mt-3 text-muted-foreground">
            The internet billboard becomes a real billboard you can wear. Every bid buys a piece of the
            shirt. The more money a brand puts in, the bigger its space becomes.
          </p>
          <p className="mt-3 text-muted-foreground">
            There are no fixed slots, no cap at 10 brands, and no pre-set grid of logos. The final artboard
            is a dense collage of every bidder — printed edge-to-edge on the back of a black shirt.
          </p>
        </div>
      </section>

      <section className="border-b border-border px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="section-heading">THE SHIRT</h2>
          <p className="mt-3 text-muted-foreground">
            Once the auction closes, the digital artboard is exported at print resolution and applied to a
            real garment. The shirt is then worn in public and documented as part of the project.
          </p>
        </div>
      </section>

      <section className="border-b border-border px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="section-heading">THE AUCTION</h2>
          <p className="mt-3 text-muted-foreground">
            Space is sold at $2.20 per printed pixel, with a 100-pixel minimum. Bidders can drag their own
            area or let the system find a free block. Logos are uploaded, previewed, and locked when the bid
            is placed.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="section-heading">PLACEHOLDER</h2>
          <p className="mt-3 text-muted-foreground">
            More details, photos, and timeline coming soon. This section is placeholder content while the
            final copy is prepared.
          </p>
          <BuyButton className="mt-8 bg-foreground px-7 py-3 font-display text-xl tracking-wide text-background transition-colors hover:bg-accent-yellow hover:text-accent-yellow-foreground" />
        </div>
      </section>
    </PageShell>
  );
}

export function AboutPage() {
  return <AboutContent />;
}
