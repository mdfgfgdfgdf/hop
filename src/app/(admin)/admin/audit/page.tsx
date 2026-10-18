import { Suspense } from "react";
import type { Metadata } from "next";
import { Audit } from "@/components/admin/screens/Audit";
import { ListFallback } from "@/components/admin/fallbacks";

export const metadata: Metadata = { title: "יומן ביקורת · מרכז בקרה" };

export default function AuditPage() {
  return (
    <Suspense fallback={<ListFallback title="יומן ביקורת" />}>
      <Audit />
    </Suspense>
  );
}
