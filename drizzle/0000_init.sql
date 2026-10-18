CREATE TYPE "public"."cancelled_by" AS ENUM('rider', 'driver', 'system', 'admin');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('terms', 'privacy', 'location');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('id_card', 'drivers_license', 'taxi_driver_permit', 'taxi_license_number', 'vehicle_registration', 'insurance', 'vehicle_photo');--> statement-breakpoint
CREATE TYPE "public"."driver_availability" AS ENUM('offline', 'online', 'busy');--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('rider_charge', 'hop_commission', 'driver_payout', 'cancellation_fee', 'refund', 'adjustment', 'processing_fee');--> statement-breakpoint
CREATE TYPE "public"."legal_status" AS ENUM('approved', 'requires_regulatory_approval');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card_demo');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('not_applicable', 'pending', 'paid', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."ride_status" AS ENUM('requested', 'searching', 'offered', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('complaint', 'safety', 'lost_item', 'payment', 'incident', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('rider', 'driver', 'admin', 'support');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."vehicle_class" AS ENUM('standard', 'xl', 'premium', 'accessible');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('documents_required', 'under_review', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "consent_type" NOT NULL,
	"version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "driver_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"driver_id" text NOT NULL,
	"type" "document_type" NOT NULL,
	"status" "document_status" DEFAULT 'submitted' NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"expires_at" timestamp with time zone,
	"review_notes" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"verification_status" "verification_status" DEFAULT 'documents_required' NOT NULL,
	"availability" "driver_availability" DEFAULT 'offline' NOT NULL,
	"service_type_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vehicle_class" "vehicle_class" DEFAULT 'standard' NOT NULL,
	"vehicle_make" text,
	"vehicle_model" text,
	"vehicle_color" text,
	"vehicle_plate" text,
	"vehicle_year" integer,
	"seats" integer DEFAULT 4 NOT NULL,
	"license_number" text,
	"taxi_license_number" text,
	"last_lat" double precision,
	"last_lng" double precision,
	"last_heading" double precision,
	"last_location_at" timestamp with time zone,
	"offers_received" integer DEFAULT 0 NOT NULL,
	"offers_accepted" integer DEFAULT 0 NOT NULL,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_id" text,
	"user_id" text,
	"type" "ledger_type" NOT NULL,
	"amount_agorot" integer NOT NULL,
	"currency" text DEFAULT 'ILS' NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT true NOT NULL,
	"currency" text DEFAULT 'ILS' NOT NULL,
	"base_fare_agorot" integer NOT NULL,
	"per_km_agorot" integer NOT NULL,
	"per_minute_agorot" integer NOT NULL,
	"booking_fee_agorot" integer DEFAULT 0 NOT NULL,
	"min_fare_agorot" integer NOT NULL,
	"max_fare_agorot" integer NOT NULL,
	"commission_percent_bp" integer NOT NULL,
	"commission_fixed_agorot" integer DEFAULT 0 NOT NULL,
	"cancellation_fee_agorot" integer DEFAULT 0 NOT NULL,
	"free_cancel_window_sec" integer DEFAULT 120 NOT NULL,
	"night_multiplier_bp" integer DEFAULT 10000 NOT NULL,
	"night_start" text DEFAULT '21:00' NOT NULL,
	"night_end" text DEFAULT '05:30' NOT NULL,
	"rounding_agorot" integer DEFAULT 10 NOT NULL,
	"quote_ttl_sec" integer DEFAULT 300 NOT NULL,
	"notes" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"value" integer NOT NULL,
	"max_discount_agorot" integer,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"rider_id" text NOT NULL,
	"service_type_id" text NOT NULL,
	"pickup_lat" double precision NOT NULL,
	"pickup_lng" double precision NOT NULL,
	"pickup_address" text NOT NULL,
	"dropoff_lat" double precision NOT NULL,
	"dropoff_lng" double precision NOT NULL,
	"dropoff_address" text NOT NULL,
	"distance_m" integer NOT NULL,
	"duration_s" integer NOT NULL,
	"polyline" jsonb NOT NULL,
	"geo_provider" text NOT NULL,
	"fare" jsonb NOT NULL,
	"rider_total_agorot" integer NOT NULL,
	"promo_code" text,
	"used_by_ride_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_id" text NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"stars" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ride_events" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_id" text NOT NULL,
	"type" text NOT NULL,
	"actor_user_id" text,
	"actor_role" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ride_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_id" text NOT NULL,
	"driver_id" text NOT NULL,
	"status" "offer_status" DEFAULT 'pending' NOT NULL,
	"attempt" integer NOT NULL,
	"driver_distance_m" integer NOT NULL,
	"driver_eta_s" integer NOT NULL,
	"driver_payout_agorot" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ride_track_points" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_id" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"heading" double precision,
	"speed_mps" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rides" (
	"id" text PRIMARY KEY NOT NULL,
	"rider_id" text NOT NULL,
	"driver_id" text,
	"quote_id" text,
	"service_type_id" text NOT NULL,
	"status" "ride_status" DEFAULT 'requested' NOT NULL,
	"pickup_lat" double precision NOT NULL,
	"pickup_lng" double precision NOT NULL,
	"pickup_address" text NOT NULL,
	"dropoff_lat" double precision NOT NULL,
	"dropoff_lng" double precision NOT NULL,
	"dropoff_address" text NOT NULL,
	"polyline" jsonb NOT NULL,
	"estimated_distance_m" integer NOT NULL,
	"estimated_duration_s" integer NOT NULL,
	"actual_distance_m" integer,
	"actual_duration_s" integer,
	"quoted_fare" jsonb NOT NULL,
	"final_fare" jsonb,
	"quoted_total_agorot" integer NOT NULL,
	"final_total_agorot" integer,
	"commission_agorot" integer,
	"driver_payout_agorot" integer,
	"cancellation_fee_agorot" integer DEFAULT 0 NOT NULL,
	"refunded_agorot" integer DEFAULT 0 NOT NULL,
	"payment_method" "payment_method" DEFAULT 'cash' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"offered_driver_id" text,
	"offer_expires_at" timestamp with time zone,
	"offer_attempts" integer DEFAULT 0 NOT NULL,
	"excluded_driver_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_expires_at" timestamp with time zone,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"arriving_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" "cancelled_by",
	"cancel_reason" text,
	"rider_rating" integer,
	"driver_rating" integer,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"admin_notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_areas" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"polygon" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name_he" text NOT NULL,
	"description_he" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"legal_status" "legal_status" DEFAULT 'requires_regulatory_approval' NOT NULL,
	"vehicle_classes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_multiplier_bp" integer DEFAULT 10000 NOT NULL,
	"seats" integer DEFAULT 4 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_id" text,
	"opened_by" text NOT NULL,
	"category" "ticket_category" DEFAULT 'other' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"assigned_to" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"role" "user_role" DEFAULT 'rider' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"locale" text DEFAULT 'he' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"suspended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rider_id_users_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_service_type_id_service_types_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_offers" ADD CONSTRAINT "ride_offers_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_offers" ADD CONSTRAINT "ride_offers_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_track_points" ADD CONSTRAINT "ride_track_points_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_rider_id_users_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_service_type_id_service_types_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "consents_user_idx" ON "consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "driver_documents_driver_idx" ON "driver_documents" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "driver_profiles_availability_idx" ON "driver_profiles" USING btree ("availability","verification_status");--> statement-breakpoint
CREATE INDEX "ledger_ride_idx" ON "ledger_entries" USING btree ("ride_id");--> statement-breakpoint
CREATE INDEX "ledger_user_idx" ON "ledger_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_type_idx" ON "ledger_entries" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "quotes_rider_idx" ON "quotes" USING btree ("rider_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_ride_from_unique" ON "ratings" USING btree ("ride_id","from_user_id");--> statement-breakpoint
CREATE INDEX "ride_events_ride_idx" ON "ride_events" USING btree ("ride_id","created_at");--> statement-breakpoint
CREATE INDEX "ride_offers_ride_idx" ON "ride_offers" USING btree ("ride_id");--> statement-breakpoint
CREATE INDEX "ride_offers_driver_idx" ON "ride_offers" USING btree ("driver_id","status");--> statement-breakpoint
CREATE INDEX "ride_track_points_ride_idx" ON "ride_track_points" USING btree ("ride_id","created_at");--> statement-breakpoint
CREATE INDEX "rides_rider_idx" ON "rides" USING btree ("rider_id","created_at");--> statement-breakpoint
CREATE INDEX "rides_driver_idx" ON "rides" USING btree ("driver_id","created_at");--> statement-breakpoint
CREATE INDEX "rides_status_idx" ON "rides" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rides_offered_driver_idx" ON "rides" USING btree ("offered_driver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "support_tickets" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "tickets_opened_by_idx" ON "support_tickets" USING btree ("opened_by");--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_idx" ON "ticket_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");