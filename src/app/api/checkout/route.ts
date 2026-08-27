import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { ZodError } from "zod";
import {
  attachCheckoutSession,
  attachCreative,
  releasePlacement,
  reservePlacement,
} from "@/db/placements";
import { getCheckoutBaseUrl, getRequesterHash, parseCheckoutFormData } from "@/lib/checkout";
import { getDodo, getPlacementProductId } from "@/lib/dodo";

export const runtime = "nodejs";
export const maxDuration = 30;

function apiError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "unknown_error";
}

export async function POST(request: Request) {
  let placementId: string | null = null;
  let blobPathname: string | null = null;

  try {
    const input = await parseCheckoutFormData(await request.formData());
    const requesterHash = getRequesterHash(request);
    const reservation = await reservePlacement({
      brandName: input.brandName,
      websiteUrl: input.websiteUrl,
      creativeFit: input.creativeFit,
      rect: input.rect,
      requesterHash,
    });
    placementId = reservation.id;

    const pathname = `placements/${placementId}/${randomUUID()}.${input.extension}`;
    const blob = await put(pathname, input.creative, {
      access: "public",
      addRandomSuffix: false,
      contentType: input.mimeType,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    blobPathname = blob.pathname;
    await attachCreative(placementId, {
      url: blob.url,
      pathname: blob.pathname,
      mimeType: input.mimeType,
    });

    const baseUrl = getCheckoutBaseUrl(request);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const amountCents = Number(reservation.amount_cents);
    const pixelCount = Number(reservation.pixel_count);

    const session = await getDodo().checkoutSessions.create({
      product_cart: [
        {
          product_id: getPlacementProductId(),
          quantity: 1,
          amount: amountCents,
        },
      ],
      billing_currency: "USD",
      feature_flags: {
        allow_currency_selection: false,
      },
      metadata: {
        placement_id: placementId,
        amount_cents: String(amountCents),
        pixel_count: String(pixelCount),
        brand_name: input.brandName,
      },
      return_url: `${baseUrl}/checkout/success`,
    });

    if (!session.session_id || !session.checkout_url) {
      throw new Error("checkout_url_missing");
    }

    await attachCheckoutSession(placementId, session.session_id, expiresAt);

    return Response.json({ checkoutUrl: session.checkout_url }, { status: 201 });
  } catch (error) {
    if (placementId) {
      try {
        const releasedPathname = await releasePlacement(placementId);
        blobPathname ??= releasedPathname;
      } catch {
        // A later expiry pass can release the reservation.
      }
    }

    if (blobPathname) {
      try {
        await del(blobPathname);
      } catch {
        // Blob cleanup is best effort and never changes payment state.
      }
    }

    const message = messageFromError(error);
    if (error instanceof ZodError) {
      return apiError(error.issues[0]?.message ?? "Check the form and try again.", 400);
    }
    if (
      message.includes("Upload a logo") ||
      message.includes("Image must") ||
      message.includes("valid PNG") ||
      message.includes("Website") ||
      message.includes("Invalid URL") ||
      message.includes("outside the artboard")
    ) {
      return apiError(
        message.includes("Invalid URL")
          ? "Enter a valid website URL (e.g. https://yourbrand.com)."
          : message,
        400,
      );
    }
    if (message.includes("placement_overlap")) {
      return apiError("That space was just reserved. Choose another position.", 409);
    }
    if (message.includes("rate_limited")) {
      return apiError("Too many checkout attempts. Try again in an hour.", 429);
    }
    if (message.includes("auction_closed")) {
      return apiError("The auction is closed.", 410);
    }
    if (
      message.includes("not configured") ||
      message.includes("DODO_PAYMENTS") ||
      message.includes("BLOB_READ_WRITE_TOKEN")
    ) {
      return apiError("Checkout is not configured yet.", 503);
    }

    console.error("Checkout creation failed", {
      message,
      placementId,
    });
    return apiError("Checkout could not be started. Please try again.", 500);
  }
}
