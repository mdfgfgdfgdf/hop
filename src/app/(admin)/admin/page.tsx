import type { Metadata } from "next";
import { Overview } from "@/components/admin/screens/Overview";

export const metadata: Metadata = { title: "סקירה · מרכז בקרה" };

export default function AdminHome() {
  return <Overview />;
}
