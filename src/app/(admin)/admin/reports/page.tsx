import { Suspense } from "react";
import type { Metadata } from "next";
import { Reports } from "@/components/admin/screens/Reports";
import { ListFallback } from "@/components/admin/fallbacks";

export const metadata: Metadata = { title: "דוחות · מרכז בקרה" };

export default function ReportsPage() {
  return (
    <Suspense fallback={<ListFallback title="דוחות" />}>
      <Reports />
    </Suspense>
  );
}
