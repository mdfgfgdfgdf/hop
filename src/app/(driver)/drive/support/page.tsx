import { Suspense } from "react";
import { SupportView } from "@/components/driver/SupportView";

export const metadata = { title: "תמיכה ובטיחות" };

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="bg-aurora min-h-dvh" />}>
      <SupportView />
    </Suspense>
  );
}
