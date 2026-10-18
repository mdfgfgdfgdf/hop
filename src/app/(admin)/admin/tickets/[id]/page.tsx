import type { Metadata } from "next";
import { TicketDetail } from "@/components/admin/screens/TicketDetail";

export const metadata: Metadata = { title: "פנייה · מרכז בקרה" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDetail key={id} id={id} />;
}
