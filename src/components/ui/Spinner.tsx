import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export function Spinner({ size = 24, className, label = "טוען…" }: { size?: number; className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("inline-flex items-center justify-center text-brand", className)}>
      <Loader2 size={size} className="animate-spin" />
    </span>
  );
}
