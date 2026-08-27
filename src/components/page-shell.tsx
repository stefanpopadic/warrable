"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import Artboard from "@/components/artboard";
import type { ArtboardSnapshot } from "@/lib/artboard-data";

const BuyPanelContext = createContext<{
  buying: boolean;
  openBuy: () => void;
  closeBuy: () => void;
}>({
  buying: false,
  openBuy: () => {},
  closeBuy: () => {},
});

export function useBuyPanel() {
  return useContext(BuyPanelContext);
}

export function BuyButton({
  className,
  children = "BUY SPACE",
}: {
  className?: string;
  children?: ReactNode;
}) {
  const { openBuy } = useBuyPanel();
  return (
    <button type="button" onClick={openBuy} className={className}>
      {children}
    </button>
  );
}

export function PageShell({
  children,
  leftRef,
  initialSnapshot,
  snapshotReady = false,
}: {
  children: ReactNode;
  leftRef?: RefObject<HTMLDivElement | null>;
  initialSnapshot?: ArtboardSnapshot;
  snapshotReady?: boolean;
}) {
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (!buying) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuying(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [buying]);

  const openBuy = () => {
    setBuying(true);
    if (typeof window !== "undefined") {
      const artboard = document.getElementById("artboard");
      if (artboard && window.innerWidth < 1024) artboard.scrollIntoView({ block: "start" });
    }
  };

  const closeBuy = () => setBuying(false);

  return (
    <BuyPanelContext.Provider value={{ buying, openBuy, closeBuy }}>
      <main className="relative flex min-h-[100dvh] flex-col bg-background font-sans text-foreground lg:h-[100dvh] lg:overflow-hidden">
        <div
          ref={leftRef}
          className={`no-scrollbar relative z-20 w-full shrink-0 border-border bg-background transition-[translate,opacity] duration-500 ease-out lg:absolute lg:left-0 lg:top-0 lg:bottom-0 lg:w-1/2 lg:overflow-y-auto lg:overscroll-contain lg:border-r ${
            buying
              ? "lg:pointer-events-none lg:translate-x-[-100%] lg:opacity-0"
              : "lg:translate-x-0 lg:opacity-100"
          }`}
        >
          <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-3 backdrop-blur lg:px-8">
            <nav className="flex items-center justify-between gap-4">
              <Link href="/" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/1milliondollartshirt-logo.png"
                  alt="Million Dollar T-Shirt"
                  className="h-6 w-auto object-contain object-left"
                />
              </Link>

              <button
                type="button"
                onClick={openBuy}
                className="shrink-0 bg-foreground px-5 py-2.5 font-display text-sm tracking-wide text-background transition-colors hover:bg-accent-yellow hover:text-accent-yellow-foreground"
              >
                BUY SPACE
              </button>
            </nav>
          </header>

          {children}

          <footer className="hidden border-t border-border px-6 py-6 font-condensed text-xs uppercase tracking-widest text-muted-foreground lg:block lg:px-8">
            <div className="mx-auto max-w-3xl">
              <p>milliondollartshirt.lol</p>
              <p className="mt-1">An internet experiment. Printed on one black shirt.</p>
            </div>
          </footer>
        </div>

        <aside
          id="artboard"
          className={`relative h-[80vh] min-h-0 w-full overflow-hidden border-t border-border bg-black transition-[left] duration-500 ease-out lg:absolute lg:top-0 lg:bottom-0 lg:h-auto lg:w-auto lg:border-t-0 ${
            buying ? "lg:left-0 lg:right-0" : "lg:left-1/2 lg:right-0"
          }`}
        >
          <Artboard
            className="h-full w-full"
            buyOpen={buying}
            onClose={closeBuy}
            onStartDraw={openBuy}
            initialSnapshot={initialSnapshot}
            snapshotReady={snapshotReady}
          />
        </aside>

        <footer className="border-t border-border px-6 py-6 font-condensed text-xs uppercase tracking-widest text-muted-foreground lg:hidden">
          <p>milliondollartshirt.lol</p>
          <p className="mt-1">An internet experiment. Printed on one black shirt.</p>
        </footer>
      </main>
    </BuyPanelContext.Provider>
  );
}
