import { AlertTriangle } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { FriendlyError } from "./lib/errors";

export function InlineError({ error, action, className }: { error: Pick<FriendlyError, "title" | "message">; action?: React.ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("flex items-start gap-3 rounded-2xl bg-danger/10 px-4 py-3 text-danger", className)}>
      <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{error.title}</div>
        <div className="text-sm text-fg">{error.message}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
