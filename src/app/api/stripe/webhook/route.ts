import { del } from "@vercel/blob";
import type Stripe from "stripe";
import {
  applyPaidExtension,
  getExtensionForPayment,
  getPlacementForPayment,
  markCheckoutEnded,
  markExtensionEnded,
  markPlacementPaid,
  markPaymentReview,
  repackBoard,
} from "@/db/placements";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

async function deleteCreative(pathname: string | null) {
  if (!pathname) return;
  try {
    await del(pathname);
  } catch (error) {
    console.error("Expired creative cleanup failed", {
      pathname,
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

function placementIdFromSession(session: Stripe.Checkout.Session) {
  const id = session.metadata?.placement_id?.trim();
  return id ? id : null;
}

function extensionIdFromSession(session: Stripe.Checkout.Session) {
  const id = session.metadata?.extension_id?.trim();
  return id ? id : null;
}

function paymentIntentId(session: Stripe.Checkout.Session) {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

async function processExtensionCompleted(event: Stripe.Event, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;

  const extensionId = extensionIdFromSession(session);
  if (!extensionId) return;

  const extension = await getExtensionForPayment(extensionId);
  if (!extension) return;

  const sessionId = session.id;
  const paymentId = paymentIntentId(session);
  const customerEmail = session.customer_details?.email ?? null;
  const metadataAmountCents = Number(session.metadata?.amount_cents);
  const amountMatches =
    session.amount_total !== null &&
    Number(extension.amount_cents) === session.amount_total &&
    Number.isFinite(metadataAmountCents) &&
    metadataAmountCents === session.amount_total;

  if (!amountMatches) {
    await markPaymentReview({
      eventId: event.id,
      eventType: event.type,
      placementId: extension.placement_id,
      sessionId,
      paymentId,
      customerEmail,
    });
    return;
  }

  try {
    await applyPaidExtension({
      eventId: event.id,
      eventType: event.type,
      extensionId,
      sessionId,
      paymentId,
      customerEmail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message.includes("placement_overlap")) {
      await markPaymentReview({
        eventId: event.id,
        eventType: event.type,
        placementId: extension.placement_id,
        sessionId,
        paymentId,
        customerEmail,
      });
      return;
    }
    throw error;
  }
}

async function processCheckoutCompleted(event: Stripe.Event, session: Stripe.Checkout.Session) {
  if (session.metadata?.kind === "extension" || extensionIdFromSession(session)) {
    await processExtensionCompleted(event, session);
    return;
  }

  if (session.payment_status !== "paid") return;

  const placementId = placementIdFromSession(session);
  if (!placementId) return;

  const placement = await getPlacementForPayment(placementId);
  if (!placement) return;

  const sessionId = session.id;
  const paymentId = paymentIntentId(session);
  const customerEmail = session.customer_details?.email ?? null;
  const metadataAmountCents = Number(session.metadata?.amount_cents);
  const amountMatches =
    session.amount_total !== null &&
    Number(placement.amount_cents) === session.amount_total &&
    Number.isFinite(metadataAmountCents) &&
    metadataAmountCents === session.amount_total;

  const details = {
    eventId: event.id,
    eventType: event.type,
    placementId,
    sessionId,
    paymentId,
    customerEmail,
  };

  if (!amountMatches) {
    await markPaymentReview(details);
    return;
  }

  try {
    await markPlacementPaid(details);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message.includes("conflicting key value violates exclusion constraint")) {
      await markPaymentReview(details);
      return;
    }
    throw error;
  }

  // The sale is already recorded, so sorting the board by bid is best effort. A
  // failure here leaves a valid board that `npm run placements:repack` can fix.
  try {
    const sorted = await repackBoard();
    if (!sorted) console.error("Board repack skipped after payment", { placementId });
  } catch (error) {
    console.error("Board repack failed after payment", {
      placementId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

async function processCheckoutExpired(event: Stripe.Event, session: Stripe.Checkout.Session) {
  const extensionId = extensionIdFromSession(session);
  if (extensionId) {
    await markExtensionEnded({
      eventId: event.id,
      eventType: event.type,
      extensionId,
      status: "expired",
    });
    return;
  }

  const placementId = placementIdFromSession(session);
  if (!placementId) return;

  const pathname = await markCheckoutEnded({
    eventId: event.id,
    eventType: event.type,
    placementId,
    status: "expired",
  });
  await deleteCreative(pathname);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Webhook is not configured.", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing Stripe signature.", { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return new Response("Invalid webhook signature.", { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await processCheckoutCompleted(event, event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.expired") {
      await processCheckoutExpired(event, event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const extensionId = extensionIdFromSession(session);
      if (extensionId) {
        await markExtensionEnded({
          eventId: event.id,
          eventType: event.type,
          extensionId,
          status: "cancelled",
        });
      } else {
        const placementId = placementIdFromSession(session);
        if (placementId) {
          const pathname = await markCheckoutEnded({
            eventId: event.id,
            eventType: event.type,
            placementId,
            status: "cancelled",
          });
          await deleteCreative(pathname);
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", {
      eventType: event.type,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return new Response("Webhook processing failed.", { status: 500 });
  }
}
