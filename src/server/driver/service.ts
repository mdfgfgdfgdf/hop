import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getDb } from "../db/client";
import { driverDocuments, driverProfiles, ledgerEntries, pricingConfigs, rides, type DocumentType, type User } from "../db/schema";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { env } from "../env";
import { audit } from "../audit";
import { publish, channels } from "../realtime/bus";
import type { EarningsDTO } from "@/lib/types";
import { dayKeyIL } from "../time";

export const REQUIRED_DOCUMENTS: DocumentType[] = [
  "id_card",
  "drivers_license",
  "taxi_driver_permit",
  "taxi_license_number",
  "vehicle_registration",
  "insurance",
];

export const DOCUMENT_LABELS_HE: Record<DocumentType, string> = {
  id_card: "תעודת זהות",
  drivers_license: "רישיון נהיגה",
  taxi_driver_permit: "היתר להסעת נוסעים בשכר",
  taxi_license_number: "רישיון מונית (מספר ירוק)",
  vehicle_registration: "רישיון רכב",
  insurance: "ביטוח חובה + צד ג' להסעת נוסעים",
  vehicle_photo: "תמונת הרכב",
};

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function getProfile(driverId: string) {
  const db = await getDb();
  const [p] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, driverId));
  if (!p) throw notFound("פרופיל נהג לא נמצא");
  return p;
}

export async function updateProfile(
  driver: User,
  patch: Partial<Pick<typeof driverProfiles.$inferInsert, "vehicleClass" | "vehicleMake" | "vehicleModel" | "vehicleColor" | "vehiclePlate" | "vehicleYear" | "seats" | "licenseNumber" | "taxiLicenseNumber" | "serviceTypeIds">>,
) {
  const db = await getDb();
  const p = await getProfile(driver.id);
  if (p.verificationStatus === "approved" && (patch.vehiclePlate !== undefined && patch.vehiclePlate !== p.vehiclePlate)) {
    // Changing the vehicle after approval requires re-verification.
    patch = { ...patch };
    const [updated] = await db
      .update(driverProfiles)
      .set({ ...patch, verificationStatus: "under_review", availability: "offline" })
      .where(eq(driverProfiles.userId, driver.id))
      .returning();
    await audit({ actorId: driver.id, actorRole: "driver", action: "driver.vehicle_changed_requires_review", targetType: "driver", targetId: driver.id });
    return updated;
  }
  const [updated] = await db.update(driverProfiles).set(patch).where(eq(driverProfiles.userId, driver.id)).returning();
  return updated;
}

export async function listDocuments(driverId: string) {
  const db = await getDb();
  return db.select().from(driverDocuments).where(eq(driverDocuments.driverId, driverId)).orderBy(desc(driverDocuments.uploadedAt));
}

export async function uploadDocument(driver: User, input: { type: DocumentType; file: File; expiresAt?: Date | null }) {
  if (!ALLOWED_MIME.has(input.file.type)) throw badRequest("bad_file_type", "ניתן להעלות תמונות (JPG/PNG/WebP) או PDF בלבד");
  if (input.file.size > MAX_BYTES) throw badRequest("file_too_large", "הקובץ גדול מדי (עד 8MB)");
  if (input.file.size === 0) throw badRequest("empty_file", "הקובץ ריק");

  const dir = path.resolve(process.cwd(), env().HOP_DATA_DIR, "uploads", driver.id);
  await fs.mkdir(dir, { recursive: true });
  const ext = input.file.type === "application/pdf" ? "pdf" : input.file.type.split("/")[1];
  const key = `${input.type}-${randomBytes(8).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir, key), Buffer.from(await input.file.arrayBuffer()));

  const db = await getDb();
  const doc = await db.transaction(async (tx) => {
    // A new upload supersedes previous submissions of the same type.
    await tx
      .update(driverDocuments)
      .set({ status: "rejected", reviewNotes: "הוחלף בקובץ חדש" })
      .where(and(eq(driverDocuments.driverId, driver.id), eq(driverDocuments.type, input.type), eq(driverDocuments.status, "submitted")));
    const [d] = await tx
      .insert(driverDocuments)
      .values({
        driverId: driver.id,
        type: input.type,
        fileName: input.file.name.slice(0, 120),
        mimeType: input.file.type,
        sizeBytes: input.file.size,
        storageKey: `${driver.id}/${key}`,
        expiresAt: input.expiresAt ?? null,
      })
      .returning();
    const [p] = await tx.select().from(driverProfiles).where(eq(driverProfiles.userId, driver.id));
    if (p && (p.verificationStatus === "documents_required" || p.verificationStatus === "rejected")) {
      const docs = await tx.select({ type: driverDocuments.type, status: driverDocuments.status }).from(driverDocuments).where(eq(driverDocuments.driverId, driver.id));
      const have = new Set(docs.filter((x) => x.status !== "rejected").map((x) => x.type));
      if (REQUIRED_DOCUMENTS.every((t) => have.has(t))) {
        await tx.update(driverProfiles).set({ verificationStatus: "under_review", rejectionReason: null }).where(eq(driverProfiles.userId, driver.id));
        publish(channels.admin, "admin.driver", { driverId: driver.id, verificationStatus: "under_review" });
      }
    }
    return d;
  });
  await audit({ actorId: driver.id, actorRole: "driver", action: "driver.document_uploaded", targetType: "driver_document", targetId: doc.id, data: { type: input.type } });
  return doc;
}

export async function readDocumentFile(doc: { storageKey: string }) {
  const file = path.resolve(process.cwd(), env().HOP_DATA_DIR, "uploads", doc.storageKey);
  return fs.readFile(file);
}

export async function getDocumentForViewer(docId: string, viewer: User) {
  const db = await getDb();
  const [doc] = await db.select().from(driverDocuments).where(eq(driverDocuments.id, docId));
  if (!doc) throw notFound();
  const staff = viewer.role === "admin" || viewer.role === "support";
  if (!staff && doc.driverId !== viewer.id) throw forbidden();
  return doc;
}

export async function earnings(driverId: string, range: { from: Date; to: Date }): Promise<EarningsDTO> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(rides)
    .where(and(eq(rides.driverId, driverId), eq(rides.status, "completed"), gte(rides.completedAt, range.from), lte(rides.completedAt, range.to)))
    .orderBy(desc(rides.completedAt));
  const cancellationRows = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amountAgorot}), 0)` })
    .from(ledgerEntries)
    .innerJoin(rides, eq(rides.id, ledgerEntries.rideId))
    .where(and(eq(ledgerEntries.type, "cancellation_fee"), eq(rides.driverId, driverId), gte(ledgerEntries.createdAt, range.from), lte(ledgerEntries.createdAt, range.to)));
  const [cfg] = await db.select({ isDemo: pricingConfigs.isDemo }).from(pricingConfigs).where(eq(pricingConfigs.active, true)).limit(1);

  const byDayMap = new Map<string, { rides: number; netAgorot: number; grossAgorot: number; tipsAgorot: number }>();
  let gross = 0, commission = 0, net = 0, tips = 0;
  for (const r of rows) {
    gross += r.finalTotalAgorot ?? 0;
    commission += r.commissionAgorot ?? 0;
    net += r.driverPayoutAgorot ?? 0;
    tips += r.tipAgorot;
    const day = dayKeyIL(r.completedAt ?? r.createdAt);
    const d = byDayMap.get(day) ?? { rides: 0, netAgorot: 0, grossAgorot: 0, tipsAgorot: 0 };
    d.rides += 1;
    d.netAgorot += r.driverPayoutAgorot ?? 0;
    d.grossAgorot += r.finalTotalAgorot ?? 0;
    d.tipsAgorot += r.tipAgorot;
    byDayMap.set(day, d);
  }
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    ridesCompleted: rows.length,
    grossAgorot: gross,
    commissionAgorot: commission,
    netAgorot: net,
    // Tips are paid in full to the driver, on top of the payout (by ride completion day).
    tipsAgorot: tips,
    cancellationFeesAgorot: Number(cancellationRows[0]?.total ?? 0),
    byDay: [...byDayMap.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).map(([date, v]) => ({ date, ...v })),
    isDemoTariff: cfg?.isDemo ?? true,
  };
}

export function assertApprovedDriver(p: { verificationStatus: string }) {
  if (p.verificationStatus !== "approved") throw conflict("not_approved", "החשבון עדיין לא אושר לקבלת נסיעות");
}
