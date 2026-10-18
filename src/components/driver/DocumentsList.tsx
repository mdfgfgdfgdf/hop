"use client";
/** Required driver documents: status per type + camera/file upload with optional expiry. */
import { useId, useState } from "react";
import { motion } from "motion/react";
import { Camera, CheckCircle2, Clock3, ExternalLink, FileUp, IdCard, ShieldCheck, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { DOCUMENT_STATUS_HE, DOCUMENT_TYPE_HE } from "@/lib/labels";
import type { DocumentType, DriverDocumentDTO, VerificationStatus } from "@/lib/types";
import { Pill, cn, useToast } from "@/components/ui";
import { errorMessage } from "./errors";
import { NeedleLoader, StaggerItem, StaggerList } from "./motion";

const HINTS: Record<DocumentType, string> = {
  id_card: "צילום ברור של תעודת הזהות כולל הספח",
  drivers_license: "רישיון נהיגה בתוקף, שני הצדדים",
  taxi_driver_permit: "היתר משרד התחבורה להסעת נוסעים בשכר",
  taxi_license_number: "רישיון המונית (המספר הירוק) על שמכם או על שם המעסיק",
  vehicle_registration: "רישיון הרכב (רישיון שנתי) בתוקף",
  insurance: "פוליסת חובה וצד ג' שמכסה הסעת נוסעים בשכר",
  vehicle_photo: "תמונה של הרכב מבחוץ, כולל לוחית הרישוי",
};

/** Types that usually carry an expiry date. */
const EXPIRING = new Set<DocumentType>(["drivers_license", "taxi_driver_permit", "vehicle_registration", "insurance"]);

export function latestByType(documents: DriverDocumentDTO[]) {
  const map = new Map<string, DriverDocumentDTO>();
  for (const d of [...documents].sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))) if (!map.has(d.type)) map.set(d.type, d);
  return map;
}

export function missingDocuments(documents: DriverDocumentDTO[], required: string[]) {
  const latest = latestByType(documents);
  return required.filter((t) => {
    const d = latest.get(t);
    return !d || d.status === "rejected";
  });
}

export function DocumentsList({
  documents,
  requiredDocuments,
  verificationStatus,
  onUploaded,
  includeOptional = true,
}: {
  documents: DriverDocumentDTO[];
  requiredDocuments: string[];
  verificationStatus: VerificationStatus;
  onUploaded: () => void;
  includeOptional?: boolean;
}) {
  const latest = latestByType(documents);
  const types = [...requiredDocuments, ...(includeOptional && !requiredDocuments.includes("vehicle_photo") ? ["vehicle_photo"] : [])] as DocumentType[];
  const done = requiredDocuments.filter((t) => {
    const d = latest.get(t);
    return d && d.status !== "rejected";
  }).length;
  const pct = requiredDocuments.length ? done / requiredDocuments.length : 1;

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--fg)_10%,transparent)]" aria-hidden>
          <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 22 }} />
        </div>
        <span className="text-xs font-bold text-fg-muted tabular-nums" data-testid="docs-progress">
          {done}/{requiredDocuments.length} הועלו
        </span>
      </div>
      <StaggerList className="grid gap-2">
        {types.map((t) => (
          <StaggerItem key={t}>
            <DocumentRow type={t} doc={latest.get(t) ?? null} required={requiredDocuments.includes(t)} approvedAccount={verificationStatus === "approved"} onUploaded={onUploaded} />
          </StaggerItem>
        ))}
      </StaggerList>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-muted">
        <ShieldCheck size={15} className="mt-0.5 shrink-0" aria-hidden />
        הקבצים נשמרים בצורה מאובטחת ונבדקים רק על ידי צוות HOP. תמונה (JPG/PNG/WebP) או PDF, עד 8MB.
      </p>
    </div>
  );
}

function DocumentRow({ type, doc, required, approvedAccount, onUploaded }: { type: DocumentType; doc: DriverDocumentDTO | null; required: boolean; approvedAccount: boolean; onUploaded: () => void }) {
  const toast = useToast();
  const id = useId();
  const [expiry, setExpiry] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > 8 * 1024 * 1024) {
      setError("הקובץ גדול מדי — עד 8MB. נסו לצלם שוב ברזולוציה נמוכה יותר.");
      return;
    }
    setUploading(true);
    try {
      await api.driver.uploadDocument(type, file, expiry ? new Date(`${expiry}T12:00:00`).toISOString() : null);
      toast.success("המסמך הועלה", `${DOCUMENT_TYPE_HE[type]} נשלח לבדיקה`);
      setExpiry("");
      onUploaded();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  const status = doc?.status ?? null;
  const tone = status === "approved" ? "success" : status === "rejected" ? "danger" : status === "submitted" ? "warning" : "muted";
  const StatusIcon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : status === "submitted" ? Clock3 : IdCard;
  const iconTone = status === "approved" ? "text-success" : status === "rejected" ? "text-[#ff8a8d]" : status === "submitted" ? "text-warning" : "text-fg-muted";

  return (
    <div className={cn("rounded-2xl border p-3.5", status === "rejected" ? "border-danger/40 bg-danger/8" : "border-line bg-[color-mix(in_oklab,var(--fg)_4%,transparent)]")} data-testid={`doc-${type}`}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--fg)_7%,transparent)]", iconTone)}>
          <StatusIcon size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold">{DOCUMENT_TYPE_HE[type]}</span>
            {!required && <span className="text-[11px] font-semibold text-fg-muted">(רשות)</span>}
            <Pill tone={tone} className="h-6 text-[11px]">
              {status ? DOCUMENT_STATUS_HE[status] : approvedAccount ? "אין קובץ במערכת" : "חסר"}
            </Pill>
          </div>
          <div className="mt-0.5 text-xs text-fg-muted">{HINTS[type]}</div>
          {doc && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
              <a href={api.driver.documentUrl(doc.id)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 max-w-[14rem] items-center gap-1 font-semibold text-fg underline-offset-4 hover:underline">
                <span className="truncate" dir="ltr">
                  {doc.fileName}
                </span>
                <ExternalLink size={12} aria-hidden />
              </a>
              <span>הועלה {formatDate(doc.uploadedAt)}</span>
              {doc.expiresAt && <span>בתוקף עד {formatDate(doc.expiresAt)}</span>}
            </div>
          )}
          {status === "rejected" && doc?.reviewNotes && (
            <div className="mt-2 rounded-xl bg-danger/12 px-3 py-2 text-xs font-semibold text-[#ffb3b5]" role="note">
              סיבת הדחייה: {doc.reviewNotes}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        {EXPIRING.has(type) && (
          <label className="grid min-w-[9.5rem] flex-1 gap-1 text-[11px] font-bold text-fg-muted" htmlFor={`${id}-exp`}>
            תאריך תפוגה (לא חובה)
            <input id={`${id}-exp`} type="date" dir="ltr" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="input h-12 text-start text-sm [color-scheme:dark]" />
          </label>
        )}
        <div className="flex flex-1 gap-2">
          <label className={cn("btn h-12 flex-1 cursor-pointer gap-2 px-4 text-sm", doc && status !== "rejected" ? "btn-glass" : "border border-brand/45 bg-brand/20 text-[#dbe4ff] hover:bg-brand/30", uploading && "pointer-events-none opacity-70")}>
            {uploading ? <NeedleLoader size={22} tone="white" label="מעלה…" /> : <Camera size={18} aria-hidden />}
            {uploading ? "מעלה…" : doc ? "צילום חדש" : "צילום"}
            <input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" disabled={uploading} onChange={(e) => void upload(e.target.files?.[0]).finally(() => (e.target.value = ""))} data-testid={`upload-${type}`} />
          </label>
          <label className={cn("btn btn-glass h-12 cursor-pointer gap-2 px-4 text-sm", uploading && "pointer-events-none opacity-70")}>
            <FileUp size={18} aria-hidden />
            מהקבצים
            <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={uploading} onChange={(e) => void upload(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
          </label>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs font-semibold text-[#ff8a8d]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
