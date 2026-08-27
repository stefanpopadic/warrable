import { getPlacementCheckoutStatus } from "@/db/placements";
import { isCheckoutReference } from "@/lib/checkout";

export const dynamic = "force-dynamic";

function readReference(request: Request) {
  const params = new URL(request.url).searchParams;
  const placementId = params.get("placement_id")?.trim();
  const sessionId = params.get("session_id")?.trim();
  const paymentId = params.get("payment_id")?.trim();
  const ref = params.get("ref")?.trim();
  return placementId ?? sessionId ?? paymentId ?? ref ?? "";
}

export async function GET(request: Request) {
  const reference = readReference(request);
  if (!isCheckoutReference(reference)) {
    return Response.json({ error: "Invalid checkout reference." }, { status: 400 });
  }

  try {
    const placement = await getPlacementCheckoutStatus(reference);
    if (!placement) {
      return Response.json({ error: "Placement not found." }, { status: 404 });
    }

    return Response.json(
      {
        id: placement.id,
        brand: placement.brand_name,
        website: placement.website_url,
        creative: placement.creative_url,
        status: placement.status,
        amountCents: Number(placement.amount_cents),
        pixels: Number(placement.pixel_count),
        paidAt: placement.paid_at,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Checkout status lookup failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return Response.json({ error: "Status is temporarily unavailable." }, { status: 503 });
  }
}
