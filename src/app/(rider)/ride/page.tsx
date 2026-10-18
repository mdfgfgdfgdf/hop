import type { Metadata } from "next";
import { RideApp } from "@/components/rider/flow/RideApp";

export const metadata: Metadata = { title: "הזמנת נסיעה" };

export default function RideHome() {
  return <RideApp />;
}
