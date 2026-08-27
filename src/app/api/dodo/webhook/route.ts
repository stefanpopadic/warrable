import { del } from "@vercel/blob";
import { Webhook } from "standardwebhooks";
import {
  getPlacementForPayment,
  markCheckoutEnded,
  markCheckoutPending,
  markPaymentReview,
  markPlacementPaid,
} from "@/db/placements";

export const runtime = "nodejs";

type DodoPaymentPayload = {
  payment_id: string;
  total_amount: number;
  currency: string;
  customer?: { email?: string | null; name?: string | null };
  metadata?: Record<string, string>;
};

type DodoWebhookEnvelope = {
  type: string;
  data: DodoPaymentPayload;
};

function placementIdFromMetadata(metadata?: Record<string, string>) {
  const id = metadata?.placement_id?.trim();
  return id ? id : null;
}

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

async function processPaymentSucceeded(
  webhookId: string,
  eventType: string,
  payment: DodoPaymentPayload,
) {
  const placementId = placementIdFromMetadata(payment.metadata);
  if (!placementId) return;

  const placement = await getPlacementForPayment(placementId);
  if (!placement) return;

  const amountMatches =
    payment.currency?.toUpperCase() === "USD" &&
    Number(placement.amount_cents) === payment.total_amount;

  const sessionId = placement.checkout_session_id ?? payment.payment_id;
  const details = {
    eventId: webhookId,
    eventType,
    placementId,
    sessionId,
    paymentId: payment.payment_id,
    customerEmail: payment.customer?.email ?? null,
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
}

export async function POST(request: Request) {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!webhookKey) {
    return new Response("Webhook is not configured.", { status: 503 });
  }

  const rawBody = await request.text();
  const verifier = new Webhook(webhookKey);

  try {
    await verifier.verify(rawBody, {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    });
  } catch {
    return new Response("Invalid webhook signature.", { status: 401 });
  }

  const event = JSON.parse(rawBody) as DodoWebhookEnvelope;
  const webhookId = request.headers.get("webhook-id") ?? event.type;

  try {
    if (event.type === "payment.succeeded") {
      await processPaymentSucceeded(webhookId, event.type, event.data);
    } else if (event.type === "payment.processing") {
      const placementId = placementIdFromMetadata(event.data.metadata);
      if (placementId) {
        const placement = await getPlacementForPayment(placementId);
        await markCheckoutPending({
          eventId: webhookId,
          eventType: event.type,
          placementId,
          sessionId: placement?.checkout_session_id ?? event.data.payment_id,
        });
      }
    } else if (event.type === "payment.failed" || event.type === "payment.cancelled") {
      const placementId = placementIdFromMetadata(event.data.metadata);
      if (placementId) {
        const pathname = await markCheckoutEnded({
          eventId: webhookId,
          eventType: event.type,
          placementId,
          status: "cancelled",
        });
        await deleteCreative(pathname);
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Dodo webhook processing failed", {
      eventType: event.type,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return new Response("Webhook processing failed.", { status: 500 });
  }
}
