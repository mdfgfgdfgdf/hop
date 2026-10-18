import { initials } from "@/lib/format";
import { cn } from "./cn";

export function Avatar({ name, size = 44, className, tone = "brand" }: { name: string; size?: number; className?: string; tone?: "brand" | "ink" }) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-bold text-white", tone === "brand" ? "bg-brand" : "bg-ink", className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
