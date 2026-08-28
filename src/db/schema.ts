import { sql } from "drizzle-orm";
import {
  boolean,
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const placementStatus = pgEnum("placement_status", [
  "reserved",
  "paid",
  "expired",
  "cancelled",
  "payment_review",
]);

export const placements = pgTable(
  "placements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandName: varchar("brand_name", { length: 80 }).notNull(),
    websiteUrl: text("website_url").notNull(),
    creativeUrl: text("creative_url"),
    creativePathname: text("creative_pathname"),
    creativeFit: varchar("creative_fit", { length: 10 }).notNull().default("contain"),
    mimeType: varchar("mime_type", { length: 32 }),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    widthCells: integer("width_cells").notNull(),
    heightCells: integer("height_cells").notNull(),
    pixelCount: integer("pixel_count")
      .generatedAlwaysAs(sql`width_cells * height_cells * 100`)
      .notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: placementStatus("status").notNull().default("reserved"),
    requesterHash: text("requester_hash").notNull(),
    reservationExpiresAt: timestamp("reservation_expires_at", {
      withTimezone: true,
    }).notNull(),
    checkoutSessionId: text("checkout_session_id"),
    paymentId: text("payment_id"),
    customerEmail: text("customer_email"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    linkClicks: integer("link_clicks").notNull().default(0),
  },
  (table) => [
    index("placements_status_idx").on(table.status),
    index("placements_reservation_expires_at_idx").on(table.reservationExpiresAt),
    index("placements_requester_created_at_idx").on(table.requesterHash, table.createdAt),
    uniqueIndex("placements_checkout_session_unique").on(table.checkoutSessionId),
    uniqueIndex("placements_payment_id_unique").on(table.paymentId),
  ],
);

export const paymentEvents = pgTable("payment_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteStats = pgTable("site_stats", {
  id: text("id").primaryKey(),
  visitorCount: bigint("visitor_count", { mode: "number" }).notNull().default(0),
  onlineCount: integer("online_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Placement = typeof placements.$inferSelect;
export type NewPlacement = typeof placements.$inferInsert;
