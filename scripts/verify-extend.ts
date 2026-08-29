import { readFileSync } from "node:fs";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * End-to-end check of the amount-only extend flow against the local database.
 * Borrows a demo placement, runs the real checkout API and settle path, asserts
 * the board stayed legal, then restores everything it touched.
 */

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const TEST_EMAIL = "extend-verify@example.com";

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function postExtend(placementId: string, email: string, cells: number) {
  const body = new FormData();
  body.set("brand", "Verify Brand");
  body.set("website", "https://example.com");
  body.set("email", email);
  body.set("creativeFit", "cover");
  body.set("cells", String(cells));
  body.set("aspect", "1");
  body.set("termsAccepted", "true");
  body.set("extendPlacementId", placementId);

  const response = await fetch(`${BASE}/api/checkout`, { method: "POST", body });
  return { status: response.status, json: (await response.json()) as Record<string, string> };
}

async function assertBoardIsLegal(sql: NeonQueryFunction<false, false>) {
  const { viewportForRaised, isRectInViewport, rectsOverlap } = await import("@/lib/auction");
  const rows = (await sql`
    SELECT id, brand_name, x, y, width_cells, height_cells, amount_cents
    FROM placements
    WHERE status = 'paid'
  `) as Array<{
    id: string;
    brand_name: string;
    x: number;
    y: number;
    width_cells: number;
    height_cells: number;
    amount_cents: number;
  }>;

  const raised = rows.reduce((total, row) => total + Number(row.amount_cents), 0);
  const viewport = viewportForRaised(raised);
  const rects = rows.map((row) => ({
    ...row,
    x: Number(row.x),
    y: Number(row.y),
    w: Number(row.width_cells),
    h: Number(row.height_cells),
  }));

  check(
    "every logo is inside the artboard",
    rects.every((rect) => isRectInViewport(rect, viewport)),
  );

  let overlaps = 0;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i], rects[j])) overlaps++;
    }
  }
  check("no logos overlap", overlaps === 0, `${overlaps} overlaps`);

  const distance = (r: (typeof rects)[number]) =>
    Math.hypot(
      r.x + r.w / 2 - (viewport.x + viewport.w / 2),
      (r.y + r.h / 2 - (viewport.y + viewport.h / 2)) * 0.72,
    );
  const leader = [...rects].sort((a, b) => Number(b.amount_cents) - Number(a.amount_cents))[0];
  const nearest = [...rects].sort((a, b) => distance(a) - distance(b))[0];
  check(
    "biggest bid sits closest to center",
    leader.id === nearest.id,
    `leader ${leader.brand_name}, nearest ${nearest.brand_name}`,
  );
}

async function main() {
  loadEnv();
  const sql = neon(process.env.DATABASE_URL!);

  const [target] = (await sql`
    SELECT id, brand_name, is_demo, customer_email, amount_cents, pixel_count,
           width_cells, height_cells
    FROM placements
    WHERE status = 'paid'
    ORDER BY amount_cents ASC
    LIMIT 1
  `) as Array<{
    id: string;
    brand_name: string;
    is_demo: boolean;
    customer_email: string | null;
    amount_cents: number;
    pixel_count: number;
    width_cells: number;
    height_cells: number;
  }>;

  if (!target) throw new Error("No paid placement to test against");
  console.log(`Borrowing ${target.brand_name} (${target.id})`);

  await sql`
    UPDATE placements
    SET is_demo = false, customer_email = ${TEST_EMAIL}
    WHERE id = ${target.id}::uuid
  `;

  try {
    const wrong = await postExtend(target.id, "someone-else@example.com", 40);
    check("wrong email is rejected", wrong.status === 403, `${wrong.status} ${wrong.json.error}`);

    const right = await postExtend(target.id, TEST_EMAIL, 40);
    check(
      "correct email starts checkout",
      right.status === 201 && Boolean(right.json.checkoutUrl),
      `${right.status} ${right.json.error ?? "ok"}`,
    );

    const [extension] = (await sql`
      SELECT id, added_cells, amount_cents, new_amount_cents, status
      FROM placement_extensions
      WHERE placement_id = ${target.id}::uuid
        AND status = 'reserved'
      ORDER BY created_at DESC
      LIMIT 1
    `) as Array<{
      id: string;
      added_cells: number;
      amount_cents: number;
      new_amount_cents: number;
      status: string;
    }>;

    check("extension row was reserved", Boolean(extension));
    if (!extension) return;

    check(
      "delta is added on top of the paid amount",
      Number(extension.new_amount_cents) ===
        Number(target.amount_cents) + Number(extension.amount_cents),
      `${target.amount_cents} + ${extension.amount_cents} = ${extension.new_amount_cents}`,
    );
    check("delta is positive", Number(extension.amount_cents) > 0);

    const [capacity] = (await sql`
      SELECT COALESCE(SUM(added_cells), 0) AS cells
      FROM placement_extensions
      WHERE status = 'reserved' AND expires_at > now()
    `) as Array<{ cells: number }>;
    check(
      "pending extension reserves capacity",
      Number(capacity.cells) >= Number(extension.added_cells),
      `${capacity.cells} cells held`,
    );

    // Settle it for real, then prove the board is still legal and still sorted.
    const { applyPaidExtension } = await import("@/db/placements");
    const eventId = `evt_verify_${Date.now()}`;
    const applied = await applyPaidExtension({
      eventId,
      eventType: "checkout.session.completed",
      extensionId: extension.id,
      sessionId: `cs_verify_${Date.now()}`,
      paymentId: null,
      customerEmail: TEST_EMAIL,
    });
    check("extension settles", applied);

    const [grown] = (await sql`
      SELECT amount_cents, width_cells, height_cells, pixel_count, status
      FROM placements
      WHERE id = ${target.id}::uuid
    `) as Array<{
      amount_cents: number;
      width_cells: number;
      height_cells: number;
      pixel_count: number;
      status: string;
    }>;

    check("placement is paid again", grown.status === "paid", grown.status);
    check(
      "amount grew by exactly the delta",
      Number(grown.amount_cents) === Number(extension.new_amount_cents),
      `${grown.amount_cents} vs ${extension.new_amount_cents}`,
    );
    check(
      "cells grew by the added amount",
      grown.width_cells * grown.height_cells ===
        target.width_cells * target.height_cells + Number(extension.added_cells),
      `${target.width_cells * target.height_cells} + ${extension.added_cells} = ${grown.width_cells * grown.height_cells}`,
    );
    check(
      "pixel_count tracks the new size",
      Number(grown.pixel_count) === grown.width_cells * grown.height_cells * 100,
      String(grown.pixel_count),
    );

    await assertBoardIsLegal(sql);

    console.log("\nCleaning up");
    await sql`DELETE FROM payment_events WHERE event_id = ${eventId}`;
    await sql`DELETE FROM placement_extensions WHERE id = ${extension.id}::uuid`;
    await sql`
      UPDATE placements
      SET amount_cents = ${target.amount_cents},
          width_cells = ${target.width_cells},
          height_cells = ${target.height_cells}
      WHERE id = ${target.id}::uuid
    `;
    const { repackBoard } = await import("@/db/placements");
    check("board repacks after rollback", await repackBoard());
    await assertBoardIsLegal(sql);
  } finally {
    await sql`
      UPDATE placements
      SET is_demo = ${target.is_demo}, customer_email = ${target.customer_email}
      WHERE id = ${target.id}::uuid
    `;
    console.log(`Restored ${target.brand_name}`);
  }
}

void main();
