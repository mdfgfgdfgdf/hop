"use client";
/** Small accessible modal: bottom card on mobile, centred card on desktop. */
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/components/ui";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** alertdialog for destructive / confirm flows. */
  role?: "dialog" | "alertdialog";
  dismissible?: boolean;
};

export function Dialog({ open, onClose, title, description, children, className, role = "dialog", dismissible = true }: Props) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>("[data-autofocus], button:not([disabled]), textarea, input, select");
      el?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose, dismissible]);

  // Portal to <body>: dialogs are often opened from inside transformed
  // containers (the bottom sheet), where position:fixed would be clipped.
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center p-2 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button type="button" aria-label="סגירה" tabIndex={-1} className="absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[3px]" onClick={() => dismissible && onClose()} />
          <motion.div
            ref={panelRef}
            role={role}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            initial={{ y: 30, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className={cn("glass glass-strong relative max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-[30px] p-5 safe-bottom sm:pb-5", className)}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="display pt-1.5 text-[1.35rem] leading-tight">
                {title}
              </h2>
              {dismissible && (
                <button type="button" onClick={onClose} className="-me-1 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] text-fg-muted transition-colors hover:text-fg" aria-label="סגירה">
                  <X size={20} aria-hidden />
                </button>
              )}
            </div>
            {description && (
              <div id={descId} className="mt-1 text-sm leading-relaxed text-fg-muted">
                {description}
              </div>
            )}
            {children && <div className="mt-4">{children}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
