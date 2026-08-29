import { recordSiteView } from "@/db/placements";

export const runtime = "nodejs";

export async function POST() {
  try {
    const stats = await recordSiteView();
    return Response.json({
      onlineCount: stats.onlineCount,
      visitorCount: stats.visitorCount,
      clickCount: stats.clickCount,
    });
  } catch (error) {
    console.error("Site view recording failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return Response.json({ error: "View could not be recorded." }, { status: 500 });
  }
}
