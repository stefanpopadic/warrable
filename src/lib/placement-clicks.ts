export function recordPlacementClick(placementId: string) {
  if (typeof window === "undefined") return;
  void fetch(`/api/placements/${encodeURIComponent(placementId)}/click`, {
    method: "POST",
    keepalive: true,
  });
}
