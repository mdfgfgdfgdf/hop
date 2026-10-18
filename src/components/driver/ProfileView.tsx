"use client";
/** Driver profile: personal details, verification, vehicle, documents, logout. */
import { useCallback, useEffect, useState } from "react";
import { Car, LogOut, Pencil, Star } from "lucide-react";
import { api } from "@/lib/api";
import { VEHICLE_CLASS_HE, VERIFICATION_STATUS_HE } from "@/lib/labels";
import type { DriverDocumentDTO, DriverProfileDTO, ServiceTypeDTO } from "@/lib/types";
import { Avatar, Button, Field, Input, Skeleton, cn, useToast } from "@/components/ui";
import { TonePill } from "./TonePill";
import { useSession } from "@/components/app/session";
import { useDriverRuntime } from "./DriverRuntime";
import { DriverPage, Section } from "./DriverPage";
import { VerificationCard } from "./VerificationCard";
import { VehicleForm } from "./VehicleForm";
import { DocumentsList, missingDocuments } from "./DocumentsList";
import { Notice } from "./Notice";
import { errorMessage } from "./errors";
import { Plate } from "./Plate";
import { CHIP, TEXT, WELL } from "./tone";

type ProfileData = { profile: DriverProfileDTO; documents: DriverDocumentDTO[]; requiredDocuments: string[] };

export function ProfileView() {
  const { user, refresh, logout } = useSession();
  const { refreshProfile, docsVersion } = useDriverRuntime();
  const [data, setData] = useState<ProfileData | null>(null);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState(false);

  const load = useCallback(
    () =>
      api.driver
        .profile()
        .then((res) => {
          setError(null);
          setData(res);
        })
        .catch((err: unknown) => setError(errorMessage(err))),
    [],
  );

  useEffect(() => {
    void load();
  }, [load, docsVersion]);

  useEffect(() => {
    api
      .serviceTypes()
      .then((r) => setServiceTypes(r.serviceTypes))
      .catch(() => setServiceTypes([]));
  }, []);

  const p = data?.profile;
  const tone = p?.verificationStatus === "approved" ? "success" : p?.verificationStatus === "rejected" || p?.verificationStatus === "suspended" ? "danger" : "warning";

  return (
    <DriverPage title="פרופיל ומסמכים" wide>
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-4 lg:sticky lg:top-24">
          <div className="glass glass-strong glass-md p-5">
            <div className="flex items-center gap-4">
              <Avatar name={user?.name ?? "נהג"} size={64} />
              <div className="min-w-0">
                <div className="display truncate text-xl">{user?.name ?? <Skeleton className="h-6 w-32" />}</div>
                <div className="truncate text-xs text-fg-muted" dir="ltr">
                  {user?.email}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {p && <TonePill tone={tone}>{VERIFICATION_STATUS_HE[p.verificationStatus]}</TonePill>}
                  {p?.rating != null && (
                    <span className="inline-flex items-center gap-1 text-sm font-bold">
                      <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden />
                      <span className="tabular-nums">{p.rating.toFixed(1)}</span>
                      <span className="text-xs font-semibold text-fg-muted">({p.ratingCount})</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {p && data && <VerificationCard profile={p} missing={missingDocuments(data.documents, data.requiredDocuments)} compact onFix={() => document.getElementById("documents")?.scrollIntoView({ behavior: "smooth" })} />}
          <Button variant="ghost" block className={TEXT.danger} onClick={() => void logout()}>
            <LogOut size={18} aria-hidden /> התנתקות
          </Button>
        </div>

        <div className="grid gap-4">
          {error && (
            <Notice tone="danger" live title="לא הצלחנו לטעון את הפרופיל">
              {error}
            </Notice>
          )}
          <Section title="פרטים אישיים" description="השם יוצג לנוסעים. מספר הטלפון מוצג להם מוסתר.">
            {user ? <PersonalForm key={user.id} name={user.name} phone={user.phone ?? ""} email={user.email} onSaved={() => void refresh()} /> : <Skeleton className="h-40" />}
          </Section>
          <Section
            title="רכב ושירותים"
            action={
              p && !editingVehicle ? (
                <Button size="sm" variant="glass" onClick={() => setEditingVehicle(true)} data-testid="vehicle-edit">
                  <Pencil size={15} aria-hidden /> עריכה
                </Button>
              ) : null
            }
          >
            {p && !editingVehicle ? (
              <div className="grid gap-3" data-testid="vehicle-summary">
                <div className={cn(WELL, "flex items-center gap-3 p-3")}>
                  <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", CHIP.brand)}>
                    <Car size={22} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-extrabold">{[p.vehicleMake, p.vehicleModel].filter(Boolean).join(" ") || "טרם הוזנו פרטי רכב"}</div>
                    <div className="mt-0.5 text-xs leading-snug text-fg-muted">{[p.vehicleColor, VEHICLE_CLASS_HE[p.vehicleClass], p.vehicleYear, `${p.seats} מקומות`].filter(Boolean).join(" · ")}</div>
                  </div>
                  {p.vehiclePlate && <Plate plate={p.vehiclePlate} />}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.serviceTypeIds.map((id) => (
                    <span key={id} className="pill pill-brand">
                      {serviceTypes?.find((s) => s.id === id)?.nameHe ?? id}
                    </span>
                  ))}
                </div>
              </div>
            ) : p ? (
              <VehicleForm
                key={p.vehiclePlate ?? "new"}
                profile={p}
                serviceTypes={serviceTypes}
                onSaved={(np) => {
                  setData((d) => (d ? { ...d, profile: np } : d));
                  setEditingVehicle(false);
                  void refreshProfile();
                }}
              />
            ) : (
              <Skeleton className="h-64" />
            )}
          </Section>
          <Section id="documents" title="מסמכים" description="מסמך שפג תוקפו או נדחה — העלו קובץ חדש והוא יישלח לבדיקה.">
            {p && data ? <DocumentsList documents={data.documents} requiredDocuments={data.requiredDocuments} verificationStatus={p.verificationStatus} onUploaded={() => void load().then(() => refreshProfile())} /> : <Skeleton className="h-64" />}
          </Section>
        </div>
      </div>
    </DriverPage>
  );
}

function PersonalForm({ name: initialName, phone: initialPhone, email, onSaved }: { name: string; phone: string; email: string; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== initialName || phone.trim() !== initialPhone;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v: typeof errors = {};
    if (name.trim().length < 2) v.name = "נא למלא שם מלא";
    const digits = phone.replace(/\D/g, "");
    if (phone.trim() && (digits.length < 9 || digits.length > 12)) v.phone = "מספר טלפון לא תקין, למשל 050-1234567";
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    setError(null);
    try {
      await api.auth.updateProfile({ name: name.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) });
      toast.success("הפרטים עודכנו");
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="שם מלא" error={errors.name}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} autoComplete="name" invalid={!!errors.name} />}
        </Field>
        <Field label="טלפון" error={errors.phone}>
          {(id) => <Input id={id} type="tel" dir="ltr" inputMode="tel" className="text-start tabular-nums" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 16))} autoComplete="tel" invalid={!!errors.phone} />}
        </Field>
        <Field label="אימייל" hint="לשינוי האימייל פנו לתמיכה" className="sm:col-span-2">
          {(id) => <Input id={id} dir="ltr" className="text-start" value={email} readOnly disabled />}
        </Field>
      </div>
      {error && (
        <Notice tone="danger" live>
          {error}
        </Notice>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={saving} disabled={!dirty}>
          שמירת פרטים
        </Button>
      </div>
    </form>
  );
}
