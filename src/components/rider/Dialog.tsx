"use client";
/**
 * Modal dialog: bottom sheet on mobile, centred card on desktop. Traps the
 * initial focus, closes on Escape / backdrop tap, restores focus on close.
 */
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  icon,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
  dismissible?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // false during SSR and hydration → the portal is only created on the client afterwards
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>("[data-autofocus], textarea, input, button:not([data-close])");
      target?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, dismissible, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-2 sm:items-center sm:p-6" data-theme="light">
          <motion.div
            className="absolute inset-0 bg-[rgba(17,19,24,.34)] backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dismissible && onClose()}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="glass glass-strong relative w-full max-w-md p-5 text-fg safe-bottom"
          >
            <div className="mb-4 flex items-start gap-3">
              {icon && <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand)_18%,transparent)]">{icon}</div>}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-lg font-extrabold leading-snug">
                  {title}
                </h2>
                {description && <div className="mt-1 text-sm text-fg-muted">{description}</div>}
              </div>
              {dismissible && (
                <button type="button" data-close onClick={onClose} aria-label="סגירה" className="btn btn-ghost btn-icon -me-2 -mt-2 shrink-0">
                  <X size={20} aria-hidden />
                </button>
              )}
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const noopSubscribe = () => () => {};
