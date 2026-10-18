import { cn } from "@/components/ui/cn";

/** Column layout inside <Sheet>: on desktop it fills the side panel so the footer sits at the bottom. */
export function SheetBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col lg:min-h-[calc(100dvh-5.5rem)]", className)}>{children}</div>;
}

/** Sticky footer holding the single primary CTA. */
export function SheetFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-5 mt-auto px-5 pt-4 pb-0.5",
        "bg-[linear-gradient(to_top,var(--glass-bg-strong)_70%,transparent)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SheetTitle({ children, eyebrow, className, id }: { children: React.ReactNode; eyebrow?: React.ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("mb-4", className)}>
      {eyebrow && <div className="mb-1 text-xs font-bold text-fg-muted">{eyebrow}</div>}
      <h2 id={id} className="display text-[26px]">
        {children}
      </h2>
    </div>
  );
}
