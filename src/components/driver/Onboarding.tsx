"use client";
/** Driver onboarding: 1) vehicle  2) documents  3) verification status. */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, FileCheck2, LogOut, ShieldCheck, Ban, BadgeCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { DriverDocumentDTO, DriverProfileDTO, ServiceTypeDTO } from "@/lib/types";
import { Button, Skeleton, cn, useToast } from "@/components/ui";
import { useSession } from "@/components/app/session";
import { useDriverRuntime } from "./DriverRuntime";
import { DriverPage, Section } from "./DriverPage";
import { VehicleForm, isVehicleComplete } from "./VehicleForm";
import { DocumentsList, missingDocuments } from "./DocumentsList";
import { VerificationCard } from "./VerificationCard";
import { Notice } from "./Notice";
import { errorMessage } from "./errors";
import { firstName } from "./copy";
import { NeedleLoader } from "./motion";

type ProfileData = { profile: DriverProfileDTO; documents: DriverDocumentDTO[]; requiredDocuments: string[] };
type Step = 1 | 2 | 3;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "רכב" },
  { n: 2, label: "מסמכים" },
  { n: 3, label: "סטטוס" },
];

function pickStep(d: ProfileData): Step {
  const s = d.profile.verificationStatus;
  if (s !== "documents_required") return 3;
  if (!isVehicleComplete(d.profile)) return 1;
  if (missingDocuments(d.documents, d.requiredDocuments).length) return 2;
  return 3;
}

export function Onboarding() {
  const { refreshProfile, docsVersion } = useDriverRuntime();
  const { user, logout } = useSession();
  const toast = useToast();
  const [data, setData] = useState<ProfileData | null>(null);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeDTO[] | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const prevStatus = useRef<string | null>(null);

  const apply = useCallback(
    (res: ProfileData, opts: { pickStep?: boolean } = {}) => {
      setLoadError(null);
      setData(res);
      const before = prevStatus.current;
      prevStatus.current = res.profile.verificationStatus;
      if (opts.pickStep) setStep(pickStep(res));
      else if (before && before !== res.profile.verificationStatus) {
        if (res.profile.verificationStatus === "under_review") toast.success("כל המסמכים התקבלו", "הבקשה נשלחה לבדיקה של צוות HOP");
        setStep(3);
        void refreshProfile();
      }
    },
    [refreshProfile, toast],
  );

  const load = useCallback(
    (opts: { pickStep?: boolean } = {}) =>
      api.driver
        .profile()
        .then((res) => apply(res, opts))
        .catch((err: unknown) => setLoadError(errorMessage(err))),
    [apply],
  );

  useEffect(() => {
    void load({ pickStep: true });
    api
      .serviceTypes()
      .then((r) => setServiceTypes(r.serviceTypes))
      .catch(() => setServiceTypes([]));
  }, [load]);

  useEffect(() => {
    if (docsVersion > 0) void load();
  }, [docsVersion, load]);

  const profile = data?.profile ?? null;
  const missing = data ? missingDocuments(data.documents, data.requiredDocuments) : [];
  const approved = profile?.verificationStatus === "approved";
  const vehicleDone = profile ? isVehicleComplete(profile) : false;
  const docsDone = data ? missing.length === 0 : false;

  return (
    <DriverPage
      title="הצטרפות לנהגי HOP"
      subtitle={profile ? (approved ? "החשבון מאושר" : "שלושה צעדים קצרים ואתם על הכביש") : undefined}
      back={approved ? "/drive" : null}
      wide
      actions={
        <button type="button" onClick={() => void logout()} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-fg-muted hover:text-fg" aria-label="התנתקות">
          <LogOut size={18} aria-hidden />
          <span className="hidden sm:inline">התנתקות</span>
        </button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="grid gap-5">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="display text-[1.9rem] leading-tight">
              {user ? `ברוכים הבאים, ${firstName(user.name)}` : "ברוכים הבאים"}
              <span className="text-[#8fb0ff]">.</span>
            </h2>
            <p className="mt-1 text-sm text-fg-muted">ממלאים פרטי רכב, מעלים מסמכים — וצוות HOP בודק ומאשר. רק אז אפשר לקבל נסיעות.</p>
          </motion.div>

          {/* stepper */}
          <nav aria-label="שלבי ההצטרפות">
            <ol className="grid grid-cols-3 gap-2">
              {STEPS.map(({ n, label }) => {
                const done = n === 1 ? vehicleDone : n === 2 ? docsDone : approved;
                const active = step === n;
                return (
                  <li key={n}>
                    <button
                      type="button"
                      onClick={() => setStep(n)}
                      disabled={!data}
                      aria-current={active ? "step" : undefined}
                      className={cn(
                        "relative flex min-h-14 w-full items-center gap-2 overflow-hidden rounded-2xl border px-2.5 text-start text-sm font-bold transition-colors sm:px-3",
                        active ? "border-brand bg-brand/15 text-fg" : "border-line bg-[color-mix(in_oklab,var(--fg)_4%,transparent)] text-fg-muted hover:text-fg",
                      )}
                      data-testid={`step-${n}`}
                    >
                      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold", done ? "bg-success text-white" : active ? "bg-brand text-white" : "bg-[color-mix(in_oklab,var(--fg)_12%,transparent)]")}>
                        {done ? <Check size={15} strokeWidth={3} aria-hidden /> : n}
                      </span>
                      <span className="truncate">{label}</span>
                      {active && <motion.span layoutId="onb-step" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {loadError && (
            <Notice tone="danger" live title="לא הצלחנו לטעון את הפרטים" action={<Button size="sm" variant="glass" onClick={() => void load({ pickStep: true })}>ניסיון נוסף</Button>}>
              {loadError}
            </Notice>
          )}

          {!data ? (
            <div className="card grid gap-3 p-5" aria-busy>
              <div className="flex items-center gap-3">
                <NeedleLoader size={36} />
                <span className="text-sm text-fg-muted">טוענים את הפרטים שלך…</span>
              </div>
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ type: "spring", stiffness: 360, damping: 34 }}>
                {step === 1 && profile && (
                  <Section title="פרטי הרכב" description="הרכב שאיתו תסיעו נוסעים. הפרטים יוצגו לנוסע כדי שיזהה אתכם.">
                    <VehicleForm
                      profile={profile}
                      serviceTypes={serviceTypes}
                      submitLabel="שמירה והמשך למסמכים"
                      onSaved={(p) => {
                        setData((d) => (d ? { ...d, profile: p } : d));
                        void refreshProfile();
                        setStep(p.verificationStatus === "documents_required" || p.verificationStatus === "rejected" ? 2 : 3);
                      }}
                    />
                  </Section>
                )}
                {step === 2 && profile && data && (
                  <Section title="מסמכים" description="צלמו או העלו כל מסמך. ברגע שכל המסמכים יתקבלו — הבקשה עוברת אוטומטית לבדיקה.">
                    <DocumentsList documents={data.documents} requiredDocuments={data.requiredDocuments} verificationStatus={profile.verificationStatus} onUploaded={() => void load()} />
                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      <Button variant="ghost" onClick={() => setStep(1)}>
                        חזרה לפרטי הרכב
                      </Button>
                      <Button size="lg" onClick={() => setStep(3)} data-testid="docs-continue">
                        {docsDone ? "המשך לסטטוס" : `המשך (${missing.length} חסרים)`}
                        <ArrowLeft size={18} aria-hidden />
                      </Button>
                    </div>
                  </Section>
                )}
                {step === 3 && profile && (
                  <div className="grid gap-4">
                    <VerificationCard profile={profile} missing={missing} onFix={() => setStep(missing.length || profile.verificationStatus !== "rejected" ? 2 : 1)} />
                    {approved && (
                      <Link href="/drive" className="btn btn-primary btn-lg btn-block lg:hidden">
                        התחלת נהיגה
                      </Link>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <aside className="grid gap-3 lg:sticky lg:top-24">
          <div className="glass glass-md p-5">
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <ShieldCheck size={20} className="text-[#8fb0ff]" aria-hidden /> חשוב לדעת לפני שמתחילים
            </h2>
            <ul className="mt-3 grid gap-3 text-sm">
              <li className="flex gap-3">
                <BadgeCheck size={18} className="mt-0.5 shrink-0 text-[#8fb0ff]" aria-hidden />
                <span>
                  <b>נדרש רישיון להסעת נוסעים בשכר</b> — רישיון מונית או היתר של משרד התחבורה.
                </span>
              </li>
              <li className="flex gap-3">
                <Ban size={18} className="mt-0.5 shrink-0 text-[#ff8a8d]" aria-hidden />
                <span>
                  <b>אין נסיעות ברכב פרטי.</b> HOP מפעילה רק שירותים מורשים.
                </span>
              </li>
              <li className="flex gap-3">
                <FileCheck2 size={18} className="mt-0.5 shrink-0 text-[#8fb0ff]" aria-hidden />
                <span>ביטוח חובה וצד ג&apos; שמכסה הסעת נוסעים, ורישיון רכב בתוקף.</span>
              </li>
              <li className="flex gap-3">
                <Check size={18} className="mt-0.5 shrink-0 text-success" aria-hidden />
                <span>
                  <b>ניתן לקבל נסיעות רק לאחר אישור</b> החשבון והמסמכים על ידי צוות HOP.
                </span>
              </li>
            </ul>
          </div>
          <p className="px-1 text-xs text-fg-muted">
            שאלה? <Link href="/drive/support" className="font-bold text-fg underline-offset-4 hover:underline">צוות התמיכה כאן בשבילך</Link>
          </p>
        </aside>
      </div>
    </DriverPage>
  );
}
