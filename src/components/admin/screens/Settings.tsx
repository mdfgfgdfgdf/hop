"use client";
import { useMemo, useState } from "react";
import { Info, Save, Scale, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button, DemoBanner, Toggle, useToast, cn } from "@/components/ui";
import { useAdmin } from "../context";
import { useLoad } from "../hooks";
import { DetailSkeleton, ErrorState, Page, PageHeader, Panel } from "../ui";
import { AdminOnlyNote } from "../pills";
import { useConfirm } from "../Dialog";
import { FormSection, UnitField, parseNum } from "../form";

type NumKey =
  | "dispatch.offerTimeoutSec"
  | "dispatch.searchTimeoutSec"
  | "dispatch.searchRadiusM"
  | "dispatch.maxOfferAttempts"
  | "dispatch.driverStaleLocationSec"
  | "dispatch.retryIntervalSec"
  | "demo.autopilotAcceptDelaySec"
  | "demo.driverSpeedMps";

type Spec = { key: NumKey; label: string; unit: string; min: number; max: number; hint: (v: number) => string; decimals?: boolean };

const DISPATCH: Spec[] = [
  { key: "dispatch.offerTimeoutSec", label: "זמן לתגובת נהג להצעה", unit: "שנ׳", min: 5, max: 120, hint: () => "אחרי הזמן הזה ההצעה עוברת לנהג הבא" },
  { key: "dispatch.searchTimeoutSec", label: "זמן חיפוש מקסימלי", unit: "שנ׳", min: 30, max: 900, hint: (v) => `${(v / 60).toFixed(1).replace(/\.0$/, "")} דק׳ עד ביטול ״לא נמצא נהג״` },
  { key: "dispatch.searchRadiusM", label: "רדיוס חיפוש נהגים", unit: "מ׳", min: 500, max: 50000, hint: (v) => `${(v / 1000).toFixed(1).replace(/\.0$/, "")} ק״מ מנקודת האיסוף` },
  { key: "dispatch.maxOfferAttempts", label: "מספר הצעות מקסימלי לנסיעה", unit: "נהגים", min: 1, max: 50, hint: () => "כמה נהגים יקבלו הצעה לפני שמוותרים" },
  { key: "dispatch.driverStaleLocationSec", label: "מיקום נהג נחשב ישן אחרי", unit: "שנ׳", min: 30, max: 3600, hint: () => "נהג בלי עדכון מיקום טרי לא יקבל הצעות" },
  { key: "dispatch.retryIntervalSec", label: "מרווח בין ניסיונות שיבוץ", unit: "שנ׳", min: 1, max: 60, hint: () => "תדירות סבב השיבוץ בזמן חיפוש" },
];
const DEMO: Spec[] = [
  { key: "demo.autopilotAcceptDelaySec", label: "השהיית אישור אוטומטי", unit: "שנ׳", min: 0, max: 60, hint: () => "כמה זמן נהג ההדגמה ״חושב״ לפני אישור" },
  { key: "demo.driverSpeedMps", label: "מהירות נהג הדגמה", unit: "מ׳/שנ׳", min: 1, max: 40, decimals: true, hint: (v) => `≈ ${Math.round(v * 3.6)} קמ״ש` },
];
const ALL = [...DISPATCH, ...DEMO];

type Form = Record<NumKey, string> & { minAcceptancePct: string; autopilot: boolean; notice: string };

function toForm(s: Record<string, unknown>, d: Record<string, unknown>): Form {
  const get = (k: string) => (s[k] ?? d[k]) as unknown;
  const f = { minAcceptancePct: String(Number(get("dispatch.minAcceptanceRateBp") ?? 0) / 100), autopilot: Boolean(get("demo.autopilot")), notice: String(get("platform.operatingNotice") ?? "") } as Form;
  for (const spec of ALL) f[spec.key] = String(get(spec.key) ?? "");
  return f;
}

export function Settings() {
  const { data, error, loading, reload } = useLoad("settings", () => api.admin.settings());
  if (loading)
    return (
      <Page>
        <DetailSkeleton />
      </Page>
    );
  if (!data)
    return (
      <Page>
        <PageHeader title="הגדרות" />
        <div className="card">
          <ErrorState message={error ?? "לא ניתן לטעון הגדרות"} onRetry={reload} />
        </div>
      </Page>
    );
  return <SettingsForm key={JSON.stringify(data.settings)} settings={data.settings} defaults={data.defaults} onSaved={reload} />;
}

function SettingsForm({ settings, defaults, onSaved }: { settings: Record<string, unknown>; defaults: Record<string, unknown>; onSaved: () => void }) {
  const toast = useToast();
  const { isAdmin, demoMode } = useAdmin();
  const { confirm, dialog } = useConfirm();
  const initial = useMemo(() => toForm(settings, defaults), [settings, defaults]);
  const [form, setForm] = useState<Form>(initial);
  const ro = !isAdmin;

  const errors: Partial<Record<string, string>> = {};
  const patch: Record<string, number | boolean | string> = {};
  for (const spec of ALL) {
    const n = parseNum(form[spec.key]);
    if (!Number.isFinite(n) || n < spec.min || n > spec.max || (!spec.decimals && !Number.isInteger(n))) errors[spec.key] = `${spec.decimals ? "מספר" : "מספר שלם"} בין ${spec.min} ל-${spec.max}`;
    else if (String(n) !== initial[spec.key]) patch[spec.key] = n;
  }
  const acc = parseNum(form.minAcceptancePct);
  if (!Number.isFinite(acc) || acc < 0 || acc > 100) errors.minAcceptancePct = "אחוז בין 0 ל-100";
  else if (form.minAcceptancePct !== initial.minAcceptancePct) patch["dispatch.minAcceptanceRateBp"] = Math.round(acc * 100);
  if (form.autopilot !== initial.autopilot) patch["demo.autopilot"] = form.autopilot;
  if (form.notice.trim() !== initial.notice.trim()) patch["platform.operatingNotice"] = form.notice.trim();
  if (form.notice.trim().length < 5) errors.notice = "הודעה קצרה מדי";
  const valid = Object.keys(errors).length === 0;
  const changed = Object.keys(patch).length;

  const set = (k: keyof Form) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const def = (k: string) => (defaults[k] !== undefined ? `ברירת מחדל: ${String(defaults[k])}` : "");

  const save = () =>
    confirm({
      title: `לשמור ${changed === 1 ? "שינוי אחד" : `${changed} שינויים`}?`,
      description: "ההגדרות חלות מיד על שיבוץ נסיעות חדשות. השינוי נרשם ביומן הביקורת.",
      confirmLabel: "שמירת הגדרות",
      onConfirm: async () => {
        await api.admin.updateSettings(patch);
        toast.success("ההגדרות נשמרו");
        onSaved();
      },
    });

  return (
    <Page>
      <PageHeader title="הגדרות" description="פרמטרים של מנוע השיבוץ, סימולציית ההדגמה והודעת הפלטפורמה." meta={!isAdmin && <AdminOnlyNote />} />
      <form
        className="grid gap-5 lg:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && changed) save();
        }}
      >
        <Panel title="שיבוץ נסיעות" description="איך HOP מוצאת נהג לכל הזמנה" flush className="lg:row-span-2">
          <FormSection title="הצעות וחיפוש">
            <div className="grid gap-4 sm:grid-cols-2">
              {DISPATCH.map((spec) => {
                const n = parseNum(form[spec.key]);
                return (
                  <UnitField
                    key={spec.key}
                    label={spec.label}
                    unit={spec.unit}
                    inputMode={spec.decimals ? "decimal" : "numeric"}
                    value={form[spec.key]}
                    onChange={set(spec.key)}
                    error={errors[spec.key]}
                    disabled={ro}
                    hint={
                      <>
                        {Number.isFinite(n) ? spec.hint(n) : null}
                        <span className="block opacity-80">{def(spec.key)}</span>
                      </>
                    }
                  />
                );
              })}
            </div>
          </FormSection>
          <FormSection title="סף קבלת הצעות">
            <div className="grid gap-4 sm:grid-cols-2">
              <UnitField label="שיעור קבלה מינימלי" unit="%" value={form.minAcceptancePct} onChange={set("minAcceptancePct")} error={errors.minAcceptancePct} disabled={ro} hint={`0 = כבוי (ללא סינון) · ברירת מחדל: ${Number(defaults["dispatch.minAcceptanceRateBp"] ?? 0) / 100}%`} />
            </div>
            <div className="mt-4 flex gap-3 rounded-2xl border border-line bg-brand-50/60 p-4 text-sm">
              <Scale size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
              <p className="leading-relaxed">
                <strong>הוגנות כלפי נהגים:</strong> סף מעל 0 מדלג על נהגים ששיעור הקבלה שלהם נמוך — גם כשהם הקרובים ביותר. מומלץ להשאיר 0 (כבוי) עד שיש הצדקה תפעולית מתועדת, ולשקול
                את ההשפעה על נהגים חדשים ועל אזורים שקטים.
              </p>
            </div>
          </FormSection>
        </Panel>

        <Panel title="סימולציית הדגמה" description="נהגי הדגמה שמקבלים ומבצעים נסיעות אוטומטית" flush actions={demoMode && <DemoBanner compact text="מצב הדגמה פעיל" />}>
          <FormSection title="טייס אוטומטי">
            <label className={cn("flex items-start gap-3 rounded-2xl border border-line p-4", ro ? "cursor-not-allowed" : "cursor-pointer")}>
              <Toggle checked={form.autopilot} onChange={set("autopilot")} disabled={ro} label="טייס אוטומטי לנהגי הדגמה" />
              <span className="text-sm">
                <span className="block font-bold">{form.autopilot ? "פעיל — נהגי הדגמה מקבלים נסיעות לבד" : "כבוי — נסיעות ימתינו לנהג אמיתי"}</span>
                <span className="mt-0.5 block text-fg-muted">משפיע רק על משתמשי הדגמה. נהגים אמיתיים לא מושפעים.</span>
              </span>
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {DEMO.map((spec) => {
                const n = parseNum(form[spec.key]);
                return (
                  <UnitField
                    key={spec.key}
                    label={spec.label}
                    unit={spec.unit}
                    inputMode={spec.decimals ? "decimal" : "numeric"}
                    value={form[spec.key]}
                    onChange={set(spec.key)}
                    error={errors[spec.key]}
                    disabled={ro}
                    hint={
                      <>
                        {Number.isFinite(n) ? spec.hint(n) : null}
                        <span className="block opacity-80">{def(spec.key)}</span>
                      </>
                    }
                  />
                );
              })}
            </div>
          </FormSection>
        </Panel>

        <Panel title="הודעת פלטפורמה" description="מוצגת למשתמשים באפליקציות" flush>
          <FormSection title="נוסח ההודעה">
            <label htmlFor="notice" className="sr-only">
              נוסח הודעת הפלטפורמה
            </label>
            <textarea id="notice" className="input min-h-[110px] bg-surface disabled:opacity-60" value={form.notice} onChange={(e) => set("notice")(e.target.value)} disabled={ro} maxLength={500} aria-invalid={errors.notice ? true : undefined} />
            {errors.notice && <div className="field-error mt-1.5">{errors.notice}</div>}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
              <Info size={13} aria-hidden />
              כתבו בשפה פשוטה וכנה. אל תבטיחו שירות מסחרי לפני אישור רגולטורי.
            </p>
          </FormSection>
        </Panel>

        {isAdmin && (
          <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 lg:col-span-2 sm:px-5">
            <span className="text-sm text-fg-muted">{!valid ? "יש שדות לא תקינים" : changed ? (changed === 1 ? "שינוי אחד ממתין לשמירה" : `${changed} שינויים ממתינים לשמירה`) : "אין שינויים"}</span>
            <div className="flex gap-2">
              {changed > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm(initial)}>
                  <Undo2 size={16} aria-hidden />
                  ביטול שינויים
                </Button>
              )}
              <Button type="submit" size="sm" disabled={!valid || !changed}>
                <Save size={16} aria-hidden />
                שמירת הגדרות
              </Button>
            </div>
          </div>
        )}
      </form>
      {dialog}
    </Page>
  );
}
