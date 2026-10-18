import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, type Db } from "@/server/db/client";
import { auditLogs, driverProfiles, ledgerEntries, pricingConfigs, rides, serviceTypes, type User } from "@/server/db/schema";
import {
  adjustRide,
  getDriver,
  getPricing,
  getUser,
  listAuditLogs,
  listDrivers,
  listRides,
  listUsers,
  overview,
  report,
  reviewDocument,
  setUserRole,
  setUserStatus,
  updatePricing,
  updateServiceType,
  verifyDriver,
} from "@/server/admin/service";
import { REQUIRED_DOCUMENTS } from "@/server/driver/service";
import { cancelRide, completeRide, createQuotes, respondToOffer } from "@/server/dispatch/service";
import { createSession, getUserByToken } from "@/server/auth/session";
import { getActivePricing } from "@/server/pricing/config";
import { createTicket } from "@/server/support/service";
import { AppError } from "@/server/errors";
import { freshDb, makeDriver, makeUser, profileRow, resetDispatch, rideRow, TLV } from "../helpers/db";
import { uploadAllRequired, useTempDataDir } from "../helpers/files";
import { acceptAndStart, bookRide, driveToCompletion } from "../helpers/rides";

let db: Db;
let data: ReturnType<typeof useTempDataDir>;
let admin: User;
let support: User;

beforeAll(async () => {
  data = useTempDataDir();
  db = await freshDb();
  admin = await makeUser(db, "admin");
  support = await makeUser(db, "support");
});
afterAll(async () => {
  await closeDb();
  await data.cleanup();
});
beforeEach(async () => {
  await resetDispatch(db);
});

const NEAR = { lat: 32.0757, lng: 34.7756 };
const auditFor = (action: string, targetId: string) =>
  db.select().from(auditLogs).where(and(eq(auditLogs.action, action), eq(auditLogs.targetId, targetId)));

/** Takes every driver offline so the next driver created is the only candidate. */
const allDriversOffline = () => db.update(driverProfiles).set({ availability: "offline" });

/** A completed taxi ride Dizengoff → Rabin with a fresh rider and driver. */
async function completedRide() {
  await allDriversOffline();
  const rider = await makeUser(db, "rider");
  const { user: driver } = await makeDriver(db, NEAR);
  const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
  const done = await driveToCompletion(driver, ride.id);
  return { rider, driver, ride: done };
}

describe("admin/service verifyDriver & reviewDocument", () => {
  it("blocks approval until every required document is approved", async () => {
    const { user } = await makeDriver(db, { verificationStatus: "documents_required", online: false });
    const docs = await uploadAllRequired(user);
    expect((await profileRow(db, user.id)).verificationStatus).toBe("under_review");

    const err = await verifyDriver(admin, user.id, { decision: "approve" }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ status: 409, code: "documents_missing", details: { missing: REQUIRED_DOCUMENTS } });

    for (const d of docs.slice(0, -1)) await reviewDocument(support, user.id, d.id, { status: "approved" });
    const still = await verifyDriver(admin, user.id, { decision: "approve" }).catch((e) => e);
    expect(still.details).toEqual({ missing: [docs[docs.length - 1].type] });
    expect((await profileRow(db, user.id)).verificationStatus).toBe("under_review");

    const reviewed = await reviewDocument(support, user.id, docs[docs.length - 1].id, { status: "approved", notes: "בתוקף" });
    expect(reviewed).toMatchObject({ status: "approved", reviewNotes: "בתוקף" });
    expect((await auditFor("document.approved", reviewed.id))[0]).toMatchObject({ actorId: support.id });

    const approved = await verifyDriver(admin, user.id, { decision: "approve", notes: "הכל תקין", ip: "192.0.2.1" });
    expect(approved).toMatchObject({ verificationStatus: "approved", availability: "offline", reviewNotes: "הכל תקין", rejectionReason: null });
    const row = await profileRow(db, user.id);
    expect(row.reviewedBy).toBe(admin.id);
    expect(row.reviewedAt).not.toBeNull();
    expect((await auditFor("driver.approve", user.id))[0]).toMatchObject({ actorId: admin.id, ip: "192.0.2.1" });
  });

  it("a support agent can skip the document check by writing 'override' in the notes", async () => {
    const { user } = await makeDriver(db, { verificationStatus: "under_review", online: false });
    await expect(verifyDriver(support, user.id, { decision: "approve", notes: "override" })).rejects.toMatchObject({ code: "documents_missing" });
  });

  it("reject, suspend and reinstate update status, availability and reason, with audit rows", async () => {
    const { user } = await makeDriver(db, { online: true }); // approved + online
    const suspended = await verifyDriver(support, user.id, { decision: "suspend", reason: "תלונות חוזרות" });
    expect(suspended).toMatchObject({ verificationStatus: "suspended", availability: "offline", rejectionReason: "תלונות חוזרות" });
    expect(await auditFor("driver.suspend", user.id)).toHaveLength(1);

    const reinstated = await verifyDriver(admin, user.id, { decision: "reinstate" });
    expect(reinstated).toMatchObject({ verificationStatus: "under_review", availability: "offline", rejectionReason: null });
    expect(await auditFor("driver.reinstate", user.id)).toHaveLength(1);

    const rejected = await verifyDriver(admin, user.id, { decision: "reject", reason: "רישיון לא בתוקף" });
    expect(rejected).toMatchObject({ verificationStatus: "rejected", availability: "offline", rejectionReason: "רישיון לא בתוקף" });
    expect((await auditFor("driver.reject", user.id))[0].data).toMatchObject({ reason: "רישיון לא בתוקף" });

    await expect(verifyDriver(admin, "missing", { decision: "reject" })).rejects.toMatchObject({ status: 404 });
  });

  it("a driver suspended mid-ride is set back to online when the ride completes", async () => {
    // completeRide / releaseDriver / driver-cancel set availability "online" unconditionally.
    const rider = await makeUser(db, "rider");
    const { user } = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await acceptAndStart(user, ride.id);
    await verifyDriver(admin, user.id, { decision: "suspend", reason: "תלונה" });
    await completeRide({ driver: user, rideId: ride.id });
    expect(await profileRow(db, user.id)).toMatchObject({ verificationStatus: "suspended", availability: "offline" });
  });

  it("rejecting a document sends a reviewing driver back to documents_required", async () => {
    const { user } = await makeDriver(db, { verificationStatus: "documents_required", online: false });
    const [first] = await uploadAllRequired(user);
    const doc = await reviewDocument(admin, user.id, first.id, { status: "rejected", notes: "תמונה מטושטשת" });
    expect(doc).toMatchObject({ status: "rejected", reviewNotes: "תמונה מטושטשת" });
    const p = await profileRow(db, user.id);
    expect(p).toMatchObject({ verificationStatus: "documents_required", availability: "offline" });
    expect(p.rejectionReason).toContain("תמונה מטושטשת");
    expect(await auditFor("document.rejected", first.id)).toHaveLength(1);
  });

  it("rejecting a document of an already-approved driver leaves the profile alone", async () => {
    const { user } = await makeDriver(db, { online: true });
    const [first] = await uploadAllRequired(user);
    await reviewDocument(admin, user.id, first.id, { status: "rejected" });
    expect(await profileRow(db, user.id)).toMatchObject({ verificationStatus: "approved", availability: "online" });
  });

  it("reviewDocument 404s when the document belongs to another driver", async () => {
    const a = await makeDriver(db, { verificationStatus: "documents_required", online: false });
    const b = await makeDriver(db, { verificationStatus: "documents_required", online: false });
    const [doc] = await uploadAllRequired(a.user);
    await expect(reviewDocument(admin, b.user.id, doc.id, { status: "approved" })).rejects.toMatchObject({ status: 404 });
  });

  it("listDrivers filters by status and search; getDriver includes documents and stats", async () => {
    const { user } = await makeDriver(db, { verificationStatus: "documents_required", online: false, name: "Zvika Unique" });
    await uploadAllRequired(user);
    const pending = await listDrivers({ status: "under_review" });
    expect(pending.some((d) => d.user.id === user.id)).toBe(true);
    expect(pending.every((d) => d.profile.verificationStatus === "under_review")).toBe(true);
    expect((await listDrivers({ q: "zvika uniq" })).map((d) => d.user.id)).toEqual([user.id]);
    const plate = (await profileRow(db, user.id)).vehiclePlate!;
    expect((await listDrivers({ q: plate })).map((d) => d.user.id)).toContain(user.id);
    const detail = await getDriver(user.id);
    expect(detail.documents).toHaveLength(REQUIRED_DOCUMENTS.length);
    expect(detail.stats).toEqual({ completedRides: 0, payoutAgorot: 0 });
    expect(detail.user).not.toHaveProperty("passwordHash");
    await expect(getDriver(support.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("admin/service users", () => {
  it("refuses to change one's own status", async () => {
    await expect(setUserStatus(admin, admin.id, { status: "suspended" })).rejects.toMatchObject({ status: 400, code: "self" });
  });

  it("suspending revokes sessions and takes a driver offline; reactivating clears the reason", async () => {
    const { user } = await makeDriver(db, NEAR);
    const { token } = await createSession(user.id);
    const res = await setUserStatus(support, user.id, { status: "suspended", reason: "fraud", ip: "192.0.2.9" });
    expect(res.status).toBe("suspended");
    expect(await getUserByToken(token)).toBeNull();
    expect((await profileRow(db, user.id)).availability).toBe("offline");
    expect((await getUser(user.id)).suspendedReason).toBe("fraud");
    expect((await auditFor("user.suspended", user.id))[0]).toMatchObject({ actorId: support.id, ip: "192.0.2.9" });

    await setUserStatus(admin, user.id, { status: "active" });
    expect((await getUser(user.id)).suspendedReason).toBeNull();
    expect(await auditFor("user.active", user.id)).toHaveLength(1);
    const { token: fresh } = await createSession(user.id);
    expect((await getUserByToken(fresh))?.id).toBe(user.id);
  });

  it("support cannot suspend an admin; an admin can", async () => {
    const otherAdmin = await makeUser(db, "admin");
    await expect(setUserStatus(support, otherAdmin.id, { status: "suspended" })).rejects.toMatchObject({ status: 403 });
    await expect(setUserStatus(admin, otherAdmin.id, { status: "suspended" })).resolves.toMatchObject({ status: "suspended" });
    await expect(setUserStatus(admin, "missing", { status: "suspended" })).rejects.toMatchObject({ status: 404 });
  });

  it("only admins change roles; becoming a driver creates a profile and revokes sessions", async () => {
    const rider = await makeUser(db, "rider");
    const { token } = await createSession(rider.id);
    await expect(setUserRole(support, rider.id, "driver")).rejects.toMatchObject({ status: 403 });
    await expect(setUserRole(admin, admin.id, "rider")).rejects.toMatchObject({ status: 400, code: "self" });
    const res = await setUserRole(admin, rider.id, "driver", "192.0.2.3");
    expect(res.role).toBe("driver");
    expect(await profileRow(db, rider.id)).toMatchObject({ verificationStatus: "documents_required", availability: "offline" });
    expect(await getUserByToken(token)).toBeNull();
    expect((await auditFor("user.role_changed", rider.id))[0].data).toEqual({ role: "driver" });
    // Idempotent for an existing profile.
    await setUserRole(admin, rider.id, "driver");
    expect(await db.select().from(driverProfiles).where(eq(driverProfiles.userId, rider.id))).toHaveLength(1);
    await expect(setUserRole(admin, "missing", "rider")).rejects.toMatchObject({ status: 404 });
  });

  it("listUsers filters by role, status and search; getUser counts rides", async () => {
    const u = await makeUser(db, "rider", { name: "Quentin Searchable" });
    expect((await listUsers({ q: "quentin" })).map((x) => x.id)).toEqual([u.id]);
    expect((await listUsers({ role: "support" })).every((x) => x.role === "support")).toBe(true);
    expect((await listUsers({ status: "suspended" })).every((x) => x.status === "suspended")).toBe(true);
    expect((await listUsers({ q: u.phone! })).map((x) => x.id)).toContain(u.id);
    const detail = await getUser(u.id);
    expect(detail).toMatchObject({ stats: { rides: 0 }, recentRides: [], driverProfile: null });
    expect(detail.user).not.toHaveProperty("passwordHash");
  });
});

describe("admin/service rides", () => {
  it("adjustRide enforces refund bounds and tracks partial vs full refunds", async () => {
    const { ride, rider } = await completedRide();
    const charged = ride.finalTotalAgorot!;
    await expect(adjustRide(admin, ride.id, { refundAgorot: -1, note: "x" })).rejects.toMatchObject({ status: 400, code: "bad_refund" });
    await expect(adjustRide(admin, ride.id, { refundAgorot: charged + 1, note: "x" })).rejects.toMatchObject({ status: 400, code: "refund_exceeds" });

    await adjustRide(support, ride.id, { refundAgorot: 500, note: "עיכוב" });
    let row = await rideRow(db, ride.id);
    expect(row).toMatchObject({ refundedAgorot: 500, paymentStatus: "partially_refunded", adminNotes: "עיכוב" });
    await expect(adjustRide(admin, ride.id, { refundAgorot: charged - 499, note: "x" })).rejects.toMatchObject({ code: "refund_exceeds" });

    await adjustRide(admin, ride.id, { refundAgorot: charged - 500, note: "החזר מלא" });
    row = await rideRow(db, ride.id);
    expect(row).toMatchObject({ refundedAgorot: charged, paymentStatus: "refunded", adminNotes: "עיכוב\nהחזר מלא" });
    const refunds = await db.select().from(ledgerEntries).where(and(eq(ledgerEntries.rideId, ride.id), eq(ledgerEntries.type, "refund")));
    expect(refunds.map((r) => r.amountAgorot).sort((a, b) => a - b)).toEqual([-(charged - 500), -500].sort((a, b) => a - b));
    expect(refunds.every((r) => r.userId === rider.id)).toBe(true);
    expect(refunds.map((r) => r.createdBy).sort()).toEqual([admin.id, support.id].sort());

    await expect(adjustRide(admin, ride.id, { refundAgorot: 1, note: "x" })).rejects.toMatchObject({ code: "refund_exceeds" });
    // Note-only adjustments are always allowed.
    await adjustRide(admin, ride.id, { note: "בדיקה" });
    expect((await rideRow(db, ride.id)).adminNotes).toBe("עיכוב\nהחזר מלא\nבדיקה");
    expect(await auditFor("ride.adjust", ride.id)).toHaveLength(3);
  });

  it("adjustRide only touches finished rides; a cancellation fee is refundable", async () => {
    const rider = await makeUser(db, "rider");
    const { user: driver } = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await expect(adjustRide(admin, ride.id, { refundAgorot: 100, note: "x" })).rejects.toMatchObject({ status: 409, code: "not_final" });
    await respondToOffer({ driver, rideId: ride.id, accept: true });
    await db.update(rides).set({ acceptedAt: new Date(Date.now() - 10 * 60_000) }).where(eq(rides.id, ride.id));
    const cancelled = await cancelRide({ actor: rider, rideId: ride.id });
    const fee = cancelled.cancellationFeeAgorot;
    expect(fee).toBeGreaterThan(0);
    await expect(adjustRide(admin, ride.id, { refundAgorot: fee + 1, note: "x" })).rejects.toMatchObject({ code: "refund_exceeds" });
    await adjustRide(admin, ride.id, { refundAgorot: fee, note: "ויתור על דמי ביטול" });
    expect((await rideRow(db, ride.id)).paymentStatus).toBe("refunded");
    await expect(adjustRide(admin, "missing", { note: "x" })).rejects.toMatchObject({ status: 404 });
  });

  it("listRides filters by active status, flags, date range and search", async () => {
    const start = new Date();
    const { ride: done } = await completedRide();
    await db.update(rides).set({ flags: [{ code: "too_short", severity: "critical", message: "x", at: new Date().toISOString() }] }).where(eq(rides.id, done.id));
    const rider = await makeUser(db, "rider");
    const { ride: active } = await bookRide(rider, TLV.rabin, TLV.airport, { serviceTypeId: "premium" });

    const activeList = await listRides({ status: "active" });
    expect(activeList.map((r) => r.id)).toContain(active.id);
    expect(activeList.map((r) => r.id)).not.toContain(done.id);
    expect((await listRides({ status: "completed", from: start })).map((r) => r.id)).toEqual([done.id]);

    const flagged = await listRides({ flagged: true });
    expect(flagged.every((r) => r.flags.length > 0)).toBe(true);
    expect(flagged.map((r) => r.id)).toContain(done.id);
    expect(flagged.map((r) => r.id)).not.toContain(active.id);

    const window = await listRides({ from: start, to: new Date() });
    expect(window.map((r) => r.id).sort()).toEqual([done.id, active.id].sort());
    expect(await listRides({ to: new Date(start.getTime() - 60_000), from: new Date(start.getTime() - 120_000) })).toEqual([]);
    expect((await listRides({ q: active.id })).map((r) => r.id)).toEqual([active.id]);
    expect((await listRides({ q: "נתב", from: start })).map((r) => r.id)).toEqual([active.id]);
    // Staff see unmasked parties and flags.
    expect(window.find((r) => r.id === active.id)?.rider?.phoneMasked).toBe(rider.phone);
  });

  it("overview counters move with ride activity", async () => {
    const before = await overview();
    const { ride, driver } = await completedRide();
    const rider = await makeUser(db, "rider");
    const { ride: active } = await bookRide(rider, TLV.rabin, TLV.airport, { serviceTypeId: "premium" });
    await createTicket(rider, { category: "other", subject: "s", body: "b" });
    const after = await overview();
    expect(after.activeRides).toBe(before.activeRides + 1);
    expect(after.completedToday).toBe(before.completedToday + 1);
    expect(after.grossTodayAgorot).toBe(before.grossTodayAgorot + ride.finalTotalAgorot!);
    expect(after.commissionTodayAgorot).toBe(before.commissionTodayAgorot + ride.commissionAgorot!);
    expect(after.payoutTodayAgorot).toBe(before.payoutTodayAgorot + ride.driverPayoutAgorot!);
    expect(after.onlineDrivers).toBe(before.onlineDrivers + 1);
    expect(after.openTickets).toBe(before.openTickets + 1);
    expect(after.totalUsers).toBe(before.totalUsers + 3); // two riders + one driver
    expect(after.recentRides[0].id).toBe(active.id);
    expect(after.flaggedRides).toBeGreaterThanOrEqual(before.flaggedRides);
    expect(after.liveDrivers.find((d) => d.id === driver.id)).toMatchObject({ availability: "online", lat: NEAR.lat, lng: NEAR.lng });

    await cancelRide({ actor: admin, rideId: active.id, reason: "test" });
    const later = await overview();
    expect(later.activeRides).toBe(before.activeRides);
    expect(later.cancelledToday).toBe(after.cancelledToday + 1);
  });

  it("report totals equal the completed rides in range, plus fees and refunds", async () => {
    const from = new Date();
    const a = await completedRide();
    const b = await completedRide();
    const rider = await makeUser(db, "rider");
    await allDriversOffline();
    const { user: driver } = await makeDriver(db, NEAR);
    const { ride: c } = await bookRide(rider, TLV.dizengoff, TLV.airport);
    await respondToOffer({ driver, rideId: c.id, accept: true });
    await db.update(rides).set({ acceptedAt: new Date(Date.now() - 10 * 60_000) }).where(eq(rides.id, c.id));
    const cancelled = await cancelRide({ actor: rider, rideId: c.id });
    await adjustRide(admin, a.ride.id, { refundAgorot: 700, note: "partial" });
    const to = new Date();

    const r = await report({ from, to });
    const completed = [a.ride, b.ride];
    const sum = (f: (x: (typeof completed)[number]) => number) => completed.reduce((s, x) => s + f(x), 0);
    expect(r.isDemoTariff).toBe(true);
    expect(r.totals).toMatchObject({
      rides: 2,
      gross: sum((x) => x.finalTotalAgorot!),
      commission: sum((x) => x.commissionAgorot!),
      payout: sum((x) => x.driverPayoutAgorot!),
      distanceM: sum((x) => x.actualDistanceM!),
      cancelled: 1,
      cancellationFeesAgorot: cancelled.cancellationFeeAgorot,
      refundsAgorot: -700,
    });
    expect(r.totals.netCommissionAgorot).toBe(r.totals.commission + cancelled.cancellationFeeAgorot - 700);
    expect(r.byDay.reduce((s, d) => s + d.rides, 0)).toBe(2);
    expect(r.byDay.reduce((s, d) => s + d.grossAgorot, 0)).toBe(r.totals.gross);
    expect(r.byService).toEqual([{ serviceTypeId: "taxi", rides: 2, grossAgorot: r.totals.gross }]);
    const ledger = Object.fromEntries(r.ledger.map((l) => [l.type, l]));
    expect(ledger.rider_charge.totalAgorot).toBe(r.totals.gross);
    expect(ledger.hop_commission.totalAgorot).toBe(r.totals.commission);
    expect(ledger.driver_payout.totalAgorot).toBe(r.totals.payout);
    expect(ledger.cancellation_fee).toMatchObject({ totalAgorot: cancelled.cancellationFeeAgorot, entries: 1 });
    expect(ledger.refund).toMatchObject({ totalAgorot: -700, entries: 1 });

    // An empty range reports zeros.
    const empty = await report({ from: new Date(0), to: new Date(1000) });
    expect(empty.totals).toMatchObject({ rides: 0, gross: 0, cancelled: 0, refundsAgorot: 0 });
    expect(empty.byDay).toEqual([]);
  });

  it("listAuditLogs filters by action prefix and actor, newest first, with actor names", async () => {
    const target = await makeUser(db, "rider");
    await setUserStatus(support, target.id, { status: "suspended", reason: "a" });
    await setUserStatus(support, target.id, { status: "active" });
    const bySupport = await listAuditLogs({ actorId: support.id });
    expect(bySupport.length).toBeGreaterThanOrEqual(2);
    expect(bySupport.every((l) => l.actorId === support.id && l.actorName === support.name)).toBe(true);
    expect(bySupport[0].action).toBe("user.active");
    expect(bySupport[0].createdAt >= bySupport[1].createdAt).toBe(true);
    const userActions = await listAuditLogs({ action: "user." });
    expect(userActions.length).toBeGreaterThanOrEqual(2);
    expect(userActions.every((l) => l.action.startsWith("user."))).toBe(true);
    expect(await listAuditLogs({ action: "user.", actorId: support.id, limit: 1 })).toHaveLength(1);
    expect(await listAuditLogs({ action: "no.such.action" })).toEqual([]);
  });
});

describe("admin/service service types", () => {
  it("cannot enable a service that lacks regulatory approval", async () => {
    await expect(updateServiceType(admin, "rideshare", { enabled: true })).rejects.toMatchObject({ status: 409, code: "not_legal" });
    const [row] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, "rideshare"));
    expect(row.enabled).toBe(false);
    // Other edits of an unapproved service are fine but keep it disabled.
    const edited = await updateServiceType(admin, "rideshare", { descriptionHe: "עדיין כבוי" });
    expect(edited).toMatchObject({ enabled: false, descriptionHe: "עדיין כבוי" });
  });

  it("admins edit multipliers (reflected in quotes) and toggle approved services; support cannot", async () => {
    await expect(updateServiceType(support, "taxi_xl", { priceMultiplierBp: 20000 })).rejects.toMatchObject({ status: 403 });
    await expect(updateServiceType(admin, "nope", { enabled: false })).rejects.toMatchObject({ status: 404 });
    const xl = await updateServiceType(admin, "taxi_xl", { priceMultiplierBp: 20000 }, "192.0.2.4");
    expect(xl).toMatchObject({ priceMultiplierBp: 20000, enabled: true });
    expect((await auditFor("service_type.update", "taxi_xl"))[0].data).toEqual({ priceMultiplierBp: 20000 });
    const rider = await makeUser(db, "rider");
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.airport });
    expect(q.quotes.find((x) => x.serviceType.id === "taxi_xl")!.fare.serviceMultiplierBp).toBe(20000);

    await updateServiceType(admin, "taxi_xl", { enabled: false });
    const q2 = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.airport });
    expect(q2.quotes.map((x) => x.serviceType.id)).not.toContain("taxi_xl");
    await updateServiceType(admin, "taxi_xl", { enabled: true, priceMultiplierBp: 13500 });
  });
});

describe("admin/service pricing", () => {
  it("only admins update pricing; invalid tariffs are rejected without a new version", async () => {
    const before = await db.select().from(pricingConfigs);
    await expect(updatePricing(support, { baseFareAgorot: 1 })).rejects.toMatchObject({ status: 403 });
    await expect(updatePricing(admin, { minFareAgorot: 90_000, maxFareAgorot: 80_000 })).rejects.toMatchObject({ status: 400, code: "min_gt_max" });
    await expect(updatePricing(admin, { commissionPercentBp: 5001 })).rejects.toMatchObject({ status: 400, code: "bad_commission" });
    await expect(updatePricing(admin, { commissionPercentBp: -1 })).rejects.toMatchObject({ status: 400, code: "bad_commission" });
    expect(await db.select().from(pricingConfigs)).toHaveLength(before.length);
  });

  it("creates a new active version, deactivates the old one and is used for new quotes", async () => {
    const old = await getActivePricing();
    const created = await updatePricing(admin, { baseFareAgorot: 2000, commissionPercentBp: 5000, name: "תעריף ב" }, "192.0.2.5");
    expect(created).toMatchObject({
      active: true,
      name: "תעריף ב",
      baseFareAgorot: 2000,
      commissionPercentBp: 5000,
      perKmAgorot: old.perKmAgorot, // merged from the previous version
      isDemo: old.isDemo,
      updatedBy: admin.id,
    });
    expect(created.id).not.toBe(old.id);
    const actives = await db.select().from(pricingConfigs).where(eq(pricingConfigs.active, true));
    expect(actives.map((p) => p.id)).toEqual([created.id]);
    const [oldRow] = await db.select().from(pricingConfigs).where(eq(pricingConfigs.id, old.id));
    expect(oldRow.active).toBe(false);
    const { active, history } = await getPricing();
    expect(active?.id).toBe(created.id);
    expect(history.map((h) => h.id)).toEqual(expect.arrayContaining([created.id, old.id]));
    expect((await auditFor("pricing.update", created.id))[0]).toMatchObject({ actorId: admin.id, ip: "192.0.2.5" });

    const rider = await makeUser(db, "rider");
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.airport });
    expect(q.quotes.every((x) => x.fare.pricingConfigId === created.id && x.fare.commissionPercentBp === 5000)).toBe(true);
    // Rides priced earlier keep the tariff they were quoted with.
    const earlier = await db.select().from(rides).where(eq(rides.status, "completed"));
    expect(earlier.length).toBeGreaterThan(0);
    expect(earlier.every((x) => x.quotedFare.pricingConfigId === old.id)).toBe(true);
  });
});
