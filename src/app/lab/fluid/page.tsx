import { notFound } from "next/navigation";
import { FluidLab } from "./FluidLab";

/** Development-only gallery of the HOP Fluid primitives (not routed in production). */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FluidLab />;
}
