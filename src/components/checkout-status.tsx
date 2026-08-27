"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CheckoutStatus = {
  brand: string;
  status: "reserved" | "paid" | "expired" | "cancelled" | "payment_review";
  amountCents: number;
  pixels: number;
};

const terminalStatuses = new Set<CheckoutStatus["status"]>([
  "paid",
  "expired",
  "cancelled",
  "payment_review",
]);

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function CheckoutStatusPanel({ reference }: { reference: string }) {
  const [result, setResult] = useState<CheckoutStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let attempts = 0;
    let timeout: number | undefined;

    const check = async () => {
      attempts += 1;
      try {
        const response = await fetch(
          `/api/checkout/status?ref=${encodeURIComponent(reference)}`,
          { cache: "no-store" },
        );
        const body = (await response.json()) as CheckoutStatus & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Payment status is unavailable.");
        if (!active) return;
        setResult(body);
        setError(null);
        if (!terminalStatuses.has(body.status) && attempts < 15) {
          timeout = window.setTimeout(check, 2_000);
        }
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Payment status is unavailable.");
        if (attempts < 5) timeout = window.setTimeout(check, 2_000);
      }
    };

    void check();
    return () => {
      active = false;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [reference]);

  const paid = result?.status === "paid";
  const review = result?.status === "payment_review";
  const failed = result?.status === "expired" || result?.status === "cancelled";

  return (
    <div className="w-full max-w-lg border border-border bg-card p-6 text-center sm:p-8">
      <p className="font-condensed text-xs uppercase tracking-[0.24em] text-muted-foreground">
        Dodo Payments
      </p>
      <h1 className="mt-4 font-display text-5xl uppercase leading-none">
        {paid
          ? "SPACE SECURED."
          : review
            ? "PAYMENT UNDER REVIEW."
            : failed
              ? "PAYMENT NOT COMPLETED."
              : "CONFIRMING PAYMENT…"}
      </h1>

      {paid && result ? (
        <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-muted-foreground">
          {result.brand} is live on the shirt with {result.pixels.toLocaleString()} pixels for{" "}
          {money(result.amountCents)}.
        </p>
      ) : review ? (
        <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-muted-foreground">
          Dodo confirmed the payment, but the placement needs a manual safety check. No second
          payment is required.
        </p>
      ) : failed ? (
        <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-muted-foreground">
          The reservation was released. You can return to the shirt and choose another space.
        </p>
      ) : (
        <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-muted-foreground">
          The placement appears only after the signed Dodo webhook confirms payment. This
          normally takes a few seconds.
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      <Link
        href="/"
        className="mt-7 inline-flex h-12 items-center justify-center bg-foreground px-6 font-display text-base tracking-wide text-background transition-colors hover:bg-accent-yellow hover:text-accent-yellow-foreground"
      >
        VIEW THE SHIRT
      </Link>
    </div>
  );
}
