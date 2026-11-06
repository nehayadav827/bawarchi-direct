CREATE TABLE "city_prices" (
	"item_id" text NOT NULL,
	"city" text NOT NULL,
	"price_paise" integer NOT NULL,
	CONSTRAINT "city_prices_item_id_city_pk" PRIMARY KEY("item_id","city")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"code" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"value" integer NOT NULL,
	"min_order_paise" integer,
	"max_discount_paise" integer,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"veg" boolean NOT NULL,
	"spice" integer DEFAULT 0 NOT NULL,
	"allergens" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prep_minutes" integer NOT NULL,
	"base_paise" integer NOT NULL,
	"portions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"add_ons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"window_from" text,
	"window_to" text,
	"image_url" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"order_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"item_id" text NOT NULL,
	"name" text NOT NULL,
	"portion" text,
	"add_ons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unit_paise" integer NOT NULL,
	"qty" integer NOT NULL,
	"prep_minutes" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"status" text NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"gst_paise" integer NOT NULL,
	"coupon_code" text,
	"payment_method" text NOT NULL,
	"payment_ref" text NOT NULL,
	"placed_at" timestamp with time zone NOT NULL,
	"promised_at" timestamp with time zone NOT NULL,
	"estimate_minutes" integer,
	"promise_source" text NOT NULL,
	"alerted_at" timestamp with time zone,
	"cancel_reason" text
);
--> statement-breakpoint
CREATE TABLE "outlet_items" (
	"outlet_id" text NOT NULL,
	"item_id" text NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	CONSTRAINT "outlet_items_outlet_id_item_id_pk" PRIMARY KEY("outlet_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"kind" text NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"radius_km" real NOT NULL,
	"min_prep_minutes" integer NOT NULL,
	"capacity_units" integer NOT NULL,
	"fssai" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"outlet_id" text,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "order_events_outlet_idx" ON "order_events" USING btree ("outlet_id","id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_outlet_status_idx" ON "orders" USING btree ("outlet_id","status");