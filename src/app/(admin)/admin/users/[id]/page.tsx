import type { Metadata } from "next";
import { UserDetail } from "@/components/admin/screens/UserDetail";

export const metadata: Metadata = { title: "פרטי משתמש · מרכז בקרה" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetail key={id} id={id} />;
}
