"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Calculator, History, Moon, Save, Sun, Undo2 } from "lucide-react";
import { api, type PricingConfigDTO } from "@/lib/api";
import { formatDateTime, formatILS, percentFromBp } from "@/lib/format";
import { VEHICLE_CLASS_HE } from "@/lib/labels";
import { ilsToAgorot } from "@/lib/money";
import type { ServiceTypeDTO, VehicleClass } from "@/lib/types";
import { Button, DemoBanner, Pill, Select, Toggle, useToast, cn } from "@/components/ui";
import { useAdmin } from "../context";
import { errorMessage, useLoad, useStaffDirectory } from "../hooks";
import { DataTable, DetailSkeleton, ErrorState, InlineError, Muted, Page, PageHeader, Panel } from "../ui";
import { AdminOnlyNote } from "../pills";
import { useConfirm } from "../Dialog";
import { FormSection, UnitField, parseNum } from "../form";
import { SPRING } from "../motion";
import { PAYOUT_COLOR } from "../tokens";

// ───────────── form model (strings while editing; ₪ / % for humans, agorot / bp for the API) ─────────────

type Form = {
  name: string;
  baseFare: string;
  perKm: string;
  perMinute: string;
  bookingFee: string;
  minFare: string;
  maxFare: string;
  commissionPct: string;
  commissionFixed: string;
  cancellationFee: string;
  freeCancelWindowSec: string;
  nightPct: string;
  nightStart: string;
  nightEnd: string;
  rounding: string;
  quoteTtlSec: string;
  notes: string;
  isDemo: boolean;
};

const ils = (agorot: number) => (agorot / 100).toFixed(2).replace(/\.00$/, "");
const pct = (bp: number) => String(bp / 100);

function toForm(c: PricingConfigDTO): Form {
  return {
    name: c.name,
    baseFare: ils(c.baseFareAgorot),
    perKm: ils(c.perKmAgorot),
    perMinute: ils(c.perMinuteAgorot),
    bookingFee: ils(c.bookingFeeAgorot),
    minFare: ils(c.minFareAgorot),
    maxFare: ils(c.maxFareAgorot),
    commissionPct: pct(c.commissionPercentBp),
    commissionFixed: ils(c.commissionFixedAgorot),
    cancellationFee: ils(c.cancellationFeeAgorot),
    freeCancelWindowSec: String(c.freeCancelWindowSec),
    nightPct: pct(c.nightMultiplierBp),
    nightStart: c.nightStart,
    nightEnd: c.nightEnd,
    rounding: String(c.roundingAgorot),
    quoteTtlSec: String(c.quoteTtlSec),
    notes: c.notes ?? "",
    isDemo: c.isDemo,
  };
}

type Parsed = Omit<PricingConfigDTO, "id" | "active" | "currency" | "updatedBy" | "createdAt" | "updatedAt">;
type Errors = Partial<Record<keyof Form, string>>;

function parseForm(f: Form): { value: Parsed | null; errors: Errors } {
  const errors: Errors = {};
  const money = (k: keyof Form, opts: { min?: number } = {}) => {
    const n = parseNum(f[k] as string);
    if (!Number.isFinite(n) || n < 0) {
      errors[k] = "הזינו סכום בשקלים (0 ומעלה)";
      return 0;
    }
    if (opts.min !== undefined && n < opts.min) errors[k] = `מינימום ${opts.min} ₪`;
    return ilsToAgorot(n);
  };
  const int = (k: keyof Form, min: number, max: number, msg: string) => {
    const n = parseNum(f[k] as string);
    if (!Number.isInteger(n) || n < min || n > max) {
      errors[k] = msg;
      return min;
    }
    return n;
  };
  const percent = (k: keyof Form, min: number, max: number) => {
    const n = parseNum(f[k] as string);
    if (!Number.isFinite(n) || n < min || n > max) {
      errors[k] = `ערך בין ${min}% ל-${max}%`;
      return min * 100;
    }
    return Math.round(n * 100);
  };
  const value: Parsed = {
    name: f.name.trim(),
    isDemo: f.isDemo,
    baseFareAgorot: money("baseFare"),
    perKmAgorot: money("perKm"),
    perMinuteAgorot: money("perMinute"),
    bookingFeeAgorot: money("bookingFee"),
    minFareAgorot: money("minFare"),
    maxFareAgorot: money("maxFare"),
    commissionPercentBp: percent("commissionPct", 0, 50),
    commissionFixedAgorot: money("commissionFixed"),
    cancellationFeeAgorot: money("cancellationFee"),
    freeCancelWindowSec: int("freeCancelWindowSec", 0, 3600, "בין 0 ל-3600 שניות"),
    nightMultiplierBp: percent("nightPct", 100, 300),
    nightStart: f.nightStart,
    nightEnd: f.nightEnd,
    roundingAgorot: int("rounding", 1, 100, "בין 1 ל-100 אגורות"),
    quoteTtlSec: int("quoteTtlSec", 30, 3600, "בין 30 ל-3600 שניות"),
    notes: f.notes.trim() || null,
  };
  if (value.name.length < 2) errors.name = "שם התעריף קצר מדי";
  if (!/^\d{2}:\d{2}$/.test(f.nightStart)) errors.nightStart = "שעה בפורמט HH:MM";
  if (!/^\d{2}:\d{2}$/.test(f.nightEnd)) errors.nightEnd = "שעה בפורמט HH:MM";
  if (!errors.minFare && !errors.maxFare && value.minFareAgorot > value.maxFareAgorot) errors.minFare = "מחיר המינימום גבוה ממחיר המקסימום";
  return { value: Object.keys(errors).length ? null : value, errors };
}

const FIELD_HE: Partial<Record<keyof Parsed, string>> = {
  name: "שם התעריף",
  isDemo: "תעריף הדגמה",
  baseFareAgorot: "דמי התחלה",
  perKmAgorot: "מחיר לק״מ",
  perMinuteAgorot: "מחיר לדקה",
  bookingFeeAgorot: "דמי הזמנה",
  minFareAgorot: "מחיר מינימום",
  maxFareAgorot: "מחיר מקסימום",
  commissionPercentBp: "עמלת HOP (%)",
  commissionFixedAgorot: "עמלה קבועה",
  cancellationFeeAgorot: "דמי ביטול",
  freeCancelWindowSec: "חלון ביטול ללא עלות",
  nightMultiplierBp: "מכפיל לילה",
  nightStart: "תחילת לילה",
  nightEnd: "סוף לילה",
  roundingAgorot: "עיגול",
  quoteTtlSec: "תוקף הצעת מחיר",
  notes: "הערות",
};

function displayValue(k: keyof Parsed, v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "כן" : "לא";
  if (k.endsWith("Agorot")) return formatILS(v as number);
  if (k.endsWith("Bp")) return percentFromBp(v as number);
  if (k.endsWith("Sec")) return `${v} שנ׳`;
  return String(v);
}

// ───────────── fare preview (mirrors computeFare in src/server/pricing/engine.ts) ─────────────

function roundTo(amount: number, step: number) {
  return step <= 1 ? Math.round(amount) : Math.round(amount / step) * step;
}

export function previewFare(c: Parsed, opts: { distanceM: number; durationS: number; serviceMultiplierBp: number; night: boolean }) {
  const km = opts.distanceM / 1000;
  const minutes = opts.durationS / 60;
  const lines: { label: string; amount: number }[] = [];
  const distance = Math.round(km * c.perKmAgorot);
  const time = Math.round(minutes * c.perMinuteAgorot);
  lines.push({ label: "דמי התחלה", amount: c.baseFareAgorot }, { label: `מרחק (${km.toFixed(1)} ק"מ)`, amount: distance }, { label: `זמן (${Math.round(minutes)} דק')`, amount: time });
  let fare = c.baseFareAgorot + distance + time;
  if (opts.night && c.nightMultiplierBp !== 10000) {
    const extra = Math.round((fare * (c.nightMultiplierBp - 10000)) / 10000);
    lines.push({ label: "תוספת לילה", amount: extra });
    fare += extra;
  }
  if (opts.serviceMultiplierBp !== 10000) {
    const extra = Math.round((fare * (opts.serviceMultiplierBp - 10000)) / 10000);
    lines.push({ label: "תוספת סוג שירות", amount: extra });
    fare += extra;
  }
  if (fare < c.minFareAgorot) {
    lines.push({ label: "השלמה למחיר מינימום", amount: c.minFareAgorot - fare });
    fare = c.minFareAgorot;
  }
  if (fare > c.maxFareAgorot) {
    lines.push({ label: "הגבלת מחיר מקסימום", amount: c.maxFareAgorot - fare });
    fare = c.maxFareAgorot;
  }
  if (c.bookingFeeAgorot > 0) lines.push({ label: "דמי הזמנה", amount: c.bookingFeeAgorot });
  const riderTotal = roundTo(fare + c.bookingFeeAgorot, c.roundingAgorot);
  const commission = Math.round((fare * c.commissionPercentBp) / 10000) + c.commissionFixedAgorot;
  const hop = Math.max(0, Math.min(riderTotal, commission + c.bookingFeeAgorot));
  return { lines, riderTotal, hop, payout: riderTotal - hop };
}

// ───────────── screen ─────────────

export function Pricing() {
  const { isAdmin } = useAdmin();
  const { data, error, loading, reload } = useLoad("pricing", () => api.admin.pricing());
  const services = useLoad("service-types-admin", () => api.admin.serviceTypes());

  if (loading)
    return (
      <Page>
        <DetailSkeleton />
      </Page>
    );
  if (!data)
    return (
      <Page>
        <PageHeader title="תמחור ושירותים" />
        <div className="card">
          <ErrorState message={error ?? "לא נמצא תעריף"} onRetry={reload} />
        </div>
      </Page>
    );

  return (
    <Page>
      <PageHeader
        title="תמחור ושירותים"
        description="התעריף הפעיל וסוגי השירות. כל שמירה יוצרת גרסת תעריף חדשה; גרסאות קודמות נשמרות לביקורת."
        meta={
          <>
            {data.active?.isDemo && <DemoBanner text="תעריף הדגמה — אינו תעריף רשמי" />}
            {!isAdmin && <AdminOnlyNote />}
          </>
        }
      />
      {data.active ? (
        <TariffEditor key={data.active.id} active={data.active} services={services.data?.serviceTypes ?? []} readOnly={!isAdmin} onSaved={reload} />
      ) : (
        <div className="card p-6 text-sm text-fg-muted">אין תעריף פעיל במערכת.</div>
      )}
      <ServiceTypesPanel data={services.data?.serviceTypes} loading={services.loading} error={services.error} readOnly={!isAdmin} onChanged={services.reload} />
      <HistoryPanel history={data.history} />
    </Page>
  );
}

function TariffEditor({ active, services, readOnly, onSaved }: { active: PricingConfigDTO; services: ServiceTypeDTO[]; readOnly: boolean; onSaved: () => void }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const initial = useMemo(() => toForm(active), [active]);
  const [form, setForm] = useState<Form>(initial);
  const [touched, setTouched] = useState(false);
  const { value, errors } = parseForm(form);
  const base = parseForm(initial).value!;
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => {
    setTouched(true);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const changes = value ? (Object.keys(value) as (keyof Parsed)[]).filter((k) => value[k] !== base[k]).map((k) => ({ key: k, from: base[k], to: value[k] })) : [];
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const show = (k: keyof Form) => (touched ? errors[k] : null);

  const save = () => {
    if (!value || !changes.length) return;
    const turningOffDemo = base.isDemo && !value.isDemo;
    confirm({
      title: "לשמור כגרסת תעריף חדשה?",
      description: "הגרסה החדשה תחול מיד על הצעות מחיר חדשות. נסיעות קיימות נשארות עם המחיר שהוצע להן.",
      confirmLabel: "שמירת גרסה חדשה",
      tone: turningOffDemo ? "danger" : "primary",
      children: (
        <div className="space-y-3">
          <ul className="divide-y divide-line rounded-2xl border border-line text-sm">
            {changes.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-3 px-3.5 py-2">
                <span className="font-semibold">{FIELD_HE[c.key] ?? c.key}</span>
                <span className="flex min-w-0 items-center gap-2 tabular-nums">
                  <span className="truncate text-fg-muted line-through">{displayValue(c.key, c.from)}</span>
                  <span aria-hidden>←</span>
                  <span className="truncate font-bold">{displayValue(c.key, c.to)}</span>
                </span>
              </li>
            ))}
          </ul>
          {turningOffDemo && (
            <div className="flex gap-2 rounded-2xl bg-[color-mix(in_oklab,var(--danger)_9%,transparent)] p-3 text-sm text-danger">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <strong>התעריף יוצג כרשמי.</strong> נוסעים ונהגים לא יראו יותר תווית ״תעריף הדגמה״. בצעו זאת רק לאחר אישור עסקי ורגולטורי.
              </span>
            </div>
          )}
        </div>
      ),
      onConfirm: async () => {
        await api.admin.updatePricing(value);
        toast.success("נשמרה גרסת תעריף חדשה");
        onSaved();
      },
    });
  };

  const svcOptions = services.length ? services : [];
  const ro = readOnly;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Panel title="התעריף הפעיל" description={`גרסה מ־${formatDateTime(active.createdAt)}`} flush>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            save();
          }}
        >
          <FormSection title="כללי">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field sm:col-span-2">
                <label htmlFor="tariff-name" className="field-label">
                  שם התעריף
                </label>
                <input id="tariff-name" className="input h-11 bg-surface disabled:opacity-60" value={form.name} disabled={ro} onChange={(e) => set("name")(e.target.value)} aria-invalid={show("name") ? true : undefined} />
                {show("name") && <div className="field-error">{show("name")}</div>}
              </div>
            </div>
            <div
              className={cn(
                "mt-4 flex items-start gap-3 rounded-2xl border p-4",
                form.isDemo ? "border-[color-mix(in_oklab,var(--brand)_22%,transparent)] bg-brand-50" : "border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger)_6%,var(--surface))]",
              )}
            >
              <Toggle checked={form.isDemo} onChange={set("isDemo")} disabled={ro} label="תעריף הדגמה" />
              <div className="min-w-0 text-sm">
                <div className="font-bold">{form.isDemo ? "תעריף הדגמה (מסומן לכולם)" : "תעריף רשמי"}</div>
                <p className="mt-0.5 leading-relaxed text-fg-muted">
                  {form.isDemo ? "הנוסעים והנהגים רואים תווית ״תעריף הדגמה״ ליד כל מחיר." : "כיבוי מציג את התעריף כרשמי — ללא תווית הדגמה. עשו זאת רק לאחר אישור עסקי ורגולטורי."}
                </p>
              </div>
            </div>
          </FormSection>
          <FormSection title="מחיר הנסיעה" description="מחושב בשרת: התחלה + מרחק + זמן, ואז מכפילים, מינימום/מקסימום ודמי הזמנה.">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <UnitField label="דמי התחלה" unit="₪" value={form.baseFare} onChange={set("baseFare")} error={show("baseFare")} disabled={ro} />
              <UnitField label="מחיר לק״מ" unit="₪" value={form.perKm} onChange={set("perKm")} error={show("perKm")} disabled={ro} />
              <UnitField label="מחיר לדקה" unit="₪" value={form.perMinute} onChange={set("perMinute")} error={show("perMinute")} disabled={ro} />
              <UnitField label="דמי הזמנה" unit="₪" value={form.bookingFee} onChange={set("bookingFee")} error={show("bookingFee")} hint="ל-HOP במלואם" disabled={ro} />
              <UnitField label="מחיר מינימום" unit="₪" value={form.minFare} onChange={set("minFare")} error={show("minFare")} hint="לפני דמי הזמנה" disabled={ro} />
              <UnitField label="מחיר מקסימום" unit="₪" value={form.maxFare} onChange={set("maxFare")} error={show("maxFare")} disabled={ro} />
            </div>
          </FormSection>
          <FormSection title="עמלת HOP" description="נגבית ממחיר הנסיעה (ללא דמי ההזמנה). הנהג מקבל את היתרה.">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <UnitField label="עמלה באחוזים" unit="%" value={form.commissionPct} onChange={set("commissionPct")} error={show("commissionPct")} hint="0%–50%" disabled={ro} />
              <UnitField label="עמלה קבועה לנסיעה" unit="₪" value={form.commissionFixed} onChange={set("commissionFixed")} error={show("commissionFixed")} disabled={ro} />
            </div>
          </FormSection>
          <FormSection title="תעריף לילה" description="שעון ישראל. אם השעה הסופית מוקדמת מההתחלה — החלון חוצה חצות.">
            <div className="grid gap-4 sm:grid-cols-3">
              <UnitField label="מכפיל לילה" unit="%" value={form.nightPct} onChange={set("nightPct")} error={show("nightPct")} hint="100% = ללא תוספת" disabled={ro} />
              <UnitField label="תחילת לילה" type="time" value={form.nightStart} onChange={set("nightStart")} error={show("nightStart")} disabled={ro} />
              <UnitField label="סוף לילה" type="time" value={form.nightEnd} onChange={set("nightEnd")} error={show("nightEnd")} disabled={ro} />
            </div>
          </FormSection>
          <FormSection title="ביטולים">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <UnitField label="דמי ביטול" unit="₪" value={form.cancellationFee} onChange={set("cancellationFee")} error={show("cancellationFee")} hint="לא יותר מהמחיר שהוצע" disabled={ro} />
              <UnitField
                label="ביטול ללא עלות"
                unit="שנ׳"
                inputMode="numeric"
                value={form.freeCancelWindowSec}
                onChange={set("freeCancelWindowSec")}
                error={show("freeCancelWindowSec")}
                hint={Number.isFinite(parseNum(form.freeCancelWindowSec)) ? `${(parseNum(form.freeCancelWindowSec) / 60).toFixed(1).replace(/\.0$/, "")} דק׳ מאישור הנהג` : undefined}
                disabled={ro}
              />
            </div>
          </FormSection>
          <FormSection title="הצעות מחיר ועיגול">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="field">
                <label htmlFor="rounding" className="field-label">
                  עיגול המחיר לנוסע
                </label>
                <Select id="rounding" className="h-11 bg-surface disabled:opacity-60" value={form.rounding} disabled={ro} onChange={(e) => set("rounding")(e.target.value)}>
                  {!["1", "10", "50", "100"].includes(form.rounding) && <option value={form.rounding}>{form.rounding} אג׳</option>}
                  <option value="1">ללא עיגול</option>
                  <option value="10">10 אג׳</option>
                  <option value="50">50 אג׳</option>
                  <option value="100">₪1</option>
                </Select>
              </div>
              <UnitField label="תוקף הצעת מחיר" unit="שנ׳" inputMode="numeric" value={form.quoteTtlSec} onChange={set("quoteTtlSec")} error={show("quoteTtlSec")} hint="30–3600" disabled={ro} />
            </div>
          </FormSection>
          <FormSection title="הערות פנימיות">
            <textarea className="input min-h-[88px] bg-surface disabled:opacity-60" value={form.notes} disabled={ro} onChange={(e) => set("notes")(e.target.value)} maxLength={1000} aria-label="הערות פנימיות לתעריף" />
          </FormSection>
          {!ro && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-4 sm:px-5">
              <span className="text-sm text-fg-muted">{!dirty ? "אין שינויים" : value ? `${changes.length} שינויים ממתינים לשמירה` : "יש שדות לא תקינים"}</span>
              <div className="flex gap-2">
                {dirty && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setForm(initial);
                      setTouched(false);
                    }}
                  >
                    <Undo2 size={16} aria-hidden />
                    ביטול שינויים
                  </Button>
                )}
                <Button type="submit" size="sm" disabled={!dirty || (touched && !value) || (value !== null && changes.length === 0)}>
                  <Save size={16} aria-hidden />
                  שמירה כגרסה חדשה
                </Button>
              </div>
            </div>
          )}
        </form>
      </Panel>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <FarePreview config={value} services={svcOptions} />
      </div>
      <AnimatePresence>
        {!ro && dirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={SPRING}
            className="glass glass-strong glass-pill fixed bottom-4 z-30 flex items-center gap-3 py-2 pe-2 ps-5 text-sm font-semibold shadow-lg [inset-inline-end:16px] lg:hidden"
          >
            {value ? `${changes.length} שינויים` : "שדות לא תקינים"}
            <Button size="sm" className="h-10" disabled={!value || !changes.length} onClick={save}>
              שמירה
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      {dialog}
    </div>
  );
}

function FarePreview({ config, services }: { config: Parsed | null; services: ServiceTypeDTO[] }) {
  const [svc, setSvc] = useState("taxi");
  const [night, setNight] = useState(false);
  const service = services.find((s) => s.id === svc) ?? services[0];
  const result = config ? previewFare(config, { distanceM: 5000, durationS: 15 * 60, serviceMultiplierBp: service?.priceMultiplierBp ?? 10000, night }) : null;
  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <Calculator size={17} className="text-brand" aria-hidden />
          המחשת מחיר — 5 ק״מ, 15 דק׳
        </span>
      }
      description="המחשה בלבד — המחיר בפועל מחושב בשרת"
      index={1}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="סוג שירות להמחשה" className="h-10 flex-1 bg-surface py-0 text-sm" value={service?.id ?? ""} onChange={(e) => setSvc(e.target.value)}>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameHe} ({percentFromBp(s.priceMultiplierBp)})
            </option>
          ))}
        </Select>
        <div role="group" aria-label="שעת הנסיעה" className="inline-flex rounded-full bg-[color-mix(in_oklab,var(--fg)_7%,transparent)] p-1">
          {[
            { v: false, label: "יום", icon: <Sun size={14} aria-hidden /> },
            { v: true, label: "לילה", icon: <Moon size={14} aria-hidden /> },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={night === o.v}
              onClick={() => setNight(o.v)}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors", night === o.v ? "bg-surface text-fg shadow-sm" : "text-fg-muted")}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {!result ? (
        <div className="mt-4">
          <InlineError message="תקנו את השדות המסומנים כדי לראות המחשה." />
        </div>
      ) : (
        <>
          <dl className="mt-4 space-y-1.5 text-sm">
            {result.lines.map((l) => (
              <div key={l.label} className="flex justify-between gap-3">
                <dt className="text-fg-muted">{l.label}</dt>
                <dd className="tabular-nums">{formatILS(l.amount)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="font-bold">הנוסע משלם</span>
            <span className="display text-2xl tabular-nums">{formatILS(result.riderTotal)}</span>
          </div>
          <div aria-hidden className="mt-3 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            <motion.div className="h-full rounded-s-full bg-brand" animate={{ width: `${result.riderTotal ? (result.hop / result.riderTotal) * 100 : 0}%` }} transition={{ type: "spring", stiffness: 160, damping: 24 }} />
            <div className="h-full flex-1 rounded-e-full" style={{ background: PAYOUT_COLOR }} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-line p-3">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-brand" aria-hidden />
                עמלת HOP
              </dt>
              <dd className="mt-1 font-extrabold tabular-nums">{formatILS(result.hop)}</dd>
            </div>
            <div className="rounded-2xl border border-line p-3">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: PAYOUT_COLOR }} aria-hidden />
                הנהג מקבל
              </dt>
              <dd className="mt-1 font-extrabold tabular-nums">{formatILS(result.payout)}</dd>
            </div>
          </dl>
        </>
      )}
      <p className="mt-4 rounded-2xl bg-[color-mix(in_oklab,var(--fg)_4%,transparent)] px-3 py-2 text-xs leading-relaxed text-fg-muted">המחשה בלבד — המחיר בפועל מחושב בשרת לפי המסלול, השעה וסוג השירות.</p>
    </Panel>
  );
}

const CLASSES: VehicleClass[] = ["standard", "xl", "premium", "accessible"];

function ServiceTypesPanel({ data, loading, error, readOnly, onChanged }: { data: ServiceTypeDTO[] | undefined; loading: boolean; error: string | null; readOnly: boolean; onChanged: () => void }) {
  return (
    <Panel className="mt-5" title="סוגי שירות" description="שירות שלא אושר רגולטורית מוצג כמושבת עם הסיבה — לא ניתן להפעילו." actions={readOnly && <AdminOnlyNote />} flush index={2}>
      {error && !data ? (
        <ErrorState message={error} onRetry={onChanged} />
      ) : loading || !data ? (
        <div className="p-5 text-sm text-fg-muted">טוען…</div>
      ) : (
        <ul className="divide-y divide-line">
          {data.map((s) => (
            <ServiceRow key={`${s.id}:${s.enabled}:${s.priceMultiplierBp}:${s.seats}:${s.vehicleClasses.join(",")}`} service={s} readOnly={readOnly} onSaved={onChanged} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ServiceRow({ service, readOnly, onSaved }: { service: ServiceTypeDTO; readOnly: boolean; onSaved: () => void }) {
  const toast = useToast();
  const approved = service.legalStatus === "approved";
  const [multiplier, setMultiplier] = useState(String(service.priceMultiplierBp / 100));
  const [seats, setSeats] = useState(String(service.seats));
  const [classes, setClasses] = useState<string[]>(service.vehicleClasses);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const m = parseNum(multiplier);
  const st = parseNum(seats);
  const mErr = !Number.isFinite(m) || m < 50 || m > 400 ? "50%–400%" : null;
  const sErr = !Number.isInteger(st) || st < 1 || st > 8 ? "1–8" : null;
  const dirty = Math.round(m * 100) !== service.priceMultiplierBp || st !== service.seats || classes.slice().sort().join() !== service.vehicleClasses.slice().sort().join();

  async function update(input: Parameters<typeof api.admin.updateServiceType>[1], ok: string) {
    setBusy(true);
    setErr(null);
    try {
      await api.admin.updateServiceType(service.id, input);
      toast.success(ok);
      onSaved();
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <li className={cn("px-4 py-4 sm:px-5", !approved && "bg-[color-mix(in_oklab,var(--fg)_2.5%,transparent)]")}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_auto] xl:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <Toggle checked={service.enabled} disabled={readOnly || busy || !approved} onChange={(v) => update({ enabled: v }, v ? "השירות הופעל" : "השירות הושבת")} label={`הפעלת ${service.nameHe}`} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{service.nameHe}</span>
              {approved ? <Pill tone={service.enabled ? "success" : "muted"}>{service.enabled ? "פעיל" : "מושבת"}</Pill> : <Pill tone="warning">דורש אישור רגולטורי</Pill>}
            </div>
            <div className="mt-0.5 text-xs text-fg-muted">{service.descriptionHe}</div>
            {!approved && <div className="mt-1 text-xs font-semibold text-[color-mix(in_oklab,var(--warning)_50%,var(--fg))]">לא ניתן להפעיל עד לקבלת אישור רגולטורי.</div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[120px_100px_minmax(0,1fr)]">
          <UnitField label="מכפיל מחיר" unit="%" value={multiplier} onChange={setMultiplier} error={dirty ? mErr : null} disabled={readOnly || busy} />
          <UnitField label="מושבים" inputMode="numeric" value={seats} onChange={setSeats} error={dirty ? sErr : null} disabled={readOnly || busy} />
          <div className="col-span-2 sm:col-span-1">
            <div className="field-label mb-1.5">סוגי רכב</div>
            <div className="flex flex-wrap gap-1.5">
              {CLASSES.map((c) => {
                const on = classes.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={readOnly || busy}
                    aria-pressed={on}
                    onClick={() => setClasses((x) => (on ? x.filter((y) => y !== c) : [...x, c]))}
                    className={cn("h-9 rounded-full border px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60", on ? "border-brand bg-brand-50 text-brand-700" : "border-line text-fg-muted hover:text-fg")}
                  >
                    {VEHICLE_CLASS_HE[c]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {!readOnly && (
          <div className="flex justify-end">
            <Button size="sm" variant={dirty ? "primary" : "ghost"} disabled={!dirty || !!mErr || !!sErr || classes.length === 0} loading={busy} onClick={() => update({ priceMultiplierBp: Math.round(m * 100), seats: st, vehicleClasses: classes }, "סוג השירות עודכן")}>
              שמירה
            </Button>
          </div>
        )}
      </div>
      {err && (
        <div className="mt-3">
          <InlineError message={err} />
        </div>
      )}
    </li>
  );
}

function HistoryPanel({ history }: { history: PricingConfigDTO[] }) {
  const staff = useStaffDirectory();
  return (
    <Panel
      className="mt-5"
      title={
        <span className="inline-flex items-center gap-2">
          <History size={17} className="text-fg-muted" aria-hidden />
          היסטוריית גרסאות
        </span>
      }
      description="20 הגרסאות האחרונות"
      flush
      index={3}
    >
      <DataTable
        rows={history}
        rowKey={(h) => h.id}
        columns={[
          {
            key: "name",
            header: "גרסה",
            card: "title",
            cell: (h) => (
              <div>
                <div className="font-semibold">{h.name}</div>
                <div className="text-xs text-fg-muted tabular-nums">{formatDateTime(h.createdAt)}</div>
              </div>
            ),
          },
          {
            key: "state",
            header: "מצב",
            card: "badge",
            cell: (h) => (
              <span className="inline-flex gap-1.5">
                {h.active ? <Pill tone="success">פעיל</Pill> : <Pill tone="muted">היסטורי</Pill>}
                {h.isDemo && <Pill tone="warning">הדגמה</Pill>}
              </span>
            ),
          },
          { key: "base", header: "התחלה / ק״מ / דקה", cell: (h) => <span className="whitespace-nowrap tabular-nums">{formatILS(h.baseFareAgorot)} · {formatILS(h.perKmAgorot)} · {formatILS(h.perMinuteAgorot)}</span> },
          { key: "commission", header: "עמלה", cell: (h) => <span className="tabular-nums">{percentFromBp(h.commissionPercentBp)}</span> },
          { key: "night", header: "לילה", hideBelow: "lg", cell: (h) => <span className="whitespace-nowrap tabular-nums">{percentFromBp(h.nightMultiplierBp)} · <bdi>{h.nightStart}–{h.nightEnd}</bdi></span> },
          { key: "by", header: "עודכן על ידי", hideBelow: "lg", cell: (h) => (h.updatedBy ? staff.get(h.updatedBy)?.name ?? "מנהל" : <Muted>הגדרת מערכת</Muted>) },
        ]}
      />
    </Panel>
  );
}
