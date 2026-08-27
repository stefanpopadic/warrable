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
import { usePathname } from "next/navigation";
import Artboard from "@/components/artboard";

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

export function PageShell({
  children,
  leftRef,
}: {
  children: ReactNode;
  leftRef?: RefObject<HTMLDivElement | null>;
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
      <main className="flex min-h-[100dvh] flex-col bg-background font-sans text-foreground lg:h-[100dvh] lg:flex-row lg:overflow-hidden">
        <div
          ref={leftRef}
          className={`no-scrollbar w-full shrink-0 border-border transition-[margin,transform,opacity] duration-500 ease-out lg:h-full lg:w-1/2 lg:overflow-y-auto lg:overscroll-contain lg:border-r ${
            buying
              ? "lg:pointer-events-none lg:-ml-[50%] lg:-translate-x-full lg:opacity-0"
              : "lg:ml-0 lg:translate-x-0 lg:opacity-100"
          }`}
        >
          <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-3 backdrop-blur lg:px-8">
            <nav className="grid grid-cols-3 items-center font-sans text-sm uppercase tracking-widest">
              <Link href="/" className="justify-self-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/wordmark.svg"
                  alt="Million Dollar T-Shirt"
                  className="h-9 w-auto invert"
                />
              </Link>

              <div className="flex items-center justify-self-center gap-3">
                <NavLink href="/" exact>
                  Home
                </NavLink>
                <span className="text-muted-foreground">/</span>
                <NavLink href="/about">About</NavLink>
              </div>

              <button
                type="button"
                onClick={openBuy}
                className="justify-self-end bg-foreground px-5 py-2.5 font-display text-sm tracking-wide text-background hover:opacity-90"
              >
                BUY SPACE
              </button>
            </nav>
          </header>

          {children}

          <footer className="hidden border-t border-border px-6 py-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground lg:block lg:px-8">
            <div className="mx-auto max-w-3xl">
              <p>milliondollartshirt.lol</p>
              <p className="mt-1">An internet experiment. Printed on one black shirt.</p>
            </div>
          </footer>
        </div>

        <aside
          id="artboard"
          className="relative h-[80vh] min-h-0 w-full min-w-0 flex-1 overflow-hidden border-t border-border lg:h-[100dvh] lg:border-t-0"
        >
          <Artboard className="h-full w-full" buyOpen={buying} onClose={closeBuy} />
        </aside>

        <footer className="border-t border-border px-6 py-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground lg:hidden">
          <p>milliondollartshirt.lol</p>
          <p className="mt-1">An internet experiment. Printed on one black shirt.</p>
        </footer>
      </main>
    </BuyPanelContext.Provider>
  );
}

function NavLink({
  href,
  exact,
  children,
}: {
  href: string;
  exact?: boolean;
  children: ReactNode;
}) {
  const path = usePathname();
  const active = exact ? path === href : path.startsWith(href);
  return (
    <Link
      href={href}
      className={`transition-colors hover:text-foreground ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
