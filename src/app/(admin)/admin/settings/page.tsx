import type { Metadata } from "next";
import { Settings } from "@/components/admin/screens/Settings";

export const metadata: Metadata = { title: "הגדרות · מרכז בקרה" };

export default function SettingsPage() {
  return <Settings />;
}
