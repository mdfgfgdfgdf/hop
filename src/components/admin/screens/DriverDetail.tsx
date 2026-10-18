"use client";
import Link from "next/link";
import { CheckCircle2, Circle, Clock3, ExternalLink, FileText, RotateCcw, ShieldCheck, ShieldOff, UserRound, XCircle } from "lucide-react";
import { api, ApiClientError, type AdminDriverDetail } from "@/lib/api";
import { formatDate, formatDateTime, formatILS, formatRelative } from "@/lib/format";
import { DOCUMENT_TYPE_HE, VEHICLE_CLASS_HE } from "@/lib/labels";
import type { DocumentType, DriverDocumentDTO } from "@/lib/types";
import { Button, EmptyState, Pill, useToast, cn } from "@/components/ui";
import { useAdminFeed, readAdminDriver } from "../realtime";
import { errorMessage, useDebouncedCallback, useLoad } from "../hooks";
import { DataTable, DetailSkeleton, ErrorState, KV, Ltr, Muted, Page, PageHeader, Panel } from "../ui";
import { AvailabilityPill, DocumentStatusPill, UserStatusPill, VerificationPill } from "../pills";
import { useConfirm } from "../Dialog";
import { rideColumns } from "../rides";
import { RatingCell, acceptance, vehicleLine } from "./Drivers";

/**
 * Mirrors REQUIRED_DOCUMENTS in src/server/driver/service.ts (server-only module).
 * The server remains authoritative: a 409 `documents_missing` lists what is missing.
 */
export const REQUIRED_DOCS: DocumentType[] = ["id_card", "drivers_license", "taxi_driver_permit", "taxi_license_number", "vehicle_registration", "insurance"];
const OPTIONAL_DOCS: DocumentType[] = ["vehicle_photo"];

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function missingDocsError(err: unknown): React.ReactNode {
  if (err instanceof ApiClientError && err.code === "documents_missing") {
    const details = err.details as { missing?: string[] } | undefined;
    const missing = details?.missing ?? [];
    return (
      <div className="rounded-2xl bg-[color-mix(in_oklab,var(--danger)_9%,transparent)] px-4 py-3 text-sm text-danger">
        <div className="font-bold">{err.message}</div>
        {missing.length > 0 && (
          <>
            <div className="mt-2 font-semibold">מסמכים שטרם אושרו:</div>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {missing.map((m) => (
                <li key={m}>{DOCUMENT_TYPE_HE[m as DocumentType] ?? m}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }
  return <div className="rounded-2xl bg-[color-mix(in_oklab,var(--danger)_9%,transparent)] px-4 py-3 text-sm font-semibold text-danger">{errorMessage(err)}</div>;
}

export function DriverDetail({ id }: { id: string }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const { data, error, loading, reload } = useLoad(`driver:${id}`, () => api.admin.driver(id));
  const services = useLoad("service-types-admin", () => api.admin.serviceTypes());
  const debounced = useDebouncedCallback(reload, 800);
  useAdminFeed((e) => {
    const d = readAdminDriver(e);
    if ((d && d.driverId === id) || e.type === "reconnect") debounced();
  });

  if (loading)
    return (
      <Page>
        <DetailSkeleton />
      </Page>
    );
  if (!data)
    return (
      <Page>
        <PageHeader title="פרטי נהג" back={{ href: "/admin/drivers", label: "לכל הנהגים" }} />
        <div className="card">
          <ErrorState message={error ?? "הנהג לא נמצא"} onRetry={reload} />
        </div>
      </Page>
    );

  const { user, profile, documents, stats, recentRides } = data;
  const status = profile.verificationStatus;

  const decide = (decision: "approve" | "reject" | "suspend" | "reinstate") => {
    const map = {
      approve: {
        title: `לאשר את ${user.name} כנהג?`,
        description: "לאחר האישור הנהג יוכל להתחבר ולקבל הצעות נסיעה. ודאו שכל המסמכים הנדרשים נבדקו ואושרו.",
        confirmLabel: "אישור נהג",
        tone: "success" as const,
        reason: { label: "הערות פנימיות", placeholder: "לא חובה — יישמר ביומן הביקורת" },
        success: "הנהג אושר",
      },
      reject: {
        title: `לדחות את הבקשה של ${user.name}?`,
        description: "הנהג יקבל הודעה עם סיבת הדחייה ולא יוכל לקבל נסיעות.",
        confirmLabel: "דחיית הבקשה",
        tone: "danger" as const,
        reason: { label: "סיבת הדחייה (תוצג לנהג)", required: true, placeholder: "למשל: רישיון הנהיגה פג תוקף" },
        success: "הבקשה נדחתה",
      },
      suspend: {
        title: `להשעות את ${user.name}?`,
        description: "הנהג ינותק מיידית ולא יקבל הצעות נסיעה עד להחזרתו. נסיעה פעילה לא תבוטל אוטומטית.",
        confirmLabel: "השעיית נהג",
        tone: "danger" as const,
        reason: { label: "סיבת ההשעיה", required: true, placeholder: "למשל: תלונת בטיחות בבירור" },
        success: "הנהג הושעה",
      },
      reinstate: {
        title: `להחזיר את ${user.name} לבדיקה?`,
        description: "הסטטוס יחזור ל״בבדיקה״. כדי שהנהג יוכל לנסוע יש לאשר אותו מחדש.",
        confirmLabel: "החזרה לבדיקה",
        tone: "primary" as const,
        reason: { label: "הערות", placeholder: "לא חובה" },
        success: "הנהג הוחזר לבדיקה",
      },
    }[decision];
    confirm({
      title: map.title,
      description: map.description,
      confirmLabel: map.confirmLabel,
      tone: map.tone,
      reason: map.reason,
      formatError: decision === "approve" ? missingDocsError : undefined,
      onConfirm: async (text) => {
        const isReason = decision === "reject" || decision === "suspend";
        await api.admin.verifyDriver(id, { decision, reason: isReason ? text : null, notes: isReason ? null : text || null });
        toast.success(map.success);
        reload();
      },
    });
  };

  const reviewDoc = (doc: DriverDocumentDTO, decision: "approved" | "rejected") => {
    const label = DOCUMENT_TYPE_HE[doc.type];
    confirm({
      title: decision === "approved" ? `לאשר את המסמך „${label}”?` : `לדחות את המסמך „${label}”?`,
      description:
        decision === "approved" ? "ודאו שהמסמך קריא, בתוקף ותואם לפרטי הנהג." : "דחיית מסמך מחזירה את הנהג לסטטוס ״נדרשים מסמכים״ ומנתקת אותו עד להעלאה מחדש.",
      confirmLabel: decision === "approved" ? "אישור מסמך" : "דחיית מסמך",
      tone: decision === "approved" ? "success" : "danger",
      reason: decision === "approved" ? { label: "הערות", placeholder: "לא חובה" } : { label: "סיבת הדחייה (תוצג לנהג)", required: true, placeholder: "למשל: התמונה מטושטשת" },
      onConfirm: async (notes) => {
        await api.admin.reviewDocument(id, doc.id, { status: decision, notes: notes || null });
        toast.success(decision === "approved" ? "המסמך אושר" : "המסמך נדחה");
        reload();
      },
    });
  };

  const actions = (
    <>
      {(status === "under_review" || status === "documents_required") && (
        <>
          <Button variant="success" size="sm" onClick={() => decide("approve")}>
            <ShieldCheck size={17} aria-hidden />
            אישור נהג
          </Button>
          <Button variant="glass" size="sm" className="text-danger" onClick={() => decide("reject")}>
            <XCircle size={17} aria-hidden />
            דחייה
          </Button>
        </>
      )}
      {status === "approved" && (
        <Button variant="danger" size="sm" onClick={() => decide("suspend")}>
          <ShieldOff size={17} aria-hidden />
          השעיית נהג
        </Button>
      )}
      {(status === "suspended" || status === "rejected") && (
        <Button variant="primary" size="sm" onClick={() => decide("reinstate")}>
          <RotateCcw size={17} aria-hidden />
          החזרה לבדיקה
        </Button>
      )}
      <Link href={`/admin/users/${user.id}`} className="btn btn-ghost btn-sm">
        <UserRound size={17} aria-hidden />
        חשבון משתמש
      </Link>
    </>
  );

  const pct = acceptance(profile);

  return (
    <Page>
      <PageHeader
        back={{ href: "/admin/drivers", label: "לכל הנהגים" }}
        title={user.name}
        meta={
          <>
            <VerificationPill status={status} />
            <AvailabilityPill availability={profile.availability} />
            {user.status === "suspended" && <UserStatusPill status="suspended" />}
            {user.isDemo && <Pill tone="warning">משתמש הדגמה</Pill>}
            <span className="text-sm text-fg-muted">הצטרף {formatDate(profile.createdAt)}</span>
          </>
        }
        actions={actions}
      />

      {(profile.rejectionReason || profile.reviewNotes) && (
        <div className={cn("mb-5 rounded-[var(--radius-lg)] border px-4 py-3 text-sm", status === "approved" ? "border-line bg-surface" : "border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-[color-mix(in_oklab,var(--danger)_6%,var(--surface))]")}>
          {profile.rejectionReason && (
            <div>
              <span className="font-bold">סיבה אחרונה: </span>
              {profile.rejectionReason}
            </div>
          )}
          {profile.reviewNotes && (
            <div className="mt-1 text-fg-muted">
              <span className="font-semibold">הערות בודק: </span>
              {profile.reviewNotes}
            </div>
          )}
          {profile.reviewedAt && <div className="mt-1 text-xs text-fg-muted">נבדק {formatDateTime(profile.reviewedAt)}</div>}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <DocumentsPanel documents={documents} onReview={reviewDoc} />
          <Panel title="נסיעות אחרונות" flush>
            <DataTable
              rows={recentRides}
              columns={rideColumns({ hideDriver: true })}
              rowKey={(r) => r.id}
              rowHref={(r) => `/admin/rides/${r.id}`}
              empty={<EmptyState title="אין נסיעות עדיין" description="נסיעות שהנהג יבצע יופיעו כאן." />}
            />
          </Panel>
        </div>
        <div className="space-y-5">
          <Checklist documents={documents} status={status} />
          <Panel title="ביצועים">
            <div className="grid grid-cols-2 gap-4">
              <MiniStat label="נסיעות שהושלמו" value={stats.completedRides} />
              <MiniStat label="סה״כ תשלומים לנהג" value={formatILS(stats.payoutAgorot)} />
              <MiniStat label="דירוג" value={<RatingCell rating={profile.rating} count={profile.ratingCount} />} />
              <MiniStat label="שיעור קבלת הצעות" value={pct == null ? <Muted>—</Muted> : `${pct}%`} hint={`${profile.offersAccepted} מתוך ${profile.offersReceived}`} />
            </div>
          </Panel>
          <Panel title="פרטי נהג ורכב">
            <KV
              cols={1}
              items={[
                { label: "אימייל", value: <Ltr>{user.email}</Ltr> },
                { label: "טלפון", value: user.phone ? <Ltr>{user.phone}</Ltr> : <Muted>לא הוזן</Muted> },
                { label: "רכב", value: vehicleLine(profile) },
                { label: "מספר רישוי", value: profile.vehiclePlate ? <Ltr className="font-bold">{profile.vehiclePlate}</Ltr> : <Muted>לא הוזן</Muted> },
                { label: "סוג רכב ומושבים", value: `${VEHICLE_CLASS_HE[profile.vehicleClass]} · ${profile.seats} מושבים` },
                { label: "מספר רישיון נהיגה", value: profile.licenseNumber ? <Ltr>{profile.licenseNumber}</Ltr> : <Muted>לא הוזן</Muted> },
                { label: "רישיון מונית", value: profile.taxiLicenseNumber ? <Ltr>{profile.taxiLicenseNumber}</Ltr> : <Muted>לא הוזן</Muted> },
                {
                  label: "סוגי שירות",
                  value: profile.serviceTypeIds.length ? profile.serviceTypeIds.map((sid) => services.data?.serviceTypes.find((x) => x.id === sid)?.nameHe ?? sid).join(" · ") : <Muted>כל הסוגים המתאימים</Muted>,
                },
                { label: "מיקום אחרון", value: profile.lastLocation ? `עודכן ${formatRelative(profile.lastLocation.at)}` : <Muted>אין מיקום</Muted> },
              ]}
            />
          </Panel>
        </div>
      </div>
      {dialog}
    </Page>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold text-fg-muted">{label}</div>
      <div className="mt-1 text-lg font-extrabold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-fg-muted tabular-nums">{hint}</div>}
    </div>
  );
}

function latestByType(documents: DriverDocumentDTO[]) {
  const map = new Map<DocumentType, DriverDocumentDTO[]>();
  for (const d of [...documents].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))) {
    const list = map.get(d.type) ?? [];
    list.push(d);
    map.set(d.type, list);
  }
  return map;
}

function Checklist({ documents, status }: { documents: DriverDocumentDTO[]; status: AdminDriverDetail["profile"]["verificationStatus"] }) {
  const byType = latestByType(documents);
  const states = REQUIRED_DOCS.map((t) => ({ type: t, doc: byType.get(t)?.[0] ?? null }));
  const approved = states.filter((s) => s.doc?.status === "approved").length;
  const ready = approved === REQUIRED_DOCS.length;
  return (
    <Panel title="רשימת אימות" description="מסמכי חובה לאישור נהג">
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-extrabold tabular-nums">
          {approved}/{REQUIRED_DOCS.length}
        </span>
        <span className={cn("text-sm font-bold", ready ? "text-success" : "text-fg-muted")}>{ready ? "מוכן לאישור" : "מסמכים אושרו"}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--fg)_7%,transparent)]" role="progressbar" aria-valuemin={0} aria-valuemax={REQUIRED_DOCS.length} aria-valuenow={approved} aria-label="מסמכים שאושרו">
        <div className={cn("h-full rounded-full transition-all", ready ? "bg-success" : "bg-brand")} style={{ width: `${(approved / REQUIRED_DOCS.length) * 100}%` }} />
      </div>
      <ul className="mt-4 space-y-2.5">
        {states.map(({ type, doc }) => {
          const s = doc?.status;
          return (
            <li key={type} className="flex items-center gap-2.5 text-sm">
              {s === "approved" ? (
                <CheckCircle2 size={18} className="shrink-0 text-success" aria-label="אושר" />
              ) : s === "submitted" ? (
                <Clock3 size={18} className="shrink-0 text-[color-mix(in_oklab,var(--warning)_70%,var(--fg))]" aria-label="ממתין לבדיקה" />
              ) : s === "rejected" ? (
                <XCircle size={18} className="shrink-0 text-danger" aria-label="נדחה" />
              ) : (
                <Circle size={18} className="shrink-0 text-mist" aria-label="לא הועלה" />
              )}
              <span className={cn("min-w-0 flex-1", !doc && "text-fg-muted")}>{DOCUMENT_TYPE_HE[type]}</span>
              <span className="shrink-0 text-xs text-fg-muted">{!doc ? "לא הועלה" : s === "submitted" ? "ממתין" : s === "rejected" ? "נדחה" : "אושר"}</span>
            </li>
          );
        })}
      </ul>
      {!ready && status !== "approved" && <p className="mt-4 text-xs leading-relaxed text-fg-muted">אישור הנהג יתאפשר רק לאחר שכל מסמכי החובה אושרו. השרת יחסום אישור חלקי.</p>}
      {!ready && status === "approved" && (
        <p className="mt-4 rounded-2xl bg-[color-mix(in_oklab,var(--warning)_14%,transparent)] px-3 py-2 text-xs font-semibold leading-relaxed text-[color-mix(in_oklab,var(--warning)_45%,var(--fg))]">
          הנהג מאושר אך חסרים לו מסמכי חובה מאושרים. מומלץ לבקש השלמה ולבדוק.
        </p>
      )}
    </Panel>
  );
}

function DocumentsPanel({ documents, onReview }: { documents: DriverDocumentDTO[]; onReview: (d: DriverDocumentDTO, s: "approved" | "rejected") => void }) {
  const byType = latestByType(documents);
  const types = [...REQUIRED_DOCS, ...OPTIONAL_DOCS, ...[...byType.keys()].filter((t) => !REQUIRED_DOCS.includes(t) && !OPTIONAL_DOCS.includes(t))];
  const pending = documents.filter((d) => d.status === "submitted").length;
  return (
    <Panel title="מסמכים" description={documents.length === 0 ? "הנהג עדיין לא העלה מסמכים" : pending ? (pending === 1 ? "מסמך אחד ממתין לבדיקה" : `${pending} מסמכים ממתינים לבדיקה`) : "כל המסמכים שהועלו נבדקו"} flush>
      <ul className="divide-y divide-line">
        {types.map((type) => {
          const versions = byType.get(type) ?? [];
          const doc = versions[0];
          const required = REQUIRED_DOCS.includes(type);
          return (
            <li key={type} className="px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", doc ? "bg-brand-50 text-brand" : "bg-[color-mix(in_oklab,var(--fg)_5%,transparent)] text-fg-muted")}>
                    <FileText size={19} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{DOCUMENT_TYPE_HE[type]}</span>
                      {!required && <span className="text-xs text-fg-muted">(רשות)</span>}
                      {doc ? <DocumentStatusPill status={doc.status} /> : <Pill tone="muted">לא הועלה</Pill>}
                    </div>
                    {doc ? (
                      <div className="mt-1 text-xs text-fg-muted">
                        <span className="break-all">{doc.fileName}</span> · <span className="tabular-nums">{formatBytes(doc.sizeBytes)}</span> · הועלה {formatRelative(doc.uploadedAt)}
                        {doc.expiresAt && <> · בתוקף עד {formatDate(doc.expiresAt)}</>}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-fg-muted">{required ? "מסמך חובה — הנהג טרם העלה אותו" : "לא חובה"}</div>
                    )}
                    {doc?.reviewNotes && <div className="mt-1.5 text-xs">הערת בודק: {doc.reviewNotes}</div>}
                    {versions.length > 1 && <div className="mt-1 text-xs text-fg-muted">{versions.length - 1} גרסאות קודמות</div>}
                  </div>
                </div>
                {doc && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2 ps-[52px] sm:ps-0">
                    <a href={api.driver.documentUrl(doc.id)} target="_blank" rel="noopener noreferrer" className="btn btn-glass btn-sm h-10">
                      <ExternalLink size={15} aria-hidden />
                      צפייה
                    </a>
                    {doc.status !== "approved" && (
                      <Button size="sm" variant="success" className="h-10" onClick={() => onReview(doc, "approved")}>
                        אישור
                      </Button>
                    )}
                    {doc.status !== "rejected" && (
                      <Button size="sm" variant="ghost" className="h-10 text-danger" onClick={() => onReview(doc, "rejected")}>
                        דחייה
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
