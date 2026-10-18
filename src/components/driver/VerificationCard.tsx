"use client";
/** Verification status, explained in human words, with the next action. */
import Link from "next/link";
import { motion } from "motion/react";
import { BadgeCheck, CircleAlert, Ban, FileWarning } from "lucide-react";
import { DOCUMENT_TYPE_HE } from "@/lib/labels";
import type { DriverProfileDTO } from "@/lib/types";
import { Button, cn } from "@/components/ui";
import { NeedleLoader } from "./motion";

export function VerificationCard({ profile, missing, onFix, compact }: { profile: DriverProfileDTO; missing: string[]; onFix?: () => void; compact?: boolean }) {
  const s = profile.verificationStatus;
  const shell = (tone: string, icon: React.ReactNode, title: string, body: React.ReactNode, action?: React.ReactNode) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={cn("rounded-[26px] border p-5", tone, compact ? "" : "text-center")}
      role="status"
      data-testid="verification-status"
      data-status={s}
    >
      <div className={cn("flex gap-4", compact ? "items-start" : "flex-col items-center")}>
        <div className="shrink-0">{icon}</div>
        <div className="min-w-0">
          <h2 className={cn("display", compact ? "text-lg" : "text-2xl")}>{title}</h2>
          <div className="mt-1.5 text-sm leading-relaxed text-fg-muted">{body}</div>
          {action && <div className={cn("mt-4", !compact && "flex justify-center")}>{action}</div>}
        </div>
      </div>
    </motion.div>
  );
  const size = compact ? 44 : 72;

  if (s === "approved")
    return shell(
      "border-success/35 bg-success/10",
      <span className="grid place-items-center rounded-full bg-success/20 text-success" style={{ width: size, height: size }}>
        <BadgeCheck size={size * 0.55} aria-hidden />
      </span>,
      "החשבון מאושר",
      "אפשר לעבור למצב זמין ולהתחיל לקבל נסיעות. נסיעה טובה!",
      !compact && (
        <Link href="/drive" className="btn btn-primary btn-lg">
          למסך הנהיגה
        </Link>
      ),
    );
  if (s === "under_review")
    return shell(
      "border-brand/35 bg-brand/10",
      <span className="grid place-items-center rounded-full bg-brand/15" style={{ width: size, height: size }}>
        <NeedleLoader size={size * 0.7} label="בבדיקה" />
      </span>,
      "המסמכים בבדיקה — נעדכן אותך",
      <>
        צוות HOP בודק את הפרטים והמסמכים שהעלית. ברגע שהבדיקה תסתיים נעדכן אותך כאן — אין צורך לעשות דבר בינתיים.
        <br />
        ניתן לקבל נסיעות רק לאחר האישור.
      </>,
    );
  if (s === "rejected")
    return shell(
      "border-danger/40 bg-danger/10",
      <span className="grid place-items-center rounded-full bg-danger/15 text-[#ff8a8d]" style={{ width: size, height: size }}>
        <CircleAlert size={size * 0.55} aria-hidden />
      </span>,
      "הבקשה לא אושרה — אפשר לתקן",
      <>
        {profile.rejectionReason ? (
          <span className="mb-2 block rounded-xl bg-danger/12 px-3 py-2 text-start font-semibold text-[#ffb3b5]">סיבה: {profile.rejectionReason}</span>
        ) : null}
        עדכנו את הפרטים או העלו מחדש את המסמכים שסומנו — ונבדוק שוב.
      </>,
      onFix && (
        <Button size="lg" onClick={onFix}>
          לתיקון והעלאה מחדש
        </Button>
      ),
    );
  if (s === "suspended")
    return shell(
      "border-danger/40 bg-danger/10",
      <span className="grid place-items-center rounded-full bg-danger/15 text-[#ff8a8d]" style={{ width: size, height: size }}>
        <Ban size={size * 0.5} aria-hidden />
      </span>,
      "החשבון מושעה",
      <>
        {profile.rejectionReason || profile.reviewNotes ? <span className="mb-2 block font-semibold text-fg">{profile.rejectionReason ?? profile.reviewNotes}</span> : null}
        בזמן ההשעיה לא ניתן לקבל נסיעות. לבירור — פנו לצוות התמיכה.
      </>,
      <Link href="/drive/support" className="btn btn-glass">
        פנייה לתמיכה
      </Link>,
    );
  return shell(
    "border-warning/40 bg-warning/10",
    <span className="grid place-items-center rounded-full bg-warning/15 text-warning" style={{ width: size, height: size }}>
      <FileWarning size={size * 0.5} aria-hidden />
    </span>,
    missing.length ? `חסרים עוד ${missing.length} מסמכים` : "כמעט שם",
    missing.length ? (
      <>
        כדי לשלוח את הבקשה לבדיקה צריך להעלות: <span className="font-semibold text-fg">{missing.map((t) => DOCUMENT_TYPE_HE[t as keyof typeof DOCUMENT_TYPE_HE] ?? t).join(", ")}</span>.
      </>
    ) : (
      "השלימו את פרטי הרכב והמסמכים כדי לשלוח את הבקשה לבדיקה."
    ),
    onFix && (
      <Button size="lg" onClick={onFix}>
        להשלמת המסמכים
      </Button>
    ),
  );
}
