import type { Metadata } from "next";
import { Pricing } from "@/components/admin/screens/Pricing";

export const metadata: Metadata = { title: "תמחור ושירותים · מרכז בקרה" };

export default function PricingPage() {
  return <Pricing />;
}
