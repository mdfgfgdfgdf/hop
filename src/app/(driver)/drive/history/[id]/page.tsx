import { RideDetail } from "@/components/driver/RideDetail";

export const metadata = { title: "פרטי נסיעה" };

export default async function RideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RideDetail id={id} />;
}
