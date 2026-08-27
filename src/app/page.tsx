import { HomePage } from "@/components/home-page";
import { getArtboardSnapshot } from "@/db/placements";
import { emptyArtboardSnapshot } from "@/lib/artboard-data";

export const dynamic = "force-dynamic";

export default async function Page() {
  let initialSnapshot = emptyArtboardSnapshot();
  let snapshotReady = false;

  try {
    initialSnapshot = await getArtboardSnapshot();
    snapshotReady = true;
  } catch (error) {
    console.error("Home page snapshot load failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }

  return <HomePage initialSnapshot={initialSnapshot} snapshotReady={snapshotReady} />;
}
