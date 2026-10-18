CREATE TYPE "public"."saved_place_kind" AS ENUM('home', 'work', 'other');--> statement-breakpoint
ALTER TYPE "public"."ledger_type" ADD VALUE 'tip_charge';--> statement-breakpoint
ALTER TYPE "public"."ledger_type" ADD VALUE 'tip_payout';--> statement-breakpoint
CREATE TABLE "ride_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender_role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ride_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_places" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "saved_place_kind" DEFAULT 'other' NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "pickup_pin" text;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "tip_agorot" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ride_messages" ADD CONSTRAINT "ride_messages_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_messages" ADD CONSTRAINT "ride_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_shares" ADD CONSTRAINT "ride_shares_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_shares" ADD CONSTRAINT "ride_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ride_messages_ride_idx" ON "ride_messages" USING btree ("ride_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ride_shares_token_idx" ON "ride_shares" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "ride_shares_ride_idx" ON "ride_shares" USING btree ("ride_id");--> statement-breakpoint
CREATE INDEX "saved_places_user_idx" ON "saved_places" USING btree ("user_id");