import { Pill } from "@/components/ui";
import type { TicketDTO } from "@/lib/api";
import { TICKET_STATUS_HE } from "@/lib/labels";

const TONE = { open: "brand", in_progress: "warning", resolved: "success", closed: "muted" } as const;

export function TicketStatusPill({ status }: { status: TicketDTO["status"] }) {
  return <Pill tone={TONE[status]}>{TICKET_STATUS_HE[status]}</Pill>;
}
