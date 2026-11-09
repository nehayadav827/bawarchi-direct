CREATE TABLE "loyalty_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"order_id" text,
	"kind" text NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"order_id" text,
	"channel" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"event_at" timestamp with time zone NOT NULL,
	"guests" integer NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"estimate_paise" integer NOT NULL,
	"status" text NOT NULL,
	"quoted_paise" integer,
	"manager_note" text,
	"decided_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "loyalty_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "points_redeemed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "points_earned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ready_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "loyalty_user_idx" ON "loyalty_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notif_order_idx" ON "notifications" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "party_outlet_idx" ON "party_orders" USING btree ("outlet_id","status");