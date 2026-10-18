import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MapLab } from "./MapLab";

/** Development-only playground for the shared map (not routed in production). */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <MapLab />
    </Suspense>
  );
}
