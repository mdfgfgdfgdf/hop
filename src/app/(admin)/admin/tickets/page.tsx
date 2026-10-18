import { Suspense } from "react";
import type { Metadata } from "next";
import { TicketsList } from "@/components/admin/screens/Tickets";
import { ListFallback } from "@/components/admin/fallbacks";

export const metadata: Metadata = { title: "פניות · מרכז בקרה" };

export default function TicketsPage() {
  return (
    <Suspense fallback={<ListFallback title="פניות" />}>
      <TicketsList />
    </Suspense>
  );
}
