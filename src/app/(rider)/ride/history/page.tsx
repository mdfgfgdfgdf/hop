import type { Metadata } from "next";
import { HistoryList } from "@/components/rider/history/HistoryList";

export const metadata: Metadata = { title: "הנסיעות שלי" };

export default function HistoryPage() {
  return <HistoryList />;
}
