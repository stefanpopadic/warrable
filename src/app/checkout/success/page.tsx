import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutStatusPanel } from "@/components/checkout-status";

export const metadata: Metadata = {
  title: "Payment status",
  robots: {
    index: false,
    follow: false,
  },
};

function isCheckoutSessionId(value: string | undefined) {
  if (!value || value.length > 255) return false;
  return value.startsWith("cks_") || value.startsWith("cs_");
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; status?: string }>;
}) {
  const { session_id: sessionId, status } = await searchParams;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-12 text-foreground">
      {isCheckoutSessionId(sessionId) ? (
        <CheckoutStatusPanel sessionId={sessionId!} />
      ) : status === "failed" ? (
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
          <h1 className="font-display text-5xl uppercase leading-none">INVALID CHECKOUT.</h1>
          <p className="mt-5 text-muted-foreground">
            This payment link is missing its checkout session reference.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex h-12 items-center justify-center bg-foreground px-6 font-display text-base tracking-wide text-background"
          >
            BACK TO THE SHIRT
          </Link>
        </div>
      )}
    </main>
  );
}
