"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, CheckCircle2, UserCog } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { USER_ROLE_HE, VEHICLE_CLASS_HE } from "@/lib/labels";
import type { UserRole } from "@/lib/types";
import { Button, EmptyState, Pill, Select, useToast } from "@/components/ui";
import { useSession } from "@/components/app/session";
import { useAdmin } from "../context";
import { useLoad } from "../hooks";
import { DataTable, DetailSkeleton, ErrorState, KV, Ltr, Muted, Page, PageHeader, Panel } from "../ui";
import { AdminOnlyNote, AvailabilityPill, RolePill, UserStatusPill, VerificationPill } from "../pills";
import { useConfirm } from "../Dialog";
import { rideColumns } from "../rides";
import { RatingCell, vehicleLine } from "./Drivers";

const ROLES: UserRole[] = ["rider", "driver", "support", "admin"];

export function UserDetail({ id }: { id: string }) {
  const toast = useToast();
  const { isAdmin, role: myRole } = useAdmin();
  const me = useSession().user;
  const { confirm, dialog } = useConfirm();
  const { data, error, loading, reload } = useLoad(`user:${id}`, () => api.admin.user(id));
  const [roleDraft, setRoleDraft] = useState<UserRole | null>(null);

  if (loading)
    return (
      <Page>
        <DetailSkeleton />
      </Page>
    );
  if (!data)
    return (
      <Page>
        <PageHeader title="פרטי משתמש" back={{ href: "/admin/users", label: "לכל המשתמשים" }} />
        <div className="card">
          <ErrorState message={error ?? "המשתמש לא נמצא"} onRetry={reload} />
        </div>
      </Page>
    );

  const { user, suspendedReason, stats, recentRides, driverProfile } = data;
  const isSelf = me?.id === user.id;
  const protectedAdmin = user.role === "admin" && myRole !== "admin";
  const role = roleDraft ?? user.role;

  const toggleStatus = () => {
    if (user.status === "active") {
      confirm({
        title: `להשעות את ${user.name}?`,
        description: "המשתמש ינותק מכל המכשירים ולא יוכל להתחבר עד שהחשבון יופעל מחדש." + (user.role === "driver" ? " נהג מושעה מסומן כלא זמין." : ""),
        confirmLabel: "השעיית משתמש",
        tone: "danger",
        reason: { label: "סיבת ההשעיה", required: true, placeholder: "למשל: חשד לשימוש לרעה" },
        onConfirm: async (reason) => {
          await api.admin.updateUser(user.id, { status: "suspended", reason });
          toast.success("המשתמש הושעה");
          reload();
        },
      });
    } else {
      confirm({
        title: `להפעיל מחדש את ${user.name}?`,
        description: "המשתמש יוכל להתחבר שוב. נהגים יצטרכו גם אימות פעיל כדי לקבל נסיעות.",
        confirmLabel: "הפעלת חשבון",
        tone: "success",
        reason: { label: "הערה", placeholder: "לא חובה — יישמר ביומן הביקורת" },
        onConfirm: async (reason) => {
          await api.admin.updateUser(user.id, { status: "active", reason: reason || null });
          toast.success("החשבון הופעל");
          reload();
        },
      });
    }
  };

  const saveRole = () => {
    if (role === user.role) return;
    confirm({
      title: `לשנות את התפקיד ל״${USER_ROLE_HE[role]}״?`,
      description:
        role === "admin"
          ? "מנהל יכול לשנות תמחור, הגדרות ותפקידים של משתמשים אחרים. המשתמש ינותק ויתבקש להתחבר מחדש."
          : "המשתמש ינותק מכל המכשירים ויתבקש להתחבר מחדש עם ההרשאות החדשות." + (role === "driver" ? " ייווצר עבורו פרופיל נהג שיידרש לאימות מסמכים." : ""),
      confirmLabel: "שינוי תפקיד",
      tone: role === "admin" ? "danger" : "primary",
      onConfirm: async () => {
        await api.admin.updateUser(user.id, { role });
        toast.success("התפקיד עודכן");
        setRoleDraft(null);
        reload();
      },
    });
  };

  return (
    <Page>
      <PageHeader
        back={{ href: "/admin/users", label: "לכל המשתמשים" }}
        title={user.name}
        meta={
          <>
            <RolePill role={user.role} />
            <UserStatusPill status={user.status} />
            {user.isDemo && <Pill tone="warning">משתמש הדגמה</Pill>}
            {isSelf && <Pill tone="brand">זה אתם</Pill>}
          </>
        }
        actions={
          !isSelf &&
          !protectedAdmin &&
          (user.status === "active" ? (
            <Button variant="danger" size="sm" onClick={toggleStatus}>
              <Ban size={17} aria-hidden />
              השעיית משתמש
            </Button>
          ) : (
            <Button variant="success" size="sm" onClick={toggleStatus}>
              <CheckCircle2 size={17} aria-hidden />
              הפעלת חשבון
            </Button>
          ))
        }
      />

      {user.status === "suspended" && (
        <div className="mb-5 rounded-[var(--radius-lg)] border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-[color-mix(in_oklab,var(--danger)_6%,var(--surface))] px-4 py-3 text-sm">
          <span className="font-bold text-danger">החשבון מושעה. </span>
          {suspendedReason ? <>סיבה: {suspendedReason}</> : <Muted>לא צוינה סיבה.</Muted>}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="פרטי חשבון">
            <KV
              items={[
                { label: "אימייל", value: <Ltr>{user.email}</Ltr> },
                { label: "טלפון", value: user.phone ? <Ltr>{user.phone}</Ltr> : <Muted>לא הוזן</Muted> },
                { label: "נרשם", value: formatDateTime(user.createdAt) },
                { label: "שפה", value: user.locale === "he" ? "עברית" : user.locale },
                { label: "נסיעות (כנוסע או נהג)", value: <span className="tabular-nums">{stats.rides}</span> },
                { label: "מזהה", value: <Ltr className="text-xs text-fg-muted">{user.id}</Ltr> },
              ]}
            />
          </Panel>
          <Panel title="נסיעות אחרונות" flush>
            <DataTable
              rows={recentRides}
              columns={rideColumns({ hideRider: user.role === "rider", hideDriver: user.role === "driver" })}
              rowKey={(r) => r.id}
              rowHref={(r) => `/admin/rides/${r.id}`}
              empty={<EmptyState title="אין נסיעות" description="למשתמש הזה עדיין אין נסיעות." />}
            />
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title="תפקיד והרשאות" actions={!isAdmin && <AdminOnlyNote />}>
            <label htmlFor="role-select" className="field-label">
              תפקיד במערכת
            </label>
            <div className="mt-2 flex gap-2">
              <Select id="role-select" value={role} disabled={!isAdmin || isSelf} onChange={(e) => setRoleDraft(e.target.value as UserRole)} className="h-11 flex-1">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {USER_ROLE_HE[r]}
                  </option>
                ))}
              </Select>
              {isAdmin && !isSelf && (
                <Button size="sm" className="h-11" disabled={role === user.role} onClick={saveRole}>
                  <UserCog size={17} aria-hidden />
                  שמירה
                </Button>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-fg-muted">
              {isSelf ? "לא ניתן לשנות את התפקיד של עצמכם." : isAdmin ? "שינוי תפקיד מנתק את המשתמש מכל ההתחברויות הפעילות." : "רק מנהל יכול לשנות תפקידים."}
            </p>
          </Panel>
          {driverProfile && (
            <Panel
              title="פרופיל נהג"
              actions={
                <Link href={`/admin/drivers/${user.id}`} className="inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm font-bold text-brand hover:bg-brand-50">
                  לפרטי הנהג
                  <ArrowLeft size={16} aria-hidden />
                </Link>
              }
            >
              <div className="mb-4 flex flex-wrap gap-2">
                <VerificationPill status={driverProfile.verificationStatus} />
                <AvailabilityPill availability={driverProfile.availability} />
              </div>
              <KV
                cols={1}
                items={[
                  { label: "רכב", value: vehicleLine(driverProfile) },
                  { label: "מספר רישוי", value: driverProfile.vehiclePlate ? <Ltr>{driverProfile.vehiclePlate}</Ltr> : <Muted>—</Muted> },
                  { label: "סוג רכב", value: VEHICLE_CLASS_HE[driverProfile.vehicleClass] },
                  { label: "דירוג", value: <RatingCell rating={driverProfile.rating} count={driverProfile.ratingCount} /> },
                ]}
              />
            </Panel>
          )}
        </div>
      </div>
      {dialog}
    </Page>
  );
}
