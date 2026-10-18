import type { Metadata } from "next";
import { RideDetail } from "@/components/rider/history/RideDetail";

export const metadata: Metadata = { title: "פרטי נסיעה" };

export default async function RideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RideDetail id={id} />;
}
