import "server-only";

import { getSql } from "@/db";
import {
  AUCTION_END,
  amountCentsForPixels,
  CELL_PX,
  getMilestoneState,
  getPricingTier,
  RESERVATION_MINUTES,
  viewportForRaised,
  type Rect,
} from "@/lib/auction";
import {
  findFreeRect,
  packBoard,
  quotePurchase,
  type LayoutItem,
  type PlacedItem,
} from "@/lib/layout";
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

/**
 * Size a fresh buy and find it a holding rect. Nobody picks coordinates: this is
 * only somewhere legal to park the reservation until the payment settles and the
 * packer sorts the whole board by bid.
 */
export async function planNewPlacement(input: { cells: number; aspect: number }) {
  const state = await loadBoardState();
  const usedCells =
    state.paid.reduce((total, row) => total + row.w * row.h, 0) +
    state.reserved.reduce((total, rect) => total + rect.w * rect.h, 0) +
    state.pendingCells;

  // Price the requested cells first so we know which milestone this purchase unlocks.
  const budgetCents = amountCentsForPixels(
    Math.max(1, input.cells) * CELL_PX * CELL_PX,
    state.pixelsSold,
  );
  const quote = quotePurchase({
    budgetCents,
    pixelsSold: state.pixelsSold,
    raisedCents: state.raisedCents,
    usedCells,
    aspect: input.aspect,
    minAddedCells: 1,
  });
  const dims = quote.dims;
  if (dims.w * dims.h < 1) throw new Error("not_enough_space");

  const rect = findFreeRect(dims.w, dims.h, [
    ...state.paid.map((row) => row.rect),
    ...state.reserved,
  ], quote.viewport);
  if (!rect) throw new Error("not_enough_space");

  // The board must still lay out once this becomes paid, or the buyer would pay
  // for space that cannot be arranged. Pack on the viewport this charge unlocks.
  const amountCents = quote.chargeCents;
  const feasible = packBoard(
    [
      ...state.paid.map(({ id, w, h, bidCents, tieBreak }) => ({ id, w, h, bidCents, tieBreak })),
      { id: "pending", w: dims.w, h: dims.h, bidCents: amountCents, tieBreak: "9999" },
    ],
    quote.viewport,
    { blocked: state.reserved },
  );
  if (!feasible) throw new Error("not_enough_space");

  return { rect, amountCents };
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

/** Advisory lock so two settling payments never repack the board at once. */
const BOARD_LOCK_KEY = 918_273_645;

export type BoardState = {
  paid: Array<LayoutItem & { pixelCount: number; rect: Rect }>;
  reserved: Rect[];
  /** Cells promised to pending extensions, which hold no rect of their own. */
  pendingCells: number;
  raisedCents: number;
  pixelsSold: number;
  viewport: Rect;
};

/** Everything the packer needs to lay out the live board. */
async function loadBoardState(): Promise<BoardState> {
  const sql = getSql();
  const [paidRows, reservedRows, pendingRows] = await Promise.all([
    sql`
      SELECT
        id,
        x,
        y,
        width_cells,
        height_cells,
        amount_cents,
        pixel_count,
        COALESCE(paid_at, created_at) AS sort_at
      FROM placements
      WHERE status = 'paid'
    `,
    sql`
      SELECT x, y, width_cells, height_cells
      FROM placements
      WHERE status = 'reserved'
        AND reservation_expires_at > now()
    `,
    sql`
      SELECT COALESCE(SUM(added_cells), 0) AS cells
      FROM placement_extensions
      WHERE status = 'reserved'
        AND expires_at > now()
    `,
  ]);

  const paid = asRows<{
    id: string;
    x: number;
    y: number;
    width_cells: number;
    height_cells: number;
    amount_cents: number;
    pixel_count: number;
    sort_at: string;
  }>(paidRows).map((row) => ({
    id: row.id,
    w: Number(row.width_cells),
    h: Number(row.height_cells),
    bidCents: Number(row.amount_cents),
    pixelCount: Number(row.pixel_count),
    tieBreak: new Date(row.sort_at).toISOString(),
    rect: {
      x: Number(row.x),
      y: Number(row.y),
      w: Number(row.width_cells),
      h: Number(row.height_cells),
    },
  }));

  const raisedCents = paid.reduce((total, row) => total + row.bidCents, 0);
  const pixelsSold = paid.reduce((total, row) => total + row.pixelCount, 0);

  return {
    paid,
    reserved: asRows<ReservedRow>(reservedRows).map((row) => ({
      x: Number(row.x),
      y: Number(row.y),
      w: Number(row.width_cells),
      h: Number(row.height_cells),
    })),
    pendingCells: Number(asRows<{ cells: number }>(pendingRows)[0]?.cells ?? 0),
    raisedCents,
    pixelsSold,
    viewport: viewportForRaised(raisedCents),
  };
}

export type ExtensionPlan = {
  placementId: string;
  oldCells: number;
  newWidth: number;
  newHeight: number;
  addedCells: number;
  deltaCents: number;
  newAmountCents: number;
  packed: PlacedItem[];
};

/**
 * Work out the grown size, its delta price, and the resulting board layout.
 * Returns null when the board cannot hold the growth.
 */
function planExtension(
  state: BoardState,
  placementId: string,
  paidAmountCents: number,
  requestedCells: number,
): ExtensionPlan | null {
  const current = state.paid.find((row) => row.id === placementId);
  if (!current) return null;

  const oldCells = current.w * current.h;
  const aspect = current.w / current.h;
  const usedCells =
    state.paid.reduce((total, row) => total + row.w * row.h, 0) +
    state.reserved.reduce((total, rect) => total + rect.w * rect.h, 0) +
    state.pendingCells;

  const budgetCents = amountCentsForPixels(
    Math.max(1, requestedCells) * CELL_PX * CELL_PX,
    state.pixelsSold,
  );
  const quote = quotePurchase({
    budgetCents,
    pixelsSold: state.pixelsSold,
    raisedCents: state.raisedCents,
    usedCells,
    aspect,
    minAddedCells: 1,
    baseCells: oldCells,
    baseBidCents: paidAmountCents,
  });
  if (quote.addedCells < 1) return null;

  const items = state.paid.map((row) =>
    row.id === placementId
      ? {
          id: row.id,
          w: quote.dims.w,
          h: quote.dims.h,
          bidCents: quote.totalCents,
          tieBreak: row.tieBreak,
        }
      : { id: row.id, w: row.w, h: row.h, bidCents: row.bidCents, tieBreak: row.tieBreak },
  );

  const packed = packBoard(items, quote.viewport, { blocked: state.reserved });
  if (!packed) return null;

  return {
    placementId,
    oldCells,
    newWidth: quote.dims.w,
    newHeight: quote.dims.h,
    addedCells: quote.addedCells,
    deltaCents: quote.chargeCents,
    newAmountCents: quote.totalCents,
    packed,
  };
}

export async function createPlacementExtension(input: {
  placementId: string;
  email: string;
  addedCells: number;
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

  const requestedCells = Math.max(1, Math.round(input.addedCells));
  const state = await loadBoardState();

  const plan = planExtension(
    state,
    input.placementId,
    Number(placement.amount_cents),
    requestedCells,
  );
  if (!plan) throw new Error("not_enough_space");

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
    added_cells: number;
    expires_at: string;
  }>(await sql`
    INSERT INTO placement_extensions (
      placement_id,
      email,
      added_cells,
      amount_cents,
      new_amount_cents,
      requester_hash,
      expires_at
    )
    VALUES (
      ${input.placementId}::uuid,
      ${email},
      ${plan.addedCells},
      ${plan.deltaCents},
      ${plan.newAmountCents},
      ${input.requesterHash},
      ${expiresAt.toISOString()}::timestamptz
    )
    RETURNING id, amount_cents, new_amount_cents, added_cells, expires_at
  `);

  if (!rows[0]) throw new Error("extension_failed");

  return {
    id: rows[0].id,
    placementId: placement.id,
    brandName: placement.brand_name,
    amountCents: Number(rows[0].amount_cents),
    newAmountCents: Number(rows[0].new_amount_cents),
    addedCells: Number(rows[0].added_cells),
    addedPixels: Number(rows[0].added_cells) * CELL_PX * CELL_PX,
    newPixels: plan.newWidth * plan.newHeight * CELL_PX * CELL_PX,
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
    added_cells: number;
    status: string;
    checkout_session_id: string | null;
  }>(await sql`
    SELECT
      id,
      placement_id,
      amount_cents,
      new_amount_cents,
      added_cells,
      status,
      checkout_session_id
    FROM placement_extensions
    WHERE id = ${extensionId}::uuid
    LIMIT 1
  `);
  return rows[0] ?? null;
}

/**
 * Grow the placement and re-lay the whole board in one transaction. The overlap
 * constraint is immediate, so every paid row parks in `payment_review` while the
 * coordinates move and only flips back once the new layout is fully written.
 */
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

  const state = await loadBoardState();
  const current = state.paid.find((row) => row.id === extension.placement_id);
  if (!current) throw new Error("placement_not_found");

  const plan = planExtension(
    state,
    extension.placement_id,
    current.bidCents,
    Number(extension.added_cells),
  );
  if (!plan) throw new Error("placement_overlap");

  const paidIds = state.paid.map((row) => row.id);
  const results = await sql.transaction((tx) => [
    tx`SELECT pg_advisory_xact_lock(${BOARD_LOCK_KEY})`,
    tx`
      INSERT INTO payment_events (event_id, event_type)
      VALUES (${input.eventId}, ${input.eventType})
      ON CONFLICT DO NOTHING
    `,
    tx`
      UPDATE placements
      SET status = 'payment_review'
      WHERE id::text = ANY(${paidIds})
        AND status = 'paid'
    `,
    tx`
      UPDATE placement_extensions
      SET
        status = 'paid',
        checkout_session_id = ${input.sessionId},
        paid_at = COALESCE(paid_at, now()),
        updated_at = now()
      WHERE id = ${input.extensionId}::uuid
        AND status = 'reserved'
      RETURNING id
    `,
    tx`
      UPDATE placements
      SET
        width_cells = ${plan.newWidth},
        height_cells = ${plan.newHeight},
        amount_cents = ${plan.newAmountCents},
        payment_id = COALESCE(payment_id, ${input.paymentId}),
        customer_email = COALESCE(customer_email, ${input.customerEmail}),
        updated_at = now()
      WHERE id = ${extension.placement_id}::uuid
        AND status = 'payment_review'
    `,
    ...plan.packed.map(
      (row) => tx`
        UPDATE placements
        SET x = ${row.x}, y = ${row.y}
        WHERE id = ${row.id}::uuid
          AND status = 'payment_review'
      `,
    ),
    tx`
      UPDATE placements
      SET status = 'paid'
      WHERE id::text = ANY(${paidIds})
        AND status = 'payment_review'
    `,
  ]);

  return asRows<{ id: string }>(results[3]).length > 0;
}

/**
 * Re-lay every paid logo so the biggest bid owns the center. Best effort: a
 * failure leaves a valid board that is merely out of order, never a lost sale.
 */
export async function repackBoard(attempts = 3): Promise<boolean> {
  const sql = getSql();

  for (let attempt = 0; attempt < attempts; attempt++) {
    const state = await loadBoardState();
    if (state.paid.length === 0) return true;

    const packed = packBoard(
      state.paid.map(({ id, w, h, bidCents, tieBreak }) => ({ id, w, h, bidCents, tieBreak })),
      state.viewport,
      { blocked: state.reserved },
    );
    if (!packed) return false;

    const paidIds = state.paid.map((row) => row.id);
    try {
      await sql.transaction((tx) => [
        tx`SELECT pg_advisory_xact_lock(${BOARD_LOCK_KEY})`,
        tx`
          UPDATE placements
          SET status = 'payment_review'
          WHERE id::text = ANY(${paidIds})
            AND status = 'paid'
        `,
        ...packed.map(
          (row) => tx`
            UPDATE placements
            SET x = ${row.x}, y = ${row.y}
            WHERE id = ${row.id}::uuid
              AND status = 'payment_review'
          `,
        ),
        tx`
          UPDATE placements
          SET status = 'paid'
          WHERE id::text = ANY(${paidIds})
            AND status = 'payment_review'
        `,
      ]);
      return true;
    } catch {
      // A concurrent sale invalidated the plan. Re-read and try again.
    }
  }

  return false;
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
  const [statsResult, clickResult] = await Promise.all([
    sql`
      SELECT visitor_count, online_count
      FROM site_stats
      WHERE id = 'default'
      LIMIT 1
    `,
    sql`
      SELECT COALESCE(SUM(link_clicks), 0)::int AS click_count
      FROM placements
      WHERE status = 'paid'
    `,
  ]);
  const row = asRows<{ visitor_count: number; online_count: number }>(statsResult)[0];
  const clickCount = Number(
    asRows<{ click_count: number }>(clickResult)[0]?.click_count ?? 0,
  );
  const placeholderOnline = Number(process.env.SITE_STATS_ONLINE_PLACEHOLDER ?? 0);
  return {
    visitorCount: Number(row?.visitor_count ?? 0),
    onlineCount: placeholderOnline > 0 ? placeholderOnline : Number(row?.online_count ?? 0),
    clickCount,
  };
}

export async function recordSiteView() {
  const sql = getSql();
  await sql`
    UPDATE site_stats
    SET
      visitor_count = visitor_count + 1,
      updated_at = now()
    WHERE id = 'default'
  `;
  return getSiteStats();
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
        link_clicks,
        COALESCE(paid_at, created_at) AS sort_at
      FROM placements
      WHERE status = 'paid'
      ORDER BY amount_cents DESC, paid_at ASC, created_at ASC
    `,
    sql`
      SELECT id, x, y, width_cells, height_cells, amount_cents, created_at
      FROM placements
      WHERE status = 'reserved'
        AND reservation_expires_at > now()
    `,
    sql`
      SELECT COALESCE(SUM(added_cells), 0) AS cells
      FROM placement_extensions
      WHERE status = 'reserved'
        AND expires_at > now()
    `,
  ]);

  const paid = paidRows as Array<PaidRow & { sort_at: string }>;
  const reserved = reservedRows as Array<
    ReservedRow & { amount_cents: number; created_at: string }
  >;
  const reservedCells = Number(
    (extensionRows as Array<{ cells: number }>)[0]?.cells ?? 0,
  );

  // Every paid row owns board space, but only rows with a creative can be drawn.
  const placements = paid
    .filter((row) => row.creative_url)
    .map((row) => ({
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
  const linkClicksById = new Map(paid.map((row) => [row.id, Number(row.link_clicks ?? 0)]));
  const raisedCents = paid.reduce((total, row) => total + Number(row.amount_cents), 0);
  const pixelsSold = paid.reduce((total, row) => total + Number(row.pixel_count), 0);
  const pricing = getPricingTier(pixelsSold);
  const milestone = getMilestoneState(raisedCents);

  return {
    placements,
    occupied: [
      ...paid.map((row) => ({
        id: row.id,
        x: Number(row.x),
        y: Number(row.y),
        w: Number(row.width_cells),
        h: Number(row.height_cells),
        reserved: false,
        bidCents: Number(row.amount_cents),
        tieBreak: new Date(row.sort_at).toISOString(),
      })),
      ...reserved.map((row) => ({
        id: row.id,
        x: Number(row.x),
        y: Number(row.y),
        w: Number(row.width_cells),
        h: Number(row.height_cells),
        reserved: true,
        bidCents: Number(row.amount_cents),
        tieBreak: new Date(row.created_at).toISOString(),
      })),
    ],
    stats: {
      raisedCents,
      pixelsSold,
      pixelsTotal: milestone.capacityPixels,
      currentPriceCents: pricing.currentPriceCents,
      nextPriceCents: pricing.nextPriceCents,
      pixelsUntilNextTier: pricing.pixelsUntilNextTier,
      reservedCells,
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
      linkClicks: Number(linkClicksById.get(placement.id) ?? 0),
    })),
    auctionClosed: Date.now() >= AUCTION_END,
    auctionEnd: new Date(AUCTION_END).toISOString(),
  };
}
