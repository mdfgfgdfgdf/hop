import { Suspense } from "react";
import type { Metadata } from "next";
import { RidesList } from "@/components/admin/screens/Rides";
import { ListFallback } from "@/components/admin/fallbacks";

export const metadata: Metadata = { title: "נסיעות · מרכז בקרה" };

export default function RidesPage() {
  return (
    <Suspense fallback={<ListFallback title="נסיעות" />}>
      <RidesList />
    </Suspense>
  );
}
