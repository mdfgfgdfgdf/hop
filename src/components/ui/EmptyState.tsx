import { cn } from "./cn";

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-12 text-center", className)}>
      {icon && <div className="mb-1 grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand">{icon}</div>}
      <div className="text-base font-bold">{title}</div>
      {description && <p className="max-w-xs text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
