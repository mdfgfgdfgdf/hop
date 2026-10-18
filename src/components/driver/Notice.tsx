/** Inline status / error message box (tokens only, dark-friendly). */
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/components/ui";

type Tone = "info" | "warning" | "danger" | "success";

const TONES: Record<Tone, string> = {
  info: "border-brand/30 bg-brand/10",
  warning: "border-warning/40 bg-warning/12",
  danger: "border-danger/40 bg-danger/12",
  success: "border-success/40 bg-success/12",
};
const ICON_TONE: Record<Tone, string> = { info: "text-[#8fb0ff]", warning: "text-warning", danger: "text-[#ff8a8d]", success: "text-success" };

export function Notice({ tone = "info", title, children, action, className, live }: { tone?: Tone; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string; live?: boolean }) {
  const Icon = tone === "danger" ? XCircle : tone === "warning" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div role={live ? (tone === "danger" ? "alert" : "status") : undefined} className={cn("flex items-start gap-3 rounded-2xl border p-3.5 text-sm", TONES[tone], className)}>
      <Icon size={20} className={cn("mt-0.5 shrink-0", ICON_TONE[tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <div className="font-bold">{title}</div>}
        {children && <div className={cn("leading-relaxed", title ? "mt-0.5 text-fg-muted" : "")}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}
