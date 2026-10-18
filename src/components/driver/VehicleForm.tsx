"use client";
/** Vehicle details + service types (onboarding step 1 and profile page). */
import { useState } from "react";
import { Accessibility, Car, CarFront, Check, Crown } from "lucide-react";
import { api } from "@/lib/api";
import { VEHICLE_CLASS_HE } from "@/lib/labels";
import type { DriverProfileDTO, ServiceTypeDTO, VehicleClass } from "@/lib/types";
import { Button, Field, Input, Select, Skeleton, cn, useToast } from "@/components/ui";
import { errorMessage } from "./errors";
import { Notice } from "./Notice";
import { TEXT } from "./tone";

const CLASSES: { value: VehicleClass; icon: typeof Car; hint: string }[] = [
  { value: "standard", icon: Car, hint: "עד 4 נוסעים" },
  { value: "xl", icon: CarFront, hint: "5–6 נוסעים" },
  { value: "premium", icon: Crown, hint: "רכב יוקרה" },
  { value: "accessible", icon: Accessibility, hint: "מותאם לכיסא גלגלים" },
];

const YEARS = Array.from({ length: 2030 - 2005 + 1 }, (_, i) => 2030 - i);

type Form = {
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehiclePlate: string;
  vehicleYear: string;
  seats: string;
  vehicleClass: VehicleClass;
  licenseNumber: string;
  taxiLicenseNumber: string;
  serviceTypeIds: string[];
};

function toForm(p: DriverProfileDTO): Form {
  return {
    vehicleMake: p.vehicleMake ?? "",
    vehicleModel: p.vehicleModel ?? "",
    vehicleColor: p.vehicleColor ?? "",
    vehiclePlate: p.vehiclePlate ?? "",
    vehicleYear: p.vehicleYear ? String(p.vehicleYear) : "",
    seats: String(p.seats || 4),
    vehicleClass: p.vehicleClass,
    licenseNumber: p.licenseNumber ?? "",
    taxiLicenseNumber: p.taxiLicenseNumber ?? "",
    serviceTypeIds: p.serviceTypeIds,
  };
}

export function isVehicleComplete(p: DriverProfileDTO) {
  return Boolean(p.vehicleMake && p.vehicleModel && p.vehicleColor && p.vehiclePlate && p.vehicleYear && p.serviceTypeIds.length > 0);
}

function validate(f: Form, serviceTypes: ServiceTypeDTO[] | null) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.vehicleMake.trim()) e.vehicleMake = "נא למלא יצרן";
  if (!f.vehicleModel.trim()) e.vehicleModel = "נא למלא דגם";
  if (!f.vehicleColor.trim()) e.vehicleColor = "נא למלא צבע";
  const digits = f.vehiclePlate.replace(/\D/g, "");
  if (!f.vehiclePlate.trim()) e.vehiclePlate = "נא למלא מספר רישוי";
  else if (digits.length < 7 || digits.length > 8 || f.vehiclePlate.trim().length > 12) e.vehiclePlate = "מספר רישוי צריך לכלול 7 או 8 ספרות, למשל 12-345-67";
  if (!f.vehicleYear) e.vehicleYear = "נא לבחור שנת ייצור";
  if (serviceTypes && f.serviceTypeIds.length === 0) e.serviceTypeIds = "בחרו לפחות סוג שירות אחד";
  return e;
}

export function VehicleForm({
  profile,
  serviceTypes,
  onSaved,
  submitLabel = "שמירת פרטי הרכב",
  id = "vehicle-form",
}: {
  profile: DriverProfileDTO;
  serviceTypes: ServiceTypeDTO[] | null;
  onSaved: (p: DriverProfileDTO) => void;
  submitLabel?: string;
  id?: string;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(profile));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const approved = profile.verificationStatus === "approved";
  const plateChanged = approved && form.vehiclePlate.trim() !== (profile.vehiclePlate ?? "");

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const setClass = (c: VehicleClass) => {
    setForm((f) => ({
      ...f,
      vehicleClass: c,
      serviceTypeIds: serviceTypes ? f.serviceTypeIds.filter((id) => serviceTypes.find((s) => s.id === id)?.vehicleClasses.includes(c)) : f.serviceTypeIds,
    }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validate(form, serviceTypes);
    setErrors(v);
    if (Object.keys(v).length) {
      setError("חלק מהשדות חסרים או אינם תקינים");
      return;
    }
    setSaving(true);
    try {
      const { profile: p } = await api.driver.updateProfile({
        vehicleMake: form.vehicleMake.trim(),
        vehicleModel: form.vehicleModel.trim(),
        vehicleColor: form.vehicleColor.trim(),
        vehiclePlate: form.vehiclePlate.trim(),
        vehicleYear: Number(form.vehicleYear),
        seats: Number(form.seats),
        vehicleClass: form.vehicleClass,
        ...(form.licenseNumber.trim() ? { licenseNumber: form.licenseNumber.trim() } : {}),
        ...(form.taxiLicenseNumber.trim() ? { taxiLicenseNumber: form.taxiLicenseNumber.trim() } : {}),
        ...(serviceTypes ? { serviceTypeIds: form.serviceTypeIds } : {}),
      });
      toast.success("פרטי הרכב נשמרו", p.verificationStatus === "under_review" && approved ? "שינוי הרכב נשלח לבדיקה מחודשת" : undefined);
      onSaved(p);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id={id} onSubmit={submit} noValidate className="grid gap-5">
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-extrabold">סוג הרכב</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="סוג הרכב">
          {CLASSES.map(({ value, icon: Icon, hint }) => {
            const active = form.vehicleClass === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setClass(value)}
                className={cn(
                  "relative flex min-h-[84px] flex-col items-start gap-1 rounded-2xl p-3 text-start transition-[background-color,box-shadow]",
                  active ? "bg-brand-50 shadow-[0_8px_20px_-14px_rgba(36,87,255,0.8)] ring-2 ring-brand" : "bg-bg ring-1 ring-line hover:bg-surface",
                )}
              >
                <Icon size={20} aria-hidden className={active ? "text-brand" : "text-fg-muted"} />
                <span className="text-sm font-bold">{VEHICLE_CLASS_HE[value]}</span>
                <span className="text-[11px] text-fg-muted">{hint}</span>
                {active && (
                  <span className="absolute end-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-white" aria-hidden>
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="יצרן" error={errors.vehicleMake}>
          {(fid) => <Input id={fid} value={form.vehicleMake} onChange={(e) => set("vehicleMake", e.target.value)} placeholder="למשל: טויוטה" maxLength={40} invalid={!!errors.vehicleMake} autoComplete="off" />}
        </Field>
        <Field label="דגם" error={errors.vehicleModel}>
          {(fid) => <Input id={fid} value={form.vehicleModel} onChange={(e) => set("vehicleModel", e.target.value)} placeholder="למשל: קורולה" maxLength={40} invalid={!!errors.vehicleModel} autoComplete="off" />}
        </Field>
        <Field label="צבע" error={errors.vehicleColor}>
          {(fid) => <Input id={fid} value={form.vehicleColor} onChange={(e) => set("vehicleColor", e.target.value)} placeholder="למשל: לבן" maxLength={30} invalid={!!errors.vehicleColor} autoComplete="off" />}
        </Field>
        <Field label="מספר רישוי" error={errors.vehiclePlate} hint="כפי שמופיע ברישיון הרכב">
          {(fid) => (
            <Input
              id={fid}
              dir="ltr"
              inputMode="numeric"
              className="text-start font-bold tracking-wider tabular-nums"
              value={form.vehiclePlate}
              onChange={(e) => set("vehiclePlate", e.target.value.replace(/[^\d-\s]/g, "").slice(0, 12))}
              placeholder="12-345-67"
              invalid={!!errors.vehiclePlate}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="שנת ייצור" error={errors.vehicleYear}>
          {(fid) => (
            <Select id={fid} value={form.vehicleYear} onChange={(e) => set("vehicleYear", e.target.value)} aria-invalid={!!errors.vehicleYear || undefined}>
              <option value="">בחרו שנה</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="מקומות ישיבה לנוסעים">
          {(fid) => (
            <Select id={fid} value={form.seats} onChange={(e) => set("seats", e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="מספר רישיון נהיגה" hint="לא חובה בשלב זה">
          {(fid) => <Input id={fid} dir="ltr" className="text-start tabular-nums" value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value.slice(0, 20))} autoComplete="off" />}
        </Field>
        <Field label="מספר רישיון מונית / היתר הסעה" hint="המספר הירוק או מספר ההיתר">
          {(fid) => <Input id={fid} dir="ltr" className="text-start tabular-nums" value={form.taxiLicenseNumber} onChange={(e) => set("taxiLicenseNumber", e.target.value.slice(0, 20))} autoComplete="off" />}
        </Field>
      </div>

      {plateChanged && (
        <Notice tone="warning" title="שינוי מספר הרישוי מחייב בדיקה מחודשת">
          אחרי השמירה החשבון יעבור לבדיקה ולא תוכלו לקבל נסיעות עד לאישור.
        </Notice>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-extrabold">סוגי שירות</legend>
        {!serviceTypes ? (
          <div className="grid gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {serviceTypes.map((st) => {
              const fits = st.vehicleClasses.includes(form.vehicleClass);
              const checked = form.serviceTypeIds.includes(st.id);
              return (
                <label
                  key={st.id}
                  className={cn(
                    "flex min-h-14 items-start gap-3 rounded-2xl p-3 transition-[background-color,box-shadow]",
                    !fits ? "cursor-not-allowed bg-bg opacity-60 ring-1 ring-line" : checked ? "cursor-pointer bg-brand-50 ring-2 ring-brand" : "cursor-pointer bg-bg ring-1 ring-line hover:bg-surface",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]"
                    checked={checked && fits}
                    disabled={!fits}
                    onChange={(e) => set("serviceTypeIds", e.target.checked ? [...form.serviceTypeIds, st.id] : form.serviceTypeIds.filter((x) => x !== st.id))}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{st.nameHe}</span>
                    <span className="block text-xs text-fg-muted">{fits ? st.descriptionHe : `לא זמין לרכב מסוג ${VEHICLE_CLASS_HE[form.vehicleClass]}`}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {errors.serviceTypeIds && (
          <p className={cn("mt-2 text-sm font-semibold", TEXT.danger)} role="alert">
            {errors.serviceTypeIds}
          </p>
        )}
        <p className="mt-2 text-xs text-fg-muted">נסיעות שיתופיות ברכב פרטי אינן מופעלות ב-HOP — רק שירותים מורשים מוצגים כאן.</p>
      </fieldset>

      {error && (
        <Notice tone="danger" live>
          {error}
        </Notice>
      )}
      <Button type="submit" size="lg" block loading={saving} data-testid="vehicle-save">
        {submitLabel}
      </Button>
    </form>
  );
}
