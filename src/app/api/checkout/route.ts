import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { ZodError } from "zod";
import {
  attachCheckoutSession,
  attachCreative,
  attachExtensionCheckoutSession,
  createPlacementExtension,
  getCurrentViewport,
  releaseExtension,
  releasePlacement,
  reservePlacement,
} from "@/db/placements";
import { getCheckoutBaseUrl, getRequesterHash, parseCheckoutFormData } from "@/lib/checkout";
import { getStripe } from "@/lib/stripe";

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
  let extensionId: string | null = null;
  let blobPathname: string | null = null;

  try {
    const viewport = await getCurrentViewport();
    const input = await parseCheckoutFormData(await request.formData(), viewport);
    const requesterHash = getRequesterHash(request);
    const baseUrl = getCheckoutBaseUrl(request);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    if (input.extendPlacementId) {
      const extension = await createPlacementExtension({
        placementId: input.extendPlacementId,
        email: input.email,
        rect: input.rect,
        requesterHash,
      });
      extensionId = extension.id;

      const successReturnUrl = new URL(`${baseUrl}/checkout/success`);
      successReturnUrl.searchParams.set("placement_id", extension.placementId);

      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        adaptive_pricing: { enabled: false },
        customer_email: input.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: extension.amountCents,
              product_data: {
                name: `Expand shirt space — ${extension.brandName}`,
                description: `+${extension.addedPixels.toLocaleString()} pixels on Million Dollar T-Shirt`,
              },
            },
          },
        ],
        metadata: {
          kind: "extension",
          extension_id: extension.id,
          placement_id: extension.placementId,
          amount_cents: String(extension.amountCents),
          new_amount_cents: String(extension.newAmountCents),
          pixel_count: String(extension.pixelCount),
          brand_name: extension.brandName,
          x: String(input.rect.x),
          y: String(input.rect.y),
          w: String(input.rect.w),
          h: String(input.rect.h),
        },
        success_url: `${successReturnUrl.toString()}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/checkout/cancel?extension_id=${extension.id}`,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
      });

      if (!session.id || !session.url) {
        throw new Error("checkout_url_missing");
      }

      await attachExtensionCheckoutSession(extension.id, session.id, expiresAt);
      return Response.json({ checkoutUrl: session.url }, { status: 201 });
    }

    const reservation = await reservePlacement({
      brandName: input.brandName,
      websiteUrl: input.websiteUrl,
      creativeFit: input.creativeFit,
      rect: input.rect,
      requesterHash,
      email: input.email,
    });
    placementId = reservation.id;

    if (!input.creative || !input.mimeType || !input.extension) {
      throw new Error("Upload a logo or image.");
    }

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

    const amountCents = Number(reservation.amount_cents);
    const pixelCount = Number(reservation.pixel_count);

    const successReturnUrl = new URL(`${baseUrl}/checkout/success`);
    successReturnUrl.searchParams.set("placement_id", placementId);

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      adaptive_pricing: { enabled: false },
      customer_email: input.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `Shirt space — ${input.brandName}`,
              description: `${pixelCount.toLocaleString()} pixels on Million Dollar T-Shirt`,
            },
          },
        },
      ],
      metadata: {
        kind: "placement",
        placement_id: placementId,
        amount_cents: String(amountCents),
        pixel_count: String(pixelCount),
        brand_name: input.brandName,
      },
      success_url: `${successReturnUrl.toString()}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel?placement_id=${placementId}`,
      expires_at: Math.floor(expiresAt.getTime() / 1000),
    });

    if (!session.id || !session.url) {
      throw new Error("checkout_url_missing");
    }

    await attachCheckoutSession(placementId, session.id, expiresAt);

    return Response.json({ checkoutUrl: session.url }, { status: 201 });
  } catch (error) {
    if (extensionId) {
      try {
        await releaseExtension(extensionId);
      } catch {
        // Expiry pass can clear it later.
      }
    }
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
      message.includes("outside the artboard") ||
      message.includes("Enter a valid email") ||
      message.includes("email_required") ||
      message.includes("email_mismatch") ||
      message.includes("email_not_on_file") ||
      message.includes("demo_not_extendable") ||
      message.includes("must_contain_original") ||
      message.includes("must_grow") ||
      message.includes("placement_not_found")
    ) {
      if (message.includes("email_mismatch")) {
        return apiError("That email does not match the original purchase.", 403);
      }
      if (message.includes("email_not_on_file")) {
        return apiError("This placement cannot be extended (no email on file).", 400);
      }
      if (message.includes("demo_not_extendable")) {
        return apiError("Demo logos cannot be extended.", 400);
      }
      if (message.includes("must_contain_original") || message.includes("must_grow")) {
        return apiError("Expand your existing space — it must grow and still cover the original.", 400);
      }
      if (message.includes("email_required") || message.includes("Enter a valid email")) {
        return apiError("Enter a valid email.", 400);
      }
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
    if (message.includes("outside_viewport")) {
      return apiError(
        "The shirt just grew to a new milestone. Refresh and pick your spot again.",
        409,
      );
    }
    if (message.includes("rate_limited")) {
      return apiError("Too many checkout attempts. Try again in an hour.", 429);
    }
    if (message.includes("auction_closed")) {
      return apiError("The auction is closed.", 410);
    }
    if (
      message.includes("not configured") ||
      message.includes("STRIPE_SECRET_KEY") ||
      message.includes("BLOB_READ_WRITE_TOKEN")
    ) {
      return apiError("Checkout is not configured yet.", 503);
    }

    console.error("Checkout creation failed", {
      message,
      placementId,
      extensionId,
    });
    return apiError("Checkout could not be started. Please try again.", 500);
  }
}
