"use client";
/**
 * Modal dialog (portal to <body> so transformed/glass ancestors can't trap
 * it) and a ConfirmDialog for destructive actions with an optional
 * required reason. Escape and backdrop close it; focus moves inside.
 */
import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { Button, Field, Textarea, cn } from "@/components/ui";
import { errorMessage } from "./hooks";
import { InlineError } from "./ui";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const requestClose = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>("[data-autofocus],textarea,input,select") ?? panelRef.current?.querySelector<HTMLElement>("button");
      target?.focus();
    }, 30);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="admin-portal fixed inset-0 z-[90] flex items-end justify-center p-3 sm:items-center sm:p-6" dir="rtl" data-theme="light">
          <motion.div
            className="absolute inset-0 bg-[rgba(17,19,24,0.42)] backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cn("card relative max-h-[88dvh] w-full overflow-y-auto text-fg shadow-[0_40px_90px_-30px_rgba(17,19,24,.6)]", size === "lg" ? "max-w-2xl" : "max-w-md")}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-extrabold leading-tight">
                  {title}
                </h2>
                {description && <div className="mt-1.5 text-sm leading-relaxed text-fg-muted">{description}</div>}
              </div>
              <button type="button" onClick={onClose} aria-label="סגירה" className="-me-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-[color-mix(in_oklab,var(--fg)_6%,transparent)]">
                <X size={18} />
              </button>
            </div>
            {children && <div className="px-5 pt-4">{children}</div>}
            {footer && <div className="flex flex-col-reverse gap-2 px-5 pb-5 pt-5 sm:flex-row sm:justify-start">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary" | "success";
  /** Ask for a free-text reason; `required` blocks confirm until filled. */
  reason?: { label: string; placeholder?: string; required?: boolean; minLength?: number; hint?: string };
  /** Extra form content rendered above the reason. */
  children?: React.ReactNode;
  /** Return a rejected promise to keep the dialog open and show the error inline. */
  onConfirm: (reason: string) => Promise<void>;
  /** Optional custom error formatter (e.g. for 409 documents_missing). */
  formatError?: (err: unknown) => React.ReactNode;
  disabled?: boolean;
};

export function ConfirmDialog({ open, onClose, options }: { open: boolean; onClose: () => void; options: ConfirmOptions | null }) {
  return (
    <Modal open={open && !!options} onClose={onClose} title={options?.title ?? ""} description={options?.description}>
      {options && <ConfirmBody key={options.title + options.confirmLabel} options={options} onClose={onClose} />}
    </Modal>
  );
}

function ConfirmBody({ options, onClose }: { options: ConfirmOptions; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<React.ReactNode>(null);
  const min = options.reason?.minLength ?? (options.reason?.required ? 2 : 0);
  const invalid = !!options.reason && reason.trim().length < min;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid || options.disabled) return;
    setBusy(true);
    setError(null);
    try {
      await options.onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(options.formatError ? options.formatError(err) : errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-5">
      {options.children}
      {options.reason && (
        <Field label={options.reason.label + (options.reason.required ? " *" : "")} hint={options.reason.hint}>
          {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={options.reason?.placeholder} maxLength={300} className="min-h-[96px]" />}
        </Field>
      )}
      {error && (typeof error === "string" ? <InlineError message={error} /> : <div role="alert">{error}</div>)}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-start">
        <Button type="submit" variant={options.tone === "danger" ? "danger" : options.tone === "success" ? "success" : "primary"} loading={busy} disabled={invalid || options.disabled} className="sm:min-w-36">
          {options.confirmLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

/** Small helper hook: `confirm(opts)` opens the dialog; render `dialog` once. */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const confirm = useCallback((o: ConfirmOptions) => {
    setOptions(o);
    setOpen(true);
  }, []);
  const dialog = <ConfirmDialog open={open} onClose={close} options={options} />;
  return { confirm, dialog };
}
