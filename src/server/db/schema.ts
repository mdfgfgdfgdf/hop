/**
 * HOP database schema (PostgreSQL dialect).
 *
 * The same schema runs on the embedded PGlite engine in development/tests and
 * on a real PostgreSQL server in production. All monetary amounts are stored
 * as integer agorot (1 ILS = 100 agorot) to avoid floating point errors.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date());

const ts = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

// ───────────────────────────── Enums ─────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "rider",
  "driver",
  "admin",
  "support",
]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "documents_required",
  "under_review",
  "approved",
  "rejected",
  "suspended",
]);

export const driverAvailabilityEnum = pgEnum("driver_availability", [
  "offline",
  "online",
  "busy",
]);

export const vehicleClassEnum = pgEnum("vehicle_class", [
  "standard",
  "xl",
  "premium",
  "accessible",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "id_card",
  "drivers_license",
  "taxi_driver_permit", // היתר להסעת נוסעים בשכר
  "taxi_license_number", // "מספר ירוק" / רישיון מונית
  "vehicle_registration",
  "insurance",
  "vehicle_photo",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "submitted",
  "approved",
  "rejected",
]);

export const legalStatusEnum = pgEnum("legal_status", [
  "approved",
  "requires_regulatory_approval",
]);

export const rideStatusEnum = pgEnum("ride_status", [
  "requested",
  "searching",
  "offered",
  "accepted",
  "driver_arriving",
  "in_progress",
  "completed",
  "cancelled",
]);

export const offerStatusEnum = pgEnum("offer_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", ["cash", "card_demo"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "not_applicable",
  "pending",
  "paid",
  "refunded",
  "partially_refunded",
]);

export const cancelledByEnum = pgEnum("cancelled_by", [
  "rider",
  "driver",
  "system",
  "admin",
]);

export const ledgerTypeEnum = pgEnum("ledger_type", [
  "rider_charge",
  "hop_commission",
  "driver_payout",
  "cancellation_fee",
  "refund",
  "adjustment",
  "processing_fee",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);
export const ticketCategoryEnum = pgEnum("ticket_category", [
  "complaint",
  "safety",
  "lost_item",
  "payment",
  "incident",
  "other",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const consentTypeEnum = pgEnum("consent_type", [
  "terms",
  "privacy",
  "location",
]);

// ───────────────────────────── Types ─────────────────────────────

export type LatLng = { lat: number; lng: number };
export type Polyline = [number, number][]; // [lat, lng]

/** Congestion along a route, as polyline point index ranges (inclusive). Free flow is omitted. */
export type TrafficLevel = "moderate" | "heavy" | "severe";
export type TrafficSpan = { from: number; to: number; level: TrafficLevel };
export type RouteTraffic = {
  source: "google" | "mapbox" | "tomtom";
  /** Duration without traffic, when the provider reports it. */
  durationNoTrafficS: number | null;
  spans: TrafficSpan[];
  /** When the traffic was measured (ISO). */
  at: string;
};

export type FareLine = {
  key: string;
  label: string;
  amountAgorot: number;
};

export type FareBreakdown = {
  currency: "ILS";
  riderTotalAgorot: number;
  hopCommissionAgorot: number;
  driverPayoutAgorot: number;
  lines: FareLine[];
  commissionPercentBp: number;
  commissionFixedAgorot: number;
  bookingFeeAgorot: number;
  discountAgorot: number;
  nightSurchargeApplied: boolean;
  serviceMultiplierBp: number;
  isDemoTariff: boolean;
  pricingConfigId: string;
};

export type RideFlag = {
  code: string;
  message: string;
  severity: "info" | "warning" | "critical";
  at: string;
};

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: [number, number][][]; // [lng, lat] rings (GeoJSON order)
};

// ───────────────────────────── Users & auth ─────────────────────────────

export const users = pgTable(
  "users",
  {
    id: id(),
    role: userRoleEnum("role").notNull().default("rider"),
    status: userStatusEnum("status").notNull().default("active"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    locale: text("locale").notNull().default("he"),
    isDemo: boolean("is_demo").notNull().default(false),
    suspendedReason: text("suspended_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
    index("users_phone_idx").on(t.phone),
    index("users_role_idx").on(t.role),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at"),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const consents = pgTable(
  "consents",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: consentTypeEnum("type").notNull(),
    version: text("version").notNull(),
    acceptedAt: createdAt(),
    ip: text("ip"),
  },
  (t) => [index("consents_user_idx").on(t.userId)],
);

// ───────────────────────────── Drivers ─────────────────────────────

export const driverProfiles = pgTable(
  "driver_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("documents_required"),
    availability: driverAvailabilityEnum("availability")
      .notNull()
      .default("offline"),
    serviceTypeIds: jsonb("service_type_ids").$type<string[]>().notNull().default([]),
    vehicleClass: vehicleClassEnum("vehicle_class").notNull().default("standard"),
    vehicleMake: text("vehicle_make"),
    vehicleModel: text("vehicle_model"),
    vehicleColor: text("vehicle_color"),
    vehiclePlate: text("vehicle_plate"),
    vehicleYear: integer("vehicle_year"),
    seats: integer("seats").notNull().default(4),
    licenseNumber: text("license_number"),
    taxiLicenseNumber: text("taxi_license_number"),
    lastLat: doublePrecision("last_lat"),
    lastLng: doublePrecision("last_lng"),
    lastHeading: doublePrecision("last_heading"),
    lastLocationAt: ts("last_location_at"),
    offersReceived: integer("offers_received").notNull().default(0),
    offersAccepted: integer("offers_accepted").notNull().default(0),
    ratingSum: integer("rating_sum").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    reviewedBy: text("reviewed_by"),
    reviewedAt: ts("reviewed_at"),
    reviewNotes: text("review_notes"),
    rejectionReason: text("rejection_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("driver_profiles_availability_idx").on(t.availability, t.verificationStatus),
  ],
);

export const driverDocuments = pgTable(
  "driver_documents",
  {
    id: id(),
    driverId: text("driver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: documentTypeEnum("type").notNull(),
    status: documentStatusEnum("status").notNull().default("submitted"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    expiresAt: ts("expires_at"),
    reviewNotes: text("review_notes"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: ts("reviewed_at"),
    uploadedAt: createdAt(),
  },
  (t) => [index("driver_documents_driver_idx").on(t.driverId)],
);

// ───────────────────────────── Catalogue & pricing ─────────────────────────────

export const serviceTypes = pgTable("service_types", {
  id: text("id").primaryKey(), // e.g. "taxi", "taxi_xl", "premium", "rideshare"
  nameHe: text("name_he").notNull(),
  descriptionHe: text("description_he").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  legalStatus: legalStatusEnum("legal_status")
    .notNull()
    .default("requires_regulatory_approval"),
  vehicleClasses: jsonb("vehicle_classes").$type<string[]>().notNull().default([]),
  priceMultiplierBp: integer("price_multiplier_bp").notNull().default(10000),
  seats: integer("seats").notNull().default(4),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: updatedAt(),
});

export const pricingConfigs = pgTable("pricing_configs", {
  id: id(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(true),
  currency: text("currency").notNull().default("ILS"),
  baseFareAgorot: integer("base_fare_agorot").notNull(),
  perKmAgorot: integer("per_km_agorot").notNull(),
  perMinuteAgorot: integer("per_minute_agorot").notNull(),
  bookingFeeAgorot: integer("booking_fee_agorot").notNull().default(0),
  minFareAgorot: integer("min_fare_agorot").notNull(),
  maxFareAgorot: integer("max_fare_agorot").notNull(),
  commissionPercentBp: integer("commission_percent_bp").notNull(), // 1500 = 15%
  commissionFixedAgorot: integer("commission_fixed_agorot").notNull().default(0),
  cancellationFeeAgorot: integer("cancellation_fee_agorot").notNull().default(0),
  freeCancelWindowSec: integer("free_cancel_window_sec").notNull().default(120),
  nightMultiplierBp: integer("night_multiplier_bp").notNull().default(10000),
  nightStart: text("night_start").notNull().default("21:00"),
  nightEnd: text("night_end").notNull().default("05:30"),
  roundingAgorot: integer("rounding_agorot").notNull().default(10),
  quoteTtlSec: integer("quote_ttl_sec").notNull().default(300),
  notes: text("notes"),
  updatedBy: text("updated_by"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const promotions = pgTable("promotions", {
  id: id(),
  code: text("code").notNull().unique(),
  type: text("type").$type<"percent" | "fixed">().notNull(),
  value: integer("value").notNull(), // bp for percent, agorot for fixed
  maxDiscountAgorot: integer("max_discount_agorot"),
  active: boolean("active").notNull().default(true),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  createdAt: createdAt(),
});

export const serviceAreas = pgTable("service_areas", {
  id: id(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  polygon: jsonb("polygon").$type<GeoJsonPolygon>().notNull(),
  createdAt: createdAt(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: text("updated_by"),
  updatedAt: updatedAt(),
});

// ───────────────────────────── Quotes & rides ─────────────────────────────

export const quotes = pgTable(
  "quotes",
  {
    id: id(),
    riderId: text("rider_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceTypeId: text("service_type_id")
      .notNull()
      .references(() => serviceTypes.id),
    pickupLat: doublePrecision("pickup_lat").notNull(),
    pickupLng: doublePrecision("pickup_lng").notNull(),
    pickupAddress: text("pickup_address").notNull(),
    dropoffLat: doublePrecision("dropoff_lat").notNull(),
    dropoffLng: doublePrecision("dropoff_lng").notNull(),
    dropoffAddress: text("dropoff_address").notNull(),
    distanceM: integer("distance_m").notNull(),
    durationS: integer("duration_s").notNull(),
    polyline: jsonb("polyline").$type<Polyline>().notNull(),
    traffic: jsonb("traffic").$type<RouteTraffic>(),
    geoProvider: text("geo_provider").notNull(),
    fare: jsonb("fare").$type<FareBreakdown>().notNull(),
    riderTotalAgorot: integer("rider_total_agorot").notNull(),
    promoCode: text("promo_code"),
    usedByRideId: text("used_by_ride_id"),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("quotes_rider_idx").on(t.riderId, t.createdAt)],
);

export const rides = pgTable(
  "rides",
  {
    id: id(),
    riderId: text("rider_id")
      .notNull()
      .references(() => users.id),
    driverId: text("driver_id").references(() => users.id),
    quoteId: text("quote_id").references(() => quotes.id),
    serviceTypeId: text("service_type_id")
      .notNull()
      .references(() => serviceTypes.id),
    status: rideStatusEnum("status").notNull().default("requested"),
    pickupLat: doublePrecision("pickup_lat").notNull(),
    pickupLng: doublePrecision("pickup_lng").notNull(),
    pickupAddress: text("pickup_address").notNull(),
    dropoffLat: doublePrecision("dropoff_lat").notNull(),
    dropoffLng: doublePrecision("dropoff_lng").notNull(),
    dropoffAddress: text("dropoff_address").notNull(),
    polyline: jsonb("polyline").$type<Polyline>().notNull(),
    traffic: jsonb("traffic").$type<RouteTraffic>(),
    estimatedDistanceM: integer("estimated_distance_m").notNull(),
    estimatedDurationS: integer("estimated_duration_s").notNull(),
    actualDistanceM: integer("actual_distance_m"),
    actualDurationS: integer("actual_duration_s"),
    quotedFare: jsonb("quoted_fare").$type<FareBreakdown>().notNull(),
    finalFare: jsonb("final_fare").$type<FareBreakdown>(),
    quotedTotalAgorot: integer("quoted_total_agorot").notNull(),
    finalTotalAgorot: integer("final_total_agorot"),
    commissionAgorot: integer("commission_agorot"),
    driverPayoutAgorot: integer("driver_payout_agorot"),
    cancellationFeeAgorot: integer("cancellation_fee_agorot").notNull().default(0),
    refundedAgorot: integer("refunded_agorot").notNull().default(0),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("cash"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
    // dispatch
    offeredDriverId: text("offered_driver_id"),
    offerExpiresAt: ts("offer_expires_at"),
    offerAttempts: integer("offer_attempts").notNull().default(0),
    excludedDriverIds: jsonb("excluded_driver_ids").$type<string[]>().notNull().default([]),
    searchExpiresAt: ts("search_expires_at"),
    // timeline
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    acceptedAt: ts("accepted_at"),
    arrivingAt: ts("arriving_at"),
    arrivedAt: ts("arrived_at"),
    startedAt: ts("started_at"),
    completedAt: ts("completed_at"),
    cancelledAt: ts("cancelled_at"),
    cancelledBy: cancelledByEnum("cancelled_by"),
    cancelReason: text("cancel_reason"),
    // ratings
    riderRating: integer("rider_rating"), // rating given BY the rider TO the driver
    driverRating: integer("driver_rating"), // rating given BY the driver TO the rider
    flags: jsonb("flags").$type<RideFlag[]>().notNull().default([]),
    adminNotes: text("admin_notes"),
    isDemo: boolean("is_demo").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("rides_rider_idx").on(t.riderId, t.createdAt),
    index("rides_driver_idx").on(t.driverId, t.createdAt),
    index("rides_status_idx").on(t.status),
    index("rides_offered_driver_idx").on(t.offeredDriverId),
  ],
);

export const rideOffers = pgTable(
  "ride_offers",
  {
    id: id(),
    rideId: text("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    driverId: text("driver_id")
      .notNull()
      .references(() => users.id),
    status: offerStatusEnum("status").notNull().default("pending"),
    attempt: integer("attempt").notNull(),
    driverDistanceM: integer("driver_distance_m").notNull(),
    driverEtaS: integer("driver_eta_s").notNull(),
    driverPayoutAgorot: integer("driver_payout_agorot").notNull(),
    expiresAt: ts("expires_at").notNull(),
    respondedAt: ts("responded_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ride_offers_ride_idx").on(t.rideId),
    index("ride_offers_driver_idx").on(t.driverId, t.status),
  ],
);

export const rideEvents = pgTable(
  "ride_events",
  {
    id: id(),
    rideId: text("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorUserId: text("actor_user_id"),
    actorRole: text("actor_role"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("ride_events_ride_idx").on(t.rideId, t.createdAt)],
);

export const rideTrackPoints = pgTable(
  "ride_track_points",
  {
    id: id(),
    rideId: text("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    heading: doublePrecision("heading"),
    speedMps: doublePrecision("speed_mps"),
    recordedAt: createdAt(),
  },
  (t) => [index("ride_track_points_ride_idx").on(t.rideId, t.recordedAt)],
);

export const ratings = pgTable(
  "ratings",
  {
    id: id(),
    rideId: text("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    fromUserId: text("from_user_id").notNull(),
    toUserId: text("to_user_id").notNull(),
    stars: integer("stars").notNull(),
    comment: text("comment"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("ratings_ride_from_unique").on(t.rideId, t.fromUserId)],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: id(),
    rideId: text("ride_id").references(() => rides.id),
    userId: text("user_id"),
    type: ledgerTypeEnum("type").notNull(),
    amountAgorot: integer("amount_agorot").notNull(),
    currency: text("currency").notNull().default("ILS"),
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ledger_ride_idx").on(t.rideId),
    index("ledger_user_idx").on(t.userId, t.createdAt),
    index("ledger_type_idx").on(t.type, t.createdAt),
  ],
);

// ───────────────────────────── Support & audit ─────────────────────────────

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: id(),
    rideId: text("ride_id").references(() => rides.id),
    openedBy: text("opened_by")
      .notNull()
      .references(() => users.id),
    category: ticketCategoryEnum("category").notNull().default("other"),
    priority: ticketPriorityEnum("priority").notNull().default("normal"),
    status: ticketStatusEnum("status").notNull().default("open"),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    assignedTo: text("assigned_to"),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tickets_status_idx").on(t.status, t.createdAt),
    index("tickets_opened_by_idx").on(t.openedBy),
  ],
);

export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: id(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    internal: boolean("internal").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("ticket_messages_ticket_idx").on(t.ticketId, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_actor_idx").on(t.actorId, t.createdAt),
    index("audit_target_idx").on(t.targetType, t.targetId),
  ],
);

// ───────────────────────────── Relations ─────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  driverProfile: one(driverProfiles, {
    fields: [users.id],
    references: [driverProfiles.userId],
  }),
  sessions: many(sessions),
  documents: many(driverDocuments),
}));

export const driverProfilesRelations = relations(driverProfiles, ({ one, many }) => ({
  user: one(users, { fields: [driverProfiles.userId], references: [users.id] }),
  documents: many(driverDocuments),
}));

export const driverDocumentsRelations = relations(driverDocuments, ({ one }) => ({
  driver: one(users, { fields: [driverDocuments.driverId], references: [users.id] }),
  profile: one(driverProfiles, {
    fields: [driverDocuments.driverId],
    references: [driverProfiles.userId],
  }),
}));

export const ridesRelations = relations(rides, ({ one, many }) => ({
  rider: one(users, { fields: [rides.riderId], references: [users.id], relationName: "rideRider" }),
  driver: one(users, { fields: [rides.driverId], references: [users.id], relationName: "rideDriver" }),
  serviceType: one(serviceTypes, { fields: [rides.serviceTypeId], references: [serviceTypes.id] }),
  quote: one(quotes, { fields: [rides.quoteId], references: [quotes.id] }),
  offers: many(rideOffers),
  events: many(rideEvents),
  ledger: many(ledgerEntries),
}));

export const rideOffersRelations = relations(rideOffers, ({ one }) => ({
  ride: one(rides, { fields: [rideOffers.rideId], references: [rides.id] }),
  driver: one(users, { fields: [rideOffers.driverId], references: [users.id] }),
}));

export const rideEventsRelations = relations(rideEvents, ({ one }) => ({
  ride: one(rides, { fields: [rideEvents.rideId], references: [rides.id] }),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  ride: one(rides, { fields: [ledgerEntries.rideId], references: [rides.id] }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  ride: one(rides, { fields: [supportTickets.rideId], references: [rides.id] }),
  opener: one(users, { fields: [supportTickets.openedBy], references: [users.id] }),
  messages: many(ticketMessages),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [ticketMessages.ticketId],
    references: [supportTickets.id],
  }),
}));

export const quotesRelations = relations(quotes, ({ one }) => ({
  rider: one(users, { fields: [quotes.riderId], references: [users.id] }),
  serviceType: one(serviceTypes, { fields: [quotes.serviceTypeId], references: [serviceTypes.id] }),
}));

// ───────────────────────────── Inferred types ─────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type DriverProfile = typeof driverProfiles.$inferSelect;
export type DriverDocument = typeof driverDocuments.$inferSelect;
export type ServiceType = typeof serviceTypes.$inferSelect;
export type PricingConfig = typeof pricingConfigs.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type Ride = typeof rides.$inferSelect;
export type RideOffer = typeof rideOffers.$inferSelect;
export type RideEvent = typeof rideEvents.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ServiceArea = typeof serviceAreas.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;

export type UserRole = User["role"];
export type RideStatus = Ride["status"];
export type VerificationStatus = DriverProfile["verificationStatus"];
export type DriverAvailability = DriverProfile["availability"];
export type VehicleClass = DriverProfile["vehicleClass"];
export type DocumentType = DriverDocument["type"];
