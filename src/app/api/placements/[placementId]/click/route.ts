import { recordPlacementLinkClick } from "@/db/placements";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ placementId: string }> },
) {
  const { placementId } = await context.params;
  try {
    const recorded = await recordPlacementLinkClick(placementId);
    if (!recorded) {
      return Response.json({ error: "Placement not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Placement click failed", {
      placementId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return Response.json({ error: "Click could not be recorded." }, { status: 500 });
  }
}
