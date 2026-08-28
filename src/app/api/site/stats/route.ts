import { getSiteStats } from "@/db/placements";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getSiteStats();
    return Response.json(
      {
        onlineCount: stats.onlineCount,
        visitorCount: stats.visitorCount,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Site stats read failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return Response.json({ error: "Stats are temporarily unavailable." }, { status: 503 });
  }
}
