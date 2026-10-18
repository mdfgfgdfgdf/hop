/** Status pills for every entity, always using the shared Hebrew label maps. */
import { AlertOctagon, AlertTriangle, Info, Lock } from "lucide-react";
import { Pill } from "@/components/ui";
import {
  AVAILABILITY_HE,
  DOCUMENT_STATUS_HE,
  RIDE_STATUS_SHORT_HE,
  TICKET_CATEGORY_HE,
  TICKET_PRIORITY_HE,
  TICKET_STATUS_HE,
  USER_ROLE_HE,
  VERIFICATION_STATUS_HE,
} from "@/lib/labels";
import type { DriverAvailability, RideFlag, RideStatus, UserRole, VerificationStatus } from "@/lib/types";
import type { TicketDTO } from "@/lib/api";

type Tone = "brand" | "ink" | "success" | "warning" | "danger" | "muted";

const RIDE_TONE: Record<RideStatus, Tone> = {
  requested: "muted",
  searching: "warning",
  offered: "warning",
  accepted: "brand",
  driver_arriving: "brand",
  in_progress: "brand",
  completed: "success",
  cancelled: "danger",
};

export const ACTIVE_RIDE_STATUSES: RideStatus[] = ["requested", "searching", "offered", "accepted", "driver_arriving", "in_progress"];
export const isActiveRide = (s: RideStatus) => ACTIVE_RIDE_STATUSES.includes(s);

function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${className ?? ""}`} />;
}

export function RideStatusPill({ status }: { status: RideStatus }) {
  return (
    <Pill tone={RIDE_TONE[status]}>
      {isActiveRide(status) && <Dot className="animate-pulse" />}
      {RIDE_STATUS_SHORT_HE[status]}
    </Pill>
  );
}

const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  documents_required: "muted",
  under_review: "warning",
  approved: "success",
  rejected: "danger",
  suspended: "danger",
};

export function VerificationPill({ status }: { status: VerificationStatus }) {
  return <Pill tone={VERIFICATION_TONE[status]}>{VERIFICATION_STATUS_HE[status]}</Pill>;
}

const AVAILABILITY_TONE: Record<DriverAvailability, Tone> = { online: "success", busy: "brand", offline: "muted" };

export function AvailabilityPill({ availability }: { availability: DriverAvailability }) {
  return (
    <Pill tone={AVAILABILITY_TONE[availability]}>
      <Dot />
      {AVAILABILITY_HE[availability]}
    </Pill>
  );
}

const TICKET_STATUS_TONE: Record<TicketDTO["status"], Tone> = { open: "warning", in_progress: "brand", resolved: "success", closed: "muted" };
export function TicketStatusPill({ status }: { status: TicketDTO["status"] }) {
  return <Pill tone={TICKET_STATUS_TONE[status]}>{TICKET_STATUS_HE[status]}</Pill>;
}

const PRIORITY_TONE: Record<TicketDTO["priority"], Tone> = { urgent: "danger", high: "warning", normal: "muted", low: "muted" };
export function PriorityPill({ priority }: { priority: TicketDTO["priority"] }) {
  return (
    <Pill tone={PRIORITY_TONE[priority]}>
      {priority === "urgent" && <AlertOctagon size={13} aria-hidden />}
      {TICKET_PRIORITY_HE[priority]}
    </Pill>
  );
}

export function CategoryPill({ category }: { category: TicketDTO["category"] }) {
  return <Pill tone={category === "safety" || category === "incident" ? "danger" : "ink"}>{TICKET_CATEGORY_HE[category]}</Pill>;
}

const DOC_TONE = { submitted: "warning", approved: "success", rejected: "danger" } as const;
export function DocumentStatusPill({ status }: { status: keyof typeof DOCUMENT_STATUS_HE }) {
  return <Pill tone={DOC_TONE[status]}>{DOCUMENT_STATUS_HE[status]}</Pill>;
}

export function UserStatusPill({ status }: { status: "active" | "suspended" }) {
  return <Pill tone={status === "active" ? "success" : "danger"}>{status === "active" ? "פעיל" : "מושעה"}</Pill>;
}

const ROLE_TONE: Record<UserRole, Tone> = { rider: "muted", driver: "ink", support: "brand", admin: "brand" };
export function RolePill({ role }: { role: UserRole }) {
  return <Pill tone={ROLE_TONE[role]}>{USER_ROLE_HE[role]}</Pill>;
}

export const FLAG_SEVERITY_HE: Record<RideFlag["severity"], string> = { info: "מידע", warning: "אזהרה", critical: "קריטי" };
export function FlagSeverityPill({ severity }: { severity: RideFlag["severity"] }) {
  const tone: Tone = severity === "critical" ? "danger" : severity === "warning" ? "warning" : "muted";
  const Icon = severity === "critical" ? AlertOctagon : severity === "warning" ? AlertTriangle : Info;
  return (
    <Pill tone={tone}>
      <Icon size={13} aria-hidden />
      {FLAG_SEVERITY_HE[severity]}
    </Pill>
  );
}

export function FlagsCountPill({ flags }: { flags: RideFlag[] }) {
  if (!flags.length) return <span className="text-fg-muted">—</span>;
  const worst = flags.some((f) => f.severity === "critical") ? "danger" : flags.some((f) => f.severity === "warning") ? "warning" : "muted";
  return (
    <Pill tone={worst} title={flags.map((f) => f.message).join("\n")}>
      <AlertTriangle size={13} aria-hidden />
      <span className="tabular-nums">{flags.length}</span>
    </Pill>
  );
}

export function DemoPill() {
  return <Pill tone="warning">הדגמה</Pill>;
}

/** Shown next to controls that support staff can see but not use. */
export function AdminOnlyNote({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] px-2.5 py-1 text-xs font-semibold text-fg-muted ${className ?? ""}`}>
      <Lock size={12} aria-hidden />
      דורש הרשאת מנהל
    </span>
  );
}
