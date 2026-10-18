import type { Metadata } from "next";
import { SettingsView } from "@/components/rider/settings/SettingsView";

export const metadata: Metadata = { title: "הגדרות" };

export default function SettingsPage() {
  return <SettingsView />;
}
