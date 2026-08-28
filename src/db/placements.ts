import "server-only";

import { getSql } from "@/db";
import {
  AUCTION_END,
  getMilestoneState,
  getPricingTier,
  RESERVATION_MINUTES,
  viewportForRaised,
  type Rect,
} from "@/lib/auction";
import { faviconUrlForWebsite } from "@/lib/artboard";
import type { ArtboardSnapshot } from "@/lib/artboard-data";
import { isPlacementId } from "@/lib/checkout";

type ReservationRow = {
  id: string;
  amount_cents: number;
  pixel_count: number;
  reservation_expires_at: string;
};

type PlacementPaymentRow = {
  id: string;
  amount_cents: number;
  status: "reserved" | "paid" | "expired" | "cancelled" | "payment_review";
  checkout_session_id: string | null;
  creative_pathname: string | null;
};

type PaidRow = {
  id: string;
  brand_name: string;
  website_url: string;
  creative_url: string | null;
  creative_fit: "contain" | "cover";
  x: number;
  y: number;
  width_cells: number;
  height_cells: number;
  amount_cents: number;
  pixel_count: number;
  is_demo: boolean;
  link_clicks: number;
};

type ReservedRow = {
  id: string;
  x: number;
  y: number;
  width_cells: number;
  height_cells: number;
};

function asRows<T>(result: unknown) {
  return result as T[];
}

/** Total paid revenue in cents. Cheap enough to call on the checkout path. */
export async function getRaisedCents() {
  const sql = getSql();
  const rows = asRows<{ raised_cents: string | number }>(await sql`
    SELECT COALESCE(SUM(amount_cents), 0)::bigint AS raised_cents
    FROM placements
    WHERE status = 'paid'
  `);
  return Number(rows[0]?.raised_cents ?? 0);
}

/** Unlocked area of the world grid for the milestone the auction is currently on. */
export async function getCurrentViewport() {
  return viewportForRaised(await getRaisedCents());
}

export async function reservePlacement(input: {
  brandName: string;
  websiteUrl: string;
  creativeFit: "contain" | "cover";
  rect: Rect;
  requesterHash: string;
}) {
  const sql = getSql();
  const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60_000);
  const rows = (await sql`
    SELECT id, amount_cents, pixel_count, reservation_expires_at
    FROM reserve_placement(
      ${input.brandName},
      ${input.websiteUrl},
      ${input.creativeFit},
      ${input.rect.x},
      ${input.rect.y},
      ${input.rect.w},
      ${input.rect.h},
      ${input.requesterHash},
      ${expiresAt.toISOString()}::timestamptz
    )
  `) as ReservationRow[];

  if (!rows[0]) throw new Error("reservation_failed");
  return rows[0];
}

export async function attachCreative(
  placementId: string,
  creative: { url: string; pathname: string; mimeType: string },
) {
  const sql = getSql();
  const rows = asRows<{ id: string }>(await sql`
    UPDATE placements
    SET
      creative_url = ${creative.url},
      creative_pathname = ${creative.pathname},
      mime_type = ${creative.mimeType}
    WHERE id = ${placementId}::uuid
      AND status = 'reserved'
    RETURNING id
  `);

  if (!rows[0]) throw new Error("reservation_not_active");
}

export async function attachCheckoutSession(
  placementId: string,
  sessionId: string,
  expiresAt: Date,
) {
  const sql = getSql();
  const rows = asRows<{ id: string }>(await sql`
    UPDATE placements
    SET
      checkout_session_id = ${sessionId},
      reservation_expires_at = ${expiresAt.toISOString()}::timestamptz
    WHERE id = ${placementId}::uuid
      AND status = 'reserved'
    RETURNING id
  `);

  if (!rows[0]) throw new Error("reservation_not_active");
}

export async function releasePlacement(placementId: string) {
  const sql = getSql();
  const rows = asRows<{ creative_pathname: string | null }>(await sql`
    UPDATE placements
    SET status = 'cancelled'
    WHERE id = ${placementId}::uuid
      AND status = 'reserved'
    RETURNING creative_pathname
  `);

  return (rows[0]?.creative_pathname as string | null | undefined) ?? null;
}

export async function getPlacementForPayment(placementId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, amount_cents, status, checkout_session_id, creative_pathname
    FROM placements
    WHERE id = ${placementId}::uuid
    LIMIT 1
  `) as PlacementPaymentRow[];
  return rows[0] ?? null;
}

export async function markCheckoutPending(input: {
  eventId: string;
  eventType: string;
  placementId: string;
  sessionId: string;
}) {
  const sql = getSql();
  await sql`
    WITH incoming_event AS (
      INSERT INTO payment_events (event_id, event_type)
      VALUES (${input.eventId}, ${input.eventType})
      ON CONFLICT DO NOTHING
      RETURNING event_id
    )
    UPDATE placements
    SET
      checkout_session_id = ${input.sessionId},
      reservation_expires_at = GREATEST(
        reservation_expires_at,
        now() + interval '7 days'
      )
    WHERE id = ${input.placementId}::uuid
      AND status = 'reserved'
      AND EXISTS (SELECT 1 FROM incoming_event)
  `;
}

export async function markPlacementPaid(input: {
  eventId: string;
  eventType: string;
  placementId: string;
  sessionId: string;
  paymentId: string | null;
  customerEmail: string | null;
}) {
  const sql = getSql();
  const rows = asRows<{ id: string }>(await sql`
    WITH incoming_event AS (
      INSERT INTO payment_events (event_id, event_type)
      VALUES (${input.eventId}, ${input.eventType})
      ON CONFLICT DO NOTHING
      RETURNING event_id
    )
    UPDATE placements
    SET
      status = 'paid',
      checkout_session_id = ${input.sessionId},
      payment_id = ${input.paymentId},
      customer_email = ${input.customerEmail},
      paid_at = COALESCE(paid_at, now())
    WHERE id = ${input.placementId}::uuid
      AND status IN ('reserved', 'expired', 'paid')
      AND EXISTS (SELECT 1 FROM incoming_event)
    RETURNING id
  `);

  return Boolean(rows[0]);
}

export async function markPaymentReview(input: {
  eventId: string;
  eventType: string;
  placementId: string;
  sessionId: string;
  paymentId: string | null;
  customerEmail: string | null;
}) {
  const sql = getSql();
  await sql`
    WITH incoming_event AS (
      INSERT INTO payment_events (event_id, event_type)
      VALUES (${input.eventId}, ${input.eventType})
      ON CONFLICT DO NOTHING
      RETURNING event_id
    )
    UPDATE placements
    SET
      status = 'payment_review',
      checkout_session_id = ${input.sessionId},
      payment_id = ${input.paymentId},
      customer_email = ${input.customerEmail}
    WHERE id = ${input.placementId}::uuid
      AND EXISTS (SELECT 1 FROM incoming_event)
  `;
}

export async function markCheckoutEnded(input: {
  eventId: string;
  eventType: string;
  placementId: string;
  status: "expired" | "cancelled";
}) {
  const sql = getSql();
  const rows = asRows<{ creative_pathname: string | null }>(await sql`
    WITH incoming_event AS (
      INSERT INTO payment_events (event_id, event_type)
      VALUES (${input.eventId}, ${input.eventType})
      ON CONFLICT DO NOTHING
      RETURNING event_id
    )
    UPDATE placements
    SET status = ${input.status}::placement_status
    WHERE id = ${input.placementId}::uuid
      AND status = 'reserved'
      AND EXISTS (SELECT 1 FROM incoming_event)
    RETURNING creative_pathname
  `);

  return (rows[0]?.creative_pathname as string | null | undefined) ?? null;
}

export async function getPlacementCheckoutStatus(reference: string) {
  const sql = getSql();
  const rows = isPlacementId(reference)
    ? ((await sql`
        SELECT
          id,
          brand_name,
          website_url,
          creative_url,
          status,
          amount_cents,
          pixel_count,
          paid_at
        FROM placements
        WHERE id = ${reference}::uuid
           OR checkout_session_id = ${reference}
           OR payment_id = ${reference}
        LIMIT 1
      `) as Record<string, unknown>[])
    : ((await sql`
        SELECT
          id,
          brand_name,
          website_url,
          creative_url,
          status,
          amount_cents,
          pixel_count,
          paid_at
        FROM placements
        WHERE checkout_session_id = ${reference}
           OR payment_id = ${reference}
        LIMIT 1
      `) as Record<string, unknown>[]);

  return rows[0] ?? null;
}

export async function recordPlacementLinkClick(placementId: string) {
  if (!isPlacementId(placementId)) return false;
  const sql = getSql();
  const rows = asRows<{ id: string }>(await sql`
    UPDATE placements
    SET link_clicks = link_clicks + 1
    WHERE id = ${placementId}::uuid
      AND status = 'paid'
    RETURNING id
  `);
  return Boolean(rows[0]);
}

export async function getSiteStats() {
  const sql = getSql();
  const rows = asRows<{ visitor_count: number; online_count: number }>(await sql`
    SELECT visitor_count, online_count
    FROM site_stats
    WHERE id = 'default'
    LIMIT 1
  `);
  const row = rows[0];
  const placeholderOnline = Number(process.env.SITE_STATS_ONLINE_PLACEHOLDER ?? 0);
  return {
    visitorCount: Number(row?.visitor_count ?? 0),
    onlineCount: placeholderOnline > 0 ? placeholderOnline : Number(row?.online_count ?? 0),
  };
}

export async function recordSiteView() {
  const sql = getSql();
  const rows = asRows<{ visitor_count: number; online_count: number }>(await sql`
    UPDATE site_stats
    SET
      visitor_count = visitor_count + 1,
      updated_at = now()
    WHERE id = 'default'
    RETURNING visitor_count, online_count
  `);
  return getSiteStatsFromRow(rows[0]);
}

function getSiteStatsFromRow(row?: { visitor_count: number; online_count: number }) {
  const placeholderOnline = Number(process.env.SITE_STATS_ONLINE_PLACEHOLDER ?? 0);
  return {
    visitorCount: Number(row?.visitor_count ?? 0),
    onlineCount: placeholderOnline > 0 ? placeholderOnline : Number(row?.online_count ?? 0),
  };
}

export async function getArtboardSnapshot(): Promise<ArtboardSnapshot> {
  const sql = getSql();
  const [paidRows, reservedRows] = await Promise.all([
    sql`
      SELECT
        id,
        brand_name,
        website_url,
        creative_url,
        creative_fit,
        x,
        y,
        width_cells,
        height_cells,
        amount_cents,
        pixel_count,
        is_demo,
        link_clicks
      FROM placements
      WHERE status = 'paid'
        AND creative_url IS NOT NULL
      ORDER BY amount_cents DESC, paid_at ASC, created_at ASC
    `,
    sql`
      SELECT id, x, y, width_cells, height_cells
      FROM placements
      WHERE status = 'reserved'
        AND reservation_expires_at > now()
    `,
  ]);

  const paid = paidRows as PaidRow[];
  const reserved = reservedRows as ReservedRow[];
  const placements = paid.map((row) => ({
    id: row.id,
    brand: row.brand_name,
    url: row.website_url,
    creative: row.creative_url!,
    creativeFit: row.creative_fit,
    x: Number(row.x),
    y: Number(row.y),
    w: Number(row.width_cells),
    h: Number(row.height_cells),
    bidCents: Number(row.amount_cents),
    pixels: Number(row.pixel_count),
    isDemo: row.is_demo,
  }));
  const raisedCents = placements.reduce((total, placement) => total + placement.bidCents, 0);
  const pixelsSold = placements.reduce((total, placement) => total + placement.pixels, 0);
  const pricing = getPricingTier(pixelsSold);
  const milestone = getMilestoneState(raisedCents);

  return {
    placements,
    occupied: [
      ...placements.map((placement) => ({
        id: placement.id,
        x: placement.x,
        y: placement.y,
        w: placement.w,
        h: placement.h,
        reserved: false,
      })),
      ...reserved.map((row) => ({
        id: row.id,
        x: Number(row.x),
        y: Number(row.y),
        w: Number(row.width_cells),
        h: Number(row.height_cells),
        reserved: true,
      })),
    ],
    stats: {
      raisedCents,
      pixelsSold,
      pixelsTotal: milestone.capacityPixels,
      currentPriceCents: pricing.currentPriceCents,
      nextPriceCents: pricing.nextPriceCents,
      pixelsUntilNextTier: pricing.pixelsUntilNextTier,
    },
    milestone,
    leaderboard: placements.map((placement, index) => ({
      rank: index + 1,
      id: placement.id,
      brand: placement.brand,
      url: placement.url,
      logo: faviconUrlForWebsite(placement.url),
      creative: placement.creative,
      bidCents: placement.bidCents,
      pixels: placement.pixels,
      linkClicks: Number(paid[index]?.link_clicks ?? 0),
    })),
    auctionClosed: Date.now() >= AUCTION_END,
    auctionEnd: new Date(AUCTION_END).toISOString(),
  };
}
