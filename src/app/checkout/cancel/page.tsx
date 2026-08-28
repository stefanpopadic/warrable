import type { Metadata } from "next";
import Link from "next/link";
import { releaseExtension, releasePlacement } from "@/db/placements";

export const metadata: Metadata = {
  title: "Checkout cancelled",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams?: Promise<{ placement_id?: string; extension_id?: string }>;
}) {
  const params = await searchParams;
  const placementId = params?.placement_id?.trim();
  const extensionId = params?.extension_id?.trim();

  if (extensionId) {
    try {
      await releaseExtension(extensionId);
    } catch {
      // Ignored if already expired or cancelled
    }
  }

  if (placementId) {
    try {
      await releasePlacement(placementId);
    } catch {
      // Ignored if already expired or cancelled
    }
  }

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
          Nothing was charged. Your selected space has been released, so you can pick it or another spot immediately.
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
