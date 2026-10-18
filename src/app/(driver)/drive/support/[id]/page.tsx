import { TicketThread } from "@/components/driver/TicketThread";

export const metadata = { title: "פנייה לתמיכה" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketThread id={id} />;
}
