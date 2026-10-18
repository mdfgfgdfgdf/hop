/** Inline status / error message box (light theme, tokens only). */
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/components/ui";
import { TEXT } from "./tone";

type Tone = "info" | "warning" | "danger" | "success";

const TONES: Record<Tone, string> = {
  info: "bg-brand-50 ring-brand/20",
  warning: "bg-[color-mix(in_oklab,var(--warning)_12%,var(--surface))] ring-warning/40",
  danger: "bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface))] ring-danger/30",
  success: "bg-[color-mix(in_oklab,var(--success)_9%,var(--surface))] ring-success/30",
};
const ICON_TONE: Record<Tone, string> = { info: "text-brand", warning: TEXT.warning, danger: TEXT.danger, success: TEXT.success };

export function Notice({ tone = "info", title, children, action, className, live }: { tone?: Tone; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string; live?: boolean }) {
  const Icon = tone === "danger" ? XCircle : tone === "warning" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div role={live ? (tone === "danger" ? "alert" : "status") : undefined} className={cn("flex items-start gap-3 rounded-2xl p-3.5 text-sm ring-1", TONES[tone], className)}>
      <Icon size={20} className={cn("mt-0.5 shrink-0", ICON_TONE[tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <div className="font-bold">{title}</div>}
        {children && <div className={cn("leading-relaxed", title ? "mt-0.5 text-fg-muted" : "")}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}
