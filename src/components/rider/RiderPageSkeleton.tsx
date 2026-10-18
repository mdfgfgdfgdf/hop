"use client";
import { Skeleton } from "@/components/ui";
import { RiderPage } from "./RiderPage";

export function RiderPageSkeleton({ title }: { title: string }) {
  return (
    <RiderPage title={title}>
      <div className="space-y-3" aria-busy="true" aria-label="טוען…">
        <Skeleton className="h-16 w-full rounded-3xl" />
        <Skeleton className="h-16 w-full rounded-3xl" />
        <Skeleton className="h-16 w-2/3 rounded-3xl" />
      </div>
    </RiderPage>
  );
}
