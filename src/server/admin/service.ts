import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  auditLogs,
  driverDocuments,
  driverProfiles,
  ledgerEntries,
  pricingConfigs,
  rides,
  serviceTypes,
  supportTickets,
  users,
  type DriverProfile,
  type PricingConfig,
  type User,
} from "../db/schema";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { audit } from "../audit";
import { channels, publish } from "../realtime/bus";
import { ACTIVE_STATUSES } from "../dispatch/states";
import { loadRideContext, serializeRide } from "../dispatch/service-helpers";
import { serializeDocument, serializeDriverProfile } from "../dispatch/serialize";
import { publicUser } from "../auth/guards";
import { revokeAllSessions } from "../auth/session";
import { startOfDayIL } from "../time";

type Staff = Pick<User, "id" | "role">;

// ───────────────────────────── overview ─────────────────────────────

export async function overview() {
  const db = await getDb();
  const dayStart = startOfDayIL();
  const [[active], [today], [onlineDrivers], [pendingDrivers], [openTickets], [flagged], [usersCount]] = await Promise.all([
    db.select({ n: count() }).from(rides).where(inArray(rides.status, [...ACTIVE_STATUSES])),
    db
      .select({ n: count(), gross: sql<number>`coalesce(sum(${rides.finalTotalAgorot}), 0)`, commission: sql<number>`coalesce(sum(${rides.commissionAgorot}), 0)`, payout: sql<number>`coalesce(sum(${rides.driverPayoutAgorot}), 0)` })
      .from(rides)
      .where(and(eq(rides.status, "completed"), gte(rides.completedAt, dayStart))),
    db.select({ n: count() }).from(driverProfiles).where(inArray(driverProfiles.availability, ["online", "busy"])),
    db.select({ n: count() }).from(driverProfiles).where(eq(driverProfiles.verificationStatus, "under_review")),
    db.select({ n: count() }).from(supportTickets).where(inArray(supportTickets.status, ["open", "in_progress"])),
    db.select({ n: count() }).from(rides).where(sql`jsonb_array_length(${rides.flags}) > 0`),
    db.select({ n: count() }).from(users),
  ]);
  const [cancelledToday] = await db.select({ n: count() }).from(rides).where(and(eq(rides.status, "cancelled"), gte(rides.cancelledAt, dayStart)));
  const recent = await db.select().from(rides).orderBy(desc(rides.createdAt)).limit(10);
  const liveDrivers = await db
    .select({ id: users.id, name: users.name, availability: driverProfiles.availability, lat: driverProfiles.lastLat, lng: driverProfiles.lastLng, heading: driverProfiles.lastHeading, vehicleClass: driverProfiles.vehicleClass, at: driverProfiles.lastLocationAt })
    .from(driverProfiles)
    .innerJoin(users, eq(users.id, driverProfiles.userId))
    .where(inArray(driverProfiles.availability, ["online", "busy"]));
  const viewer = { id: "admin", role: "admin" as const };
  const recentRides = [];
  for (const r of recent) recentRides.push(serializeRide(r, await loadRideContext(db, r), viewer));
  return {
    activeRides: Number(active.n),
    completedToday: Number(today.n),
    cancelledToday: Number(cancelledToday.n),
    grossTodayAgorot: Number(today.gross),
    commissionTodayAgorot: Number(today.commission),
    payoutTodayAgorot: Number(today.payout),
    onlineDrivers: Number(onlineDrivers.n),
    pendingVerifications: Number(pendingDrivers.n),
    openTickets: Number(openTickets.n),
    flaggedRides: Number(flagged.n),
    totalUsers: Number(usersCount.n),
    recentRides,
    liveDrivers: liveDrivers.map((d) => ({ ...d, at: d.at?.toISOString() ?? null })),
  };
}

// ───────────────────────────── drivers ─────────────────────────────

export async function listDrivers(filter: { status?: DriverProfile["verificationStatus"]; q?: string; limit?: number }) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (filter.status) conds.push(eq(driverProfiles.verificationStatus, filter.status));
  if (filter.q) conds.push(or(ilike(users.name, `%${filter.q}%`), ilike(users.email, `%${filter.q}%`), ilike(driverProfiles.vehiclePlate, `%${filter.q}%`))!);
  const rows = await db
    .select({ user: users, profile: driverProfiles })
    .from(driverProfiles)
    .innerJoin(users, eq(users.id, driverProfiles.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(driverProfiles.createdAt))
    .limit(filter.limit ?? 100);
  return rows.map((r) => ({ user: publicUser(r.user), profile: serializeDriverProfile(r.profile) }));
}

export async function getDriver(id: string) {
  const db = await getDb();
  const [row] = await db.select({ user: users, profile: driverProfiles }).from(driverProfiles).innerJoin(users, eq(users.id, driverProfiles.userId)).where(eq(driverProfiles.userId, id));
  if (!row) throw notFound("נהג לא נמצא");
  const docs = await db.select().from(driverDocuments).where(eq(driverDocuments.driverId, id)).orderBy(desc(driverDocuments.uploadedAt));
  const [stats] = await db
    .select({ completed: count(), payout: sql<number>`coalesce(sum(${rides.driverPayoutAgorot}),0)` })
    .from(rides)
    .where(and(eq(rides.driverId, id), eq(rides.status, "completed")));
  const recent = await db.select().from(rides).where(eq(rides.driverId, id)).orderBy(desc(rides.createdAt)).limit(10);
  const viewer = { id: "admin", role: "admin" as const };
  const recentRides = [];
  for (const r of recent) recentRides.push(serializeRide(r, await loadRideContext(db, r), viewer));
  return {
    user: publicUser(row.user),
    profile: serializeDriverProfile(row.profile),
    documents: docs.map(serializeDocument),
    stats: { completedRides: Number(stats.completed), payoutAgorot: Number(stats.payout) },
    recentRides,
  };
}

export async function verifyDriver(staff: Staff, id: string, input: { decision: "approve" | "reject" | "suspend" | "reinstate"; reason?: string | null; notes?: string | null; ip?: string | null }) {
  const db = await getDb();
  const [p] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, id));
  if (!p) throw notFound("נהג לא נמצא");
  if (input.decision === "approve") {
    const docs = await db.select().from(driverDocuments).where(and(eq(driverDocuments.driverId, id), eq(driverDocuments.status, "approved")));
    const { REQUIRED_DOCUMENTS } = await import("../driver/service");
    const approvedTypes = new Set(docs.map((d) => d.type));
    const missing = REQUIRED_DOCUMENTS.filter((t) => !approvedTypes.has(t));
    if (missing.length) {
      throw conflict("documents_missing", "לא ניתן לאשר נהג לפני אישור כל המסמכים הנדרשים", { missing });
    }
  }
  const status: DriverProfile["verificationStatus"] =
    input.decision === "approve" ? "approved" : input.decision === "reject" ? "rejected" : input.decision === "suspend" ? "suspended" : "under_review";
  const [updated] = await db
    .update(driverProfiles)
    .set({
      verificationStatus: status,
      availability: status === "approved" ? p.availability : "offline",
      reviewedBy: staff.id,
      reviewedAt: new Date(),
      reviewNotes: input.notes ?? p.reviewNotes,
      rejectionReason: input.decision === "reject" || input.decision === "suspend" ? input.reason ?? null : null,
    })
    .where(eq(driverProfiles.userId, id))
    .returning();
  await audit({ actorId: staff.id, actorRole: staff.role, action: `driver.${input.decision}`, targetType: "driver", targetId: id, data: { reason: input.reason, notes: input.notes }, ip: input.ip });
  publish(channels.user(id), "notification", { kind: "driver.verification", status, reason: input.reason ?? null });
  publish(channels.admin, "admin.driver", { driverId: id, verificationStatus: status });
  return serializeDriverProfile(updated);
}

export async function reviewDocument(staff: Staff, driverId: string, docId: string, input: { status: "approved" | "rejected"; notes?: string | null; ip?: string | null }) {
  const db = await getDb();
  const [doc] = await db.update(driverDocuments).set({ status: input.status, reviewNotes: input.notes ?? null, reviewedBy: staff.id, reviewedAt: new Date() }).where(and(eq(driverDocuments.id, docId), eq(driverDocuments.driverId, driverId))).returning();
  if (!doc) throw notFound("מסמך לא נמצא");
  if (input.status === "rejected") {
    await db.update(driverProfiles).set({ verificationStatus: "documents_required", availability: "offline", rejectionReason: `מסמך נדחה: ${input.notes ?? ""}` }).where(and(eq(driverProfiles.userId, driverId), inArray(driverProfiles.verificationStatus, ["under_review", "documents_required"])));
  }
  await audit({ actorId: staff.id, actorRole: staff.role, action: `document.${input.status}`, targetType: "driver_document", targetId: docId, data: { driverId, notes: input.notes }, ip: input.ip });
  publish(channels.user(driverId), "notification", { kind: "driver.document", docId, status: input.status });
  return serializeDocument(doc);
}

// ───────────────────────────── users ─────────────────────────────

export async function listUsers(filter: { role?: User["role"]; q?: string; status?: User["status"]; limit?: number }) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (filter.role) conds.push(eq(users.role, filter.role));
  if (filter.status) conds.push(eq(users.status, filter.status));
  if (filter.q) conds.push(or(ilike(users.name, `%${filter.q}%`), ilike(users.email, `%${filter.q}%`), ilike(users.phone, `%${filter.q}%`))!);
  const rows = await db.select().from(users).where(conds.length ? and(...conds) : undefined).orderBy(desc(users.createdAt)).limit(filter.limit ?? 100);
  return rows.map(publicUser);
}

export async function getUser(id: string) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) throw notFound("משתמש לא נמצא");
  const [stats] = await db.select({ rides: count() }).from(rides).where(or(eq(rides.riderId, id), eq(rides.driverId, id)));
  const recent = await db.select().from(rides).where(or(eq(rides.riderId, id), eq(rides.driverId, id))).orderBy(desc(rides.createdAt)).limit(10);
  const viewer = { id: "admin", role: "admin" as const };
  const recentRides = [];
  for (const r of recent) recentRides.push(serializeRide(r, await loadRideContext(db, r), viewer));
  const [profile] = u.role === "driver" ? await db.select().from(driverProfiles).where(eq(driverProfiles.userId, id)) : [null];
  return { user: publicUser(u), suspendedReason: u.suspendedReason, stats: { rides: Number(stats.rides) }, recentRides, driverProfile: profile ? serializeDriverProfile(profile) : null };
}

export async function setUserStatus(staff: Staff, id: string, input: { status: User["status"]; reason?: string | null; ip?: string | null }) {
  if (staff.id === id) throw badRequest("self", "לא ניתן להשעות את עצמך");
  const db = await getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) throw notFound();
  if (target.role === "admin" && staff.role !== "admin") throw forbidden();
  const [u] = await db.update(users).set({ status: input.status, suspendedReason: input.status === "suspended" ? input.reason ?? null : null }).where(eq(users.id, id)).returning();
  if (input.status === "suspended") {
    await revokeAllSessions(id);
    if (target.role === "driver") await db.update(driverProfiles).set({ availability: "offline" }).where(eq(driverProfiles.userId, id));
  }
  await audit({ actorId: staff.id, actorRole: staff.role, action: `user.${input.status}`, targetType: "user", targetId: id, data: { reason: input.reason }, ip: input.ip });
  return publicUser(u);
}

export async function setUserRole(admin: Staff, id: string, role: User["role"], ip?: string | null) {
  if (admin.role !== "admin") throw forbidden();
  if (admin.id === id) throw badRequest("self", "לא ניתן לשנות את התפקיד של עצמך");
  const db = await getDb();
  const [u] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
  if (!u) throw notFound();
  if (role === "driver") await db.insert(driverProfiles).values({ userId: id }).onConflictDoNothing();
  await revokeAllSessions(id);
  await audit({ actorId: admin.id, actorRole: admin.role, action: "user.role_changed", targetType: "user", targetId: id, data: { role }, ip });
  return publicUser(u);
}

// ───────────────────────────── rides ─────────────────────────────

export async function listRides(filter: { status?: string; flagged?: boolean; q?: string; from?: Date; to?: Date; limit?: number }) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (filter.status && filter.status !== "active") conds.push(eq(rides.status, filter.status as typeof rides.status.enumValues[number]));
  if (filter.status === "active") conds.push(inArray(rides.status, [...ACTIVE_STATUSES]));
  if (filter.flagged) conds.push(sql`jsonb_array_length(${rides.flags}) > 0`);
  if (filter.from) conds.push(gte(rides.createdAt, filter.from));
  if (filter.to) conds.push(lte(rides.createdAt, filter.to));
  if (filter.q) conds.push(or(ilike(rides.pickupAddress, `%${filter.q}%`), ilike(rides.dropoffAddress, `%${filter.q}%`), eq(rides.id, filter.q))!);
  const rows = await db.select().from(rides).where(conds.length ? and(...conds) : undefined).orderBy(desc(rides.createdAt)).limit(filter.limit ?? 100);
  const viewer = { id: "admin", role: "admin" as const };
  const out = [];
  for (const r of rows) out.push(serializeRide(r, await loadRideContext(db, r), viewer));
  return out;
}

export async function adjustRide(staff: Staff, id: string, input: { refundAgorot?: number; note: string; ip?: string | null }) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [ride] = await tx.select().from(rides).where(eq(rides.id, id)).for("update");
    if (!ride) throw notFound();
    if (ride.status !== "completed" && ride.status !== "cancelled") throw conflict("not_final", "ניתן לבצע התאמות רק לנסיעות שהסתיימו");
    const refund = input.refundAgorot ?? 0;
    if (refund < 0) throw badRequest("bad_refund", "סכום החזר שלילי");
    const charged = (ride.finalTotalAgorot ?? 0) + ride.cancellationFeeAgorot;
    if (ride.refundedAgorot + refund > charged) throw badRequest("refund_exceeds", "סכום ההחזר גבוה מהסכום ששולם");
    if (refund > 0) {
      await tx.insert(ledgerEntries).values({ rideId: id, userId: ride.riderId, type: "refund", amountAgorot: -refund, note: input.note, createdBy: staff.id });
      const total = ride.refundedAgorot + refund;
      await tx
        .update(rides)
        .set({ refundedAgorot: total, paymentStatus: total >= charged ? "refunded" : "partially_refunded", adminNotes: [ride.adminNotes, input.note].filter(Boolean).join("\n") })
        .where(eq(rides.id, id));
    } else {
      await tx.update(rides).set({ adminNotes: [ride.adminNotes, input.note].filter(Boolean).join("\n") }).where(eq(rides.id, id));
    }
  });
  await audit({ actorId: staff.id, actorRole: staff.role, action: "ride.adjust", targetType: "ride", targetId: id, data: { refundAgorot: input.refundAgorot, note: input.note }, ip: input.ip });
}

// ───────────────────────────── pricing & services ─────────────────────────────

export async function getPricing() {
  const db = await getDb();
  const [active] = await db.select().from(pricingConfigs).where(eq(pricingConfigs.active, true)).orderBy(desc(pricingConfigs.updatedAt)).limit(1);
  const history = await db.select().from(pricingConfigs).orderBy(desc(pricingConfigs.createdAt)).limit(20);
  return { active: active ?? null, history };
}

export type PricingInput = Partial<Omit<PricingConfig, "id" | "createdAt" | "updatedAt" | "updatedBy" | "active">>;

/** Creates a new active tariff version (previous versions are kept for audit). */
export async function updatePricing(admin: Staff, input: PricingInput, ip?: string | null) {
  if (admin.role !== "admin") throw forbidden();
  const db = await getDb();
  const [current] = await db.select().from(pricingConfigs).where(eq(pricingConfigs.active, true)).limit(1);
  const base = current ?? ({} as PricingConfig);
  const merged = { ...base, ...input };
  if ((merged.minFareAgorot ?? 0) > (merged.maxFareAgorot ?? 0)) throw badRequest("min_gt_max", "מחיר מינימום גבוה ממחיר מקסימום");
  if ((merged.commissionPercentBp ?? 0) < 0 || (merged.commissionPercentBp ?? 0) > 5000) throw badRequest("bad_commission", "עמלה חייבת להיות בין 0% ל-50%");
  const created = await db.transaction(async (tx) => {
    await tx.update(pricingConfigs).set({ active: false }).where(eq(pricingConfigs.active, true));
    const [row] = await tx
      .insert(pricingConfigs)
      .values({
        name: input.name ?? base.name ?? "תעריף",
        active: true,
        isDemo: input.isDemo ?? base.isDemo ?? true,
        currency: "ILS",
        baseFareAgorot: merged.baseFareAgorot!,
        perKmAgorot: merged.perKmAgorot!,
        perMinuteAgorot: merged.perMinuteAgorot!,
        bookingFeeAgorot: merged.bookingFeeAgorot ?? 0,
        minFareAgorot: merged.minFareAgorot!,
        maxFareAgorot: merged.maxFareAgorot!,
        commissionPercentBp: merged.commissionPercentBp!,
        commissionFixedAgorot: merged.commissionFixedAgorot ?? 0,
        cancellationFeeAgorot: merged.cancellationFeeAgorot ?? 0,
        freeCancelWindowSec: merged.freeCancelWindowSec ?? 120,
        nightMultiplierBp: merged.nightMultiplierBp ?? 10000,
        nightStart: merged.nightStart ?? "21:00",
        nightEnd: merged.nightEnd ?? "05:30",
        roundingAgorot: merged.roundingAgorot ?? 10,
        quoteTtlSec: merged.quoteTtlSec ?? 300,
        notes: merged.notes ?? null,
        updatedBy: admin.id,
      })
      .returning();
    return row;
  });
  await audit({ actorId: admin.id, actorRole: admin.role, action: "pricing.update", targetType: "pricing_config", targetId: created.id, data: input as Record<string, unknown>, ip });
  return created;
}

export async function listServiceTypesAdmin() {
  const db = await getDb();
  return db.select().from(serviceTypes).orderBy(serviceTypes.sortOrder);
}

export async function updateServiceType(admin: Staff, id: string, patch: { enabled?: boolean; nameHe?: string; descriptionHe?: string; priceMultiplierBp?: number; vehicleClasses?: string[]; seats?: number; sortOrder?: number; legalStatus?: "approved" | "requires_regulatory_approval" }, ip?: string | null) {
  if (admin.role !== "admin") throw forbidden();
  const db = await getDb();
  const [current] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, id));
  if (!current) throw notFound();
  const legal = patch.legalStatus ?? current.legalStatus;
  if (patch.enabled && legal !== "approved") throw conflict("not_legal", "לא ניתן להפעיל שירות שטרם אושר רגולטורית");
  // Approving the legal status and enabling must be two deliberate steps.
  if (patch.enabled && patch.legalStatus === "approved" && current.legalStatus !== "approved") {
    throw conflict("not_legal", "אשרו את המעמד הרגולטורי תחילה, ולאחר מכן הפעילו את השירות בנפרד");
  }
  const [row] = await db.update(serviceTypes).set({ ...patch, enabled: legal === "approved" ? patch.enabled ?? current.enabled : false }).where(eq(serviceTypes.id, id)).returning();
  await audit({ actorId: admin.id, actorRole: admin.role, action: "service_type.update", targetType: "service_type", targetId: id, data: patch as Record<string, unknown>, ip });
  return row;
}

// ───────────────────────────── reports ─────────────────────────────

export async function report(range: { from: Date; to: Date }) {
  const db = await getDb();
  const completed = await db
    .select({ day: sql<string>`to_char(${rides.completedAt} at time zone 'Asia/Jerusalem', 'YYYY-MM-DD')`, n: count(), gross: sql<number>`coalesce(sum(${rides.finalTotalAgorot}),0)`, commission: sql<number>`coalesce(sum(${rides.commissionAgorot}),0)`, payout: sql<number>`coalesce(sum(${rides.driverPayoutAgorot}),0)`, distance: sql<number>`coalesce(sum(${rides.actualDistanceM}),0)` })
    .from(rides)
    .where(and(eq(rides.status, "completed"), gte(rides.completedAt, range.from), lte(rides.completedAt, range.to)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const [cancelled] = await db
    .select({ n: count(), fees: sql<number>`coalesce(sum(${rides.cancellationFeeAgorot}),0)` })
    .from(rides)
    .where(and(eq(rides.status, "cancelled"), gte(rides.cancelledAt, range.from), lte(rides.cancelledAt, range.to)));
  const byService = await db
    .select({ serviceTypeId: rides.serviceTypeId, n: count(), gross: sql<number>`coalesce(sum(${rides.finalTotalAgorot}),0)` })
    .from(rides)
    .where(and(eq(rides.status, "completed"), gte(rides.completedAt, range.from), lte(rides.completedAt, range.to)))
    .groupBy(rides.serviceTypeId);
  const ledger = await db
    .select({ type: ledgerEntries.type, total: sql<number>`coalesce(sum(${ledgerEntries.amountAgorot}),0)`, n: count() })
    .from(ledgerEntries)
    .where(and(gte(ledgerEntries.createdAt, range.from), lte(ledgerEntries.createdAt, range.to)))
    .groupBy(ledgerEntries.type);
  const [cfg] = await db.select({ isDemo: pricingConfigs.isDemo }).from(pricingConfigs).where(eq(pricingConfigs.active, true)).limit(1);
  const totals = completed.reduce(
    (acc, d) => ({ rides: acc.rides + Number(d.n), gross: acc.gross + Number(d.gross), commission: acc.commission + Number(d.commission), payout: acc.payout + Number(d.payout), distanceM: acc.distanceM + Number(d.distance) }),
    { rides: 0, gross: 0, commission: 0, payout: 0, distanceM: 0 },
  );
  const refunds = Number(ledger.find((l) => l.type === "refund")?.total ?? 0);
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    isDemoTariff: cfg?.isDemo ?? true,
    totals: { ...totals, cancelled: Number(cancelled.n), cancellationFeesAgorot: Number(cancelled.fees), refundsAgorot: refunds, netCommissionAgorot: totals.commission + Number(cancelled.fees) + refunds },
    byDay: completed.map((d) => ({ day: d.day, rides: Number(d.n), grossAgorot: Number(d.gross), commissionAgorot: Number(d.commission), payoutAgorot: Number(d.payout), distanceM: Number(d.distance) })),
    byService: byService.map((s) => ({ serviceTypeId: s.serviceTypeId, rides: Number(s.n), grossAgorot: Number(s.gross) })),
    ledger: ledger.map((l) => ({ type: l.type, totalAgorot: Number(l.total), entries: Number(l.n) })),
  };
}

export async function listAuditLogs(filter: { limit?: number; action?: string; actorId?: string }) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (filter.action) conds.push(ilike(auditLogs.action, `${filter.action.replace(/[\\%_]/g, "\\$&")}%`));
  if (filter.actorId) conds.push(eq(auditLogs.actorId, filter.actorId));
  const rows = await db
    .select({ log: auditLogs, actorName: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(filter.limit ?? 200);
  return rows.map((r) => ({ ...r.log, actorName: r.actorName, createdAt: r.log.createdAt.toISOString() }));
}
