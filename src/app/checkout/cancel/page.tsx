import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Checkout cancelled",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutCancelPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-12 text-foreground">
      <div className="w-full max-w-lg border border-border bg-card p-6 text-center sm:p-8">
        <p className="font-condensed text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Stripe checkout
        </p>
        <h1 className="mt-4 font-display text-5xl uppercase leading-none">
          PAYMENT CANCELLED.
        </h1>
        <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-muted-foreground">
          Nothing was charged. Your selected space can remain reserved for up to 30 minutes, then
          it is released automatically.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex h-12 items-center justify-center bg-foreground px-6 font-display text-base tracking-wide text-background transition-colors hover:bg-accent-yellow hover:text-accent-yellow-foreground"
        >
          CHOOSE SPACE AGAIN
        </Link>
      </div>
    </main>
  );
}
