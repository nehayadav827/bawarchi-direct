import { pgTable, text, integer, boolean, real, jsonb, timestamp, bigserial, primaryKey, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["customer", "kitchen", "manager", "admin"] }).notNull(),
  outletId: text("outlet_id"), // staff are scoped to one outlet
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false), // DPDP: explicit, default off
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outlets = pgTable("outlets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  kind: text("kind", { enum: ["OUTLET", "CLOUD_KITCHEN"] }).notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  radiusKm: real("radius_km").notNull(),
  minPrepMinutes: integer("min_prep_minutes").notNull(),
  capacityUnits: integer("capacity_units").notNull(),
  fssai: text("fssai").notNull(),
  active: boolean("active").notNull().default(true),
});

export const menuItems = pgTable("menu_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  veg: boolean("veg").notNull(),
  spice: integer("spice").notNull().default(0),
  allergens: jsonb("allergens").$type<string[]>().notNull().default([]),
  prepMinutes: integer("prep_minutes").notNull(),
  basePaise: integer("base_paise").notNull(),
  portions: jsonb("portions").$type<{ label: string; pricePaise: number }[]>().notNull().default([]),
  addOns: jsonb("add_ons").$type<{ label: string; pricePaise: number }[]>().notNull().default([]),
  windowFrom: text("window_from"), // "HH:MM" IST, null = all day (time-based menus)
  windowTo: text("window_to"),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
});

/** Price override per city (central CMS). Falls back to base price. */
export const cityPrices = pgTable("city_prices", {
  itemId: text("item_id").notNull(),
  city: text("city").notNull(),
  pricePaise: integer("price_paise").notNull(),
}, (t) => [primaryKey({ columns: [t.itemId, t.city] })]);

/** Per-outlet availability. Missing row = available. available=false pauses the item (out of stock). */
export const outletItems = pgTable("outlet_items", {
  outletId: text("outlet_id").notNull(),
  itemId: text("item_id").notNull(),
  available: boolean("available").notNull().default(true),
}, (t) => [primaryKey({ columns: [t.outletId, t.itemId] })]);

export const coupons = pgTable("coupons", {
  code: text("code").primaryKey(),
  type: text("type", { enum: ["PERCENT", "FLAT"] }).notNull(),
  value: integer("value").notNull(),
  minOrderPaise: integer("min_order_paise"),
  maxDiscountPaise: integer("max_discount_paise"),
  active: boolean("active").notNull().default(true),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(), // WEB-<n>
  outletId: text("outlet_id").notNull(),
  customerId: text("customer_id").notNull(),
  status: text("status", { enum: ["PLACED", "PREPARING", "READY", "HANDED_OFF", "CANCELLED"] }).notNull(),
  subtotalPaise: integer("subtotal_paise").notNull(),
  discountPaise: integer("discount_paise").notNull().default(0),
  loyaltyPaise: integer("loyalty_paise").notNull().default(0),
  pointsRedeemed: integer("points_redeemed").notNull().default(0),
  pointsEarned: integer("points_earned").notNull().default(0),
  readyAt: timestamp("ready_at", { withTimezone: true }), // when the kitchen marked it ready: actual prep time
  totalPaise: integer("total_paise").notNull(),
  gstPaise: integer("gst_paise").notNull(),
  couponCode: text("coupon_code"),
  paymentMethod: text("payment_method", { enum: ["UPI", "CARD"] }).notNull(),
  paymentRef: text("payment_ref").notNull(),
  placedAt: timestamp("placed_at", { withTimezone: true }).notNull(),
  promisedAt: timestamp("promised_at", { withTimezone: true }).notNull(),
  estimateMinutes: integer("estimate_minutes"),
  promiseSource: text("promise_source", { enum: ["model", "override", "fallback"] }).notNull(),
  alertedAt: timestamp("alerted_at", { withTimezone: true }), // set once when 10 min past promise
  cancelReason: text("cancel_reason"),
}, (t) => [index("orders_outlet_status_idx").on(t.outletId, t.status)]);

export const orderItems = pgTable("order_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: text("order_id").notNull(),
  itemId: text("item_id").notNull(),
  name: text("name").notNull(), // snapshot at order time
  portion: text("portion"),
  addOns: jsonb("add_ons").$type<string[]>().notNull().default([]),
  unitPaise: integer("unit_paise").notNull(), // snapshot, includes add-ons
  qty: integer("qty").notNull(),
  prepMinutes: integer("prep_minutes").notNull(),
}, (t) => [index("order_items_order_idx").on(t.orderId)]);

/** Outlet-scoped, monotonically increasing event log: the SSE stream replays from Last-Event-ID. */
export const orderEvents = pgTable("order_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  outletId: text("outlet_id").notNull(),
  orderId: text("order_id").notNull(),
  type: text("type", { enum: ["ORDER_PLACED", "STATUS_CHANGED", "PROMISE_UPDATED", "LATE_ALERT"] }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("order_events_outlet_idx").on(t.outletId, t.id)]);

/** Points ledger. Balance = sum of points. Earn and return are positive; redeem and reversal are negative. */
export const loyaltyLedger = pgTable("loyalty_ledger", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id").notNull(),
  orderId: text("order_id"),
  kind: text("kind", { enum: ["EARN", "REDEEM", "REVERSAL", "RETURN"] }).notNull(),
  points: integer("points").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("loyalty_user_idx").on(t.userId)]);

export const partyOrders = pgTable("party_orders", {
  id: text("id").primaryKey(), // PTY-<n>
  customerId: text("customer_id").notNull(),
  outletId: text("outlet_id").notNull(),
  eventAt: timestamp("event_at", { withTimezone: true }).notNull(),
  guests: integer("guests").notNull(),
  lines: jsonb("lines").$type<{ itemId: string; name: string; qty: number; unitPaise: number }[]>().notNull().default([]),
  notes: text("notes"),
  estimatePaise: integer("estimate_paise").notNull(), // indicative, from menu prices
  status: text("status", { enum: ["REQUESTED", "CONFIRMED", "DECLINED"] }).notNull(),
  quotedPaise: integer("quoted_paise"), // set by the catering manager on confirmation
  managerNote: text("manager_note"),
  decidedBy: text("decided_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("party_outlet_idx").on(t.outletId, t.status)]);

/** Simulated WhatsApp/SMS log (assumption A5): nothing leaves the system. */
export const notifications = pgTable("notifications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id").notNull(),
  orderId: text("order_id"),
  channel: text("channel", { enum: ["WHATSAPP", "SMS"] }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("notif_order_idx").on(t.orderId)]);

export type Role = "customer" | "kitchen" | "manager" | "admin";
