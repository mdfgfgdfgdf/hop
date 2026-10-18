import type { Metadata } from "next";
import { RideDetail } from "@/components/admin/screens/RideDetail";

export const metadata: Metadata = { title: "פרטי נסיעה · מרכז בקרה" };

export default async function RidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RideDetail key={id} id={id} />;
}
