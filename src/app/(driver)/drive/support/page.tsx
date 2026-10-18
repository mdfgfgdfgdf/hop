import { Suspense } from "react";
import { SupportView } from "@/components/driver/SupportView";

export const metadata = { title: "תמיכה ובטיחות" };

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <SupportView />
    </Suspense>
  );
}
