import { getArtboardSnapshot } from "@/db/placements";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getArtboardSnapshot(), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Artboard data load failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return Response.json({ error: "Artboard data is temporarily unavailable." }, { status: 503 });
  }
}
