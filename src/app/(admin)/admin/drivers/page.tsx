import { Suspense } from "react";
import type { Metadata } from "next";
import { DriversList } from "@/components/admin/screens/Drivers";
import { ListFallback } from "@/components/admin/fallbacks";

export const metadata: Metadata = { title: "נהגים · מרכז בקרה" };

export default function DriversPage() {
  return (
    <Suspense fallback={<ListFallback title="נהגים" />}>
      <DriversList />
    </Suspense>
  );
}
