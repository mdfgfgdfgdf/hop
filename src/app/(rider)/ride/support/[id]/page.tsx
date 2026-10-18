import type { Metadata } from "next";
import { TicketThread } from "@/components/rider/support/TicketThread";

export const metadata: Metadata = { title: "פנייה לתמיכה" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketThread id={id} />;
}
