import type { Metadata } from "next";
import { DriverDetail } from "@/components/admin/screens/DriverDetail";

export const metadata: Metadata = { title: "פרטי נהג · מרכז בקרה" };

export default async function DriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DriverDetail key={id} id={id} />;
}
