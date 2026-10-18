import { Suspense } from "react";
import type { Metadata } from "next";
import { SupportView } from "@/components/rider/support/SupportView";
import { RiderPageSkeleton } from "@/components/rider/RiderPageSkeleton";

export const metadata: Metadata = { title: "תמיכה" };

export default function SupportPage() {
  return (
    <Suspense fallback={<RiderPageSkeleton title="תמיכה" />}>
      <SupportView />
    </Suspense>
  );
}
