import "server-only";

import { getSql } from "@/db";
import {
  AUCTION_END,
  amountCentsForPixels,
  getMilestoneState,
  getPricingTier,
  printedPixels,
  rectContains,
  rectsOverlap,
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
  email: string;
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
      ${expiresAt.toISOString()}::timestamptz,
      ${input.email}
    )
  `) as ReservationRow[];

  if (!rows[0]) throw new Error("reservation_failed");
  return rows[0];
}

type ExtendablePlacement = {
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
  customer_email: string | null;
  is_demo: boolean;
  status: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function createPlacementExtension(input: {
  placementId: string;
  email: string;
  rect: Rect;
  requesterHash: string;
}) {
  const sql = getSql();
  const email = normalizeEmail(input.email);
  const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60_000);

  await sql`
    UPDATE placement_extensions
    SET status = 'expired', updated_at = now()
    WHERE status = 'reserved'
      AND expires_at <= now()
  `;

  const placementRows = (await sql`
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
      customer_email,
      is_demo,
      status
    FROM placements
    WHERE id = ${input.placementId}::uuid
    LIMIT 1
  `) as ExtendablePlacement[];

  const placement = placementRows[0];
  if (!placement || placement.status !== "paid") {
    throw new Error("placement_not_found");
  }
  if (placement.is_demo) {
    throw new Error("demo_not_extendable");
  }
  if (!placement.customer_email) {
    throw new Error("email_not_on_file");
  }
  if (normalizeEmail(placement.customer_email) !== email) {
    throw new Error("email_mismatch");
  }

  const oldRect: Rect = {
    x: Number(placement.x),
    y: Number(placement.y),
    w: Number(placement.width_cells),
    h: Number(placement.height_cells),
  };
  if (!rectContains(input.rect, oldRect)) {
    throw new Error("must_contain_original");
  }
  if (
    input.rect.x === oldRect.x &&
    input.rect.y === oldRect.y &&
    input.rect.w === oldRect.w &&
    input.rect.h === oldRect.h
  ) {
    throw new Error("must_grow");
  }

  const viewport = await getCurrentViewport();
  if (
    input.rect.x < viewport.x ||
    input.rect.y < viewport.y ||
    input.rect.x + input.rect.w > viewport.x + viewport.w ||
    input.rect.y + input.rect.h > viewport.y + viewport.h
  ) {
    throw new Error("outside_viewport");
  }

  const blockers = asRows<{
    id: string;
    x: number;
    y: number;
    width_cells: number;
    height_cells: number;
  }>(await sql`
    SELECT id, x, y, width_cells, height_cells
    FROM placements
    WHERE status IN ('paid', 'reserved')
      AND id <> ${input.placementId}::uuid
      AND (
        status = 'paid'
        OR reservation_expires_at > now()
      )
    UNION ALL
    SELECT placement_id AS id, x, y, width_cells, height_cells
    FROM placement_extensions
    WHERE status = 'reserved'
      AND expires_at > now()
      AND placement_id <> ${input.placementId}::uuid
  `);

  for (const blocker of blockers) {
    if (
      rectsOverlap(input.rect, {
        x: Number(blocker.x),
        y: Number(blocker.y),
        w: Number(blocker.width_cells),
        h: Number(blocker.height_cells),
      })
    ) {
      throw new Error("placement_overlap");
    }
  }

  const oldPixels = Number(placement.pixel_count);
  const paidPixelsRows = asRows<{ pixels: string | number }>(await sql`
    SELECT COALESCE(SUM(pixel_count), 0)::bigint AS pixels
    FROM placements
    WHERE status = 'paid'
  `);
  const totalPaidPixels = Number(paidPixelsRows[0]?.pixels ?? 0);
  const pixelsSoldBefore = Math.max(0, totalPaidPixels - oldPixels);
  const newAmountCents = amountCentsForPixels(printedPixels(input.rect), pixelsSoldBefore);
  const paidAmountCents = Number(placement.amount_cents);
  const deltaCents = newAmountCents - paidAmountCents;
  if (deltaCents <= 0) {
    throw new Error("must_grow");
  }

  // Cancel any prior active extension for this placement, then insert.
  await sql`
    UPDATE placement_extensions
    SET status = 'cancelled', updated_at = now()
    WHERE placement_id = ${input.placementId}::uuid
      AND status = 'reserved'
  `;

  const rows = asRows<{
    id: string;
    amount_cents: number;
    new_amount_cents: number;
    expires_at: string;
  }>(await sql`
    INSERT INTO placement_extensions (
      placement_id,
      email,
      x,
      y,
      width_cells,
      height_cells,
      amount_cents,
      new_amount_cents,
      requester_hash,
      expires_at
    )
    VALUES (
      ${input.placementId}::uuid,
      ${email},
      ${input.rect.x},
      ${input.rect.y},
      ${input.rect.w},
      ${input.rect.h},
      ${deltaCents},
      ${newAmountCents},
      ${input.requesterHash},
      ${expiresAt.toISOString()}::timestamptz
    )
    RETURNING id, amount_cents, new_amount_cents, expires_at
  `);

  if (!rows[0]) throw new Error("extension_failed");

  return {
    id: rows[0].id,
    placementId: placement.id,
    brandName: placement.brand_name,
    amountCents: Number(rows[0].amount_cents),
    newAmountCents: Number(rows[0].new_amount_cents),
    pixelCount: printedPixels(input.rect),
    addedPixels: printedPixels(input.rect) - oldPixels,
    expiresAt: rows[0].expires_at,
  };
}

export async function attachExtensionCheckoutSession(
  extensionId: string,
  sessionId: string,
  expiresAt: Date,
) {
  const sql = getSql();
  const rows = asRows<{ id: string }>(await sql`
    UPDATE placement_extensions
    SET
      checkout_session_id = ${sessionId},
      expires_at = ${expiresAt.toISOString()}::timestamptz,
      updated_at = now()
    WHERE id = ${extensionId}::uuid
      AND status = 'reserved'
    RETURNING id
  `);
  if (!rows[0]) throw new Error("extension_not_active");
}

export async function releaseExtension(extensionId: string) {
  const sql = getSql();
  await sql`
    UPDATE placement_extensions
    SET status = 'cancelled', updated_at = now()
    WHERE id = ${extensionId}::uuid
      AND status = 'reserved'
  `;
}

export async function getExtensionForPayment(extensionId: string) {
  const sql = getSql();
  const rows = asRows<{
    id: string;
    placement_id: string;
    amount_cents: number;
    new_amount_cents: number;
    status: string;
    checkout_session_id: string | null;
    x: number;
    y: number;
    width_cells: number;
    height_cells: number;
  }>(await sql`
    SELECT
      id,
      placement_id,
      amount_cents,
      new_amount_cents,
      status,
      checkout_session_id,
      x,
      y,
      width_cells,
      height_cells
    FROM placement_extensions
    WHERE id = ${extensionId}::uuid
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function applyPaidExtension(input: {
  eventId: string;
  eventType: string;
  extensionId: string;
  sessionId: string;
  paymentId: string | null;
  customerEmail: string | null;
}) {
  const sql = getSql();
  const extension = await getExtensionForPayment(input.extensionId);
  if (!extension) throw new Error("extension_not_found");
  if (extension.status === "paid") return true;
  if (extension.status !== "reserved") throw new Error("extension_not_active");

  const newRect: Rect = {
    x: Number(extension.x),
    y: Number(extension.y),
    w: Number(extension.width_cells),
    h: Number(extension.height_cells),
  };

  const blockers = asRows<{
    x: number;
    y: number;
    width_cells: number;
    height_cells: number;
  }>(await sql`
    SELECT x, y, width_cells, height_cells
    FROM placements
    WHERE status IN ('paid', 'reserved')
      AND id <> ${extension.placement_id}::uuid
      AND (
        status = 'paid'
        OR reservation_expires_at > now()
      )
  `);

  for (const blocker of blockers) {
    if (
      rectsOverlap(newRect, {
        x: Number(blocker.x),
        y: Number(blocker.y),
        w: Number(blocker.width_cells),
        h: Number(blocker.height_cells),
      })
    ) {
      throw new Error("placement_overlap");
    }
  }

  const rows = asRows<{ id: string }>(await sql`
    WITH incoming_event AS (
      INSERT INTO payment_events (event_id, event_type)
      VALUES (${input.eventId}, ${input.eventType})
      ON CONFLICT DO NOTHING
      RETURNING event_id
    ),
    paid_extension AS (
      UPDATE placement_extensions
      SET
        status = 'paid',
        checkout_session_id = ${input.sessionId},
        paid_at = COALESCE(paid_at, now()),
        updated_at = now()
      WHERE id = ${input.extensionId}::uuid
        AND status = 'reserved'
        AND EXISTS (SELECT 1 FROM incoming_event)
      RETURNING placement_id, x, y, width_cells, height_cells, new_amount_cents
    )
    UPDATE placements p
    SET
      x = e.x,
      y = e.y,
      width_cells = e.width_cells,
      height_cells = e.height_cells,
      amount_cents = e.new_amount_cents,
      customer_email = COALESCE(p.customer_email, ${input.customerEmail}),
      updated_at = now()
    FROM paid_extension e
    WHERE p.id = e.placement_id
    RETURNING p.id
  `);

  return Boolean(rows[0]);
}

export async function markExtensionEnded(input: {
  eventId: string;
  eventType: string;
  extensionId: string;
  status: "expired" | "cancelled";
}) {
  const sql = getSql();
  await sql`
    WITH incoming_event AS (
      INSERT INTO payment_events (event_id, event_type)
      VALUES (${input.eventId}, ${input.eventType})
      ON CONFLICT DO NOTHING
      RETURNING event_id
    )
    UPDATE placement_extensions
    SET status = ${input.status}::placement_extension_status, updated_at = now()
    WHERE id = ${input.extensionId}::uuid
      AND status = 'reserved'
      AND EXISTS (SELECT 1 FROM incoming_event)
  `;
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
      customer_email = COALESCE(customer_email, ${input.customerEmail}),
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
      customer_email = COALESCE(customer_email, ${input.customerEmail})
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
  const [paidRows, reservedRows, extensionRows] = await Promise.all([
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
    sql`
      SELECT id, placement_id, x, y, width_cells, height_cells
      FROM placement_extensions
      WHERE status = 'reserved'
        AND expires_at > now()
    `,
  ]);

  const paid = paidRows as PaidRow[];
  const reserved = reservedRows as ReservedRow[];
  const extensions = extensionRows as Array<{
    id: string;
    placement_id: string;
    x: number;
    y: number;
    width_cells: number;
    height_cells: number;
  }>;
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
      // Pending extensions reserve their larger target rect so others cannot buy into it.
      ...extensions.map((row) => ({
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
