import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutStatusPanel } from "@/components/checkout-status";
import { isCheckoutReference } from "@/lib/checkout";

export const metadata: Metadata = {
  title: "Payment status",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    placement_id?: string;
    session_id?: string;
    payment_id?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const reference =
    params.placement_id?.trim() ??
    params.session_id?.trim() ??
    params.payment_id?.trim() ??
    "";
  const status = params.status?.trim().toLowerCase();

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-12 text-foreground">
      {isCheckoutReference(reference) ? (
        <CheckoutStatusPanel reference={reference} />
      ) : status === "failed" || status === "cancelled" ? (
        <div className="w-full max-w-lg border border-border bg-card p-8 text-center">
          <h1 className="font-display text-5xl uppercase leading-none">PAYMENT NOT COMPLETED.</h1>
          <p className="mt-5 text-muted-foreground">
            Nothing was charged. You can return to the shirt and choose another space.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex h-12 items-center justify-center bg-foreground px-6 font-display text-base tracking-wide text-background"
          >
            BACK TO THE SHIRT
          </Link>
        </div>
      ) : (
        <div className="w-full max-w-lg border border-border bg-card p-8 text-center">
          <h1 className="font-display text-5xl uppercase leading-none">CONFIRMING PAYMENT…</h1>
          <p className="mt-5 text-muted-foreground">
            Your payment may still be processing. Check the shirt in a moment — your space appears
            after confirmation.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex h-12 items-center justify-center bg-foreground px-6 font-display text-base tracking-wide text-background"
          >
            VIEW THE SHIRT
          </Link>
        </div>
      )}
    </main>
  );
}
