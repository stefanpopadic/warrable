import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";

export function LegalPage({
  title,
  effective,
  children,
}: {
  title: string;
  effective?: string;
  children: ReactNode;
}) {
  return (
    <PageShell>
      <article className="border-b border-border px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-tight">
            {title}
          </h1>
          {effective ? (
            <p className="mt-5 text-sm text-muted-foreground">{effective}</p>
          ) : null}

          <div className="legal-prose mt-10 space-y-8 text-base leading-relaxed text-muted-foreground">
            {children}
          </div>

          <nav
            aria-label="Legal"
            className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 font-condensed text-xs uppercase tracking-widest text-muted-foreground"
          >
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/rules" className="hover:text-foreground">
              Rules
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </nav>
        </div>
      </article>
    </PageShell>
  );
}

export function LegalH2({ children }: { children: ReactNode }) {
  return <h2 className="section-heading text-foreground">{children}</h2>;
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p className="mt-3">{children}</p>;
}

export function LegalUl({ children }: { children: ReactNode }) {
  return <ul className="mt-3 list-disc space-y-2 pl-5">{children}</ul>;
}
