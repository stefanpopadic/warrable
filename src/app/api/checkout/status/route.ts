import { getCheckoutStatus } from "@/db/placements";

export const dynamic = "force-dynamic";

function isCheckoutSessionId(value: string) {
  return (
    value.length > 0 &&
    value.length <= 255 &&
    (value.startsWith("cks_") || value.startsWith("cs_"))
  );
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim();
  if (!sessionId || !isCheckoutSessionId(sessionId)) {
    return Response.json({ error: "Invalid checkout session." }, { status: 400 });
  }

  try {
    const placement = await getCheckoutStatus(sessionId);
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
