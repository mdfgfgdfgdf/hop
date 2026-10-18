import { cn } from "./cn";

export function Stat({ label, value, hint, className, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; className?: string; tone?: "brand" | "success" | "danger" | "warning" }) {
  return (
    <div className={cn("card p-4", className)}>
      <div className="text-xs font-semibold text-fg-muted">{label}</div>
      <div className={cn("mt-1 text-2xl font-extrabold tabular-nums tracking-tight", tone === "brand" && "text-brand", tone === "success" && "text-success", tone === "danger" && "text-danger", tone === "warning" && "text-amber-600")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </div>
  );
}
