"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, TicketPercent, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import type { FriendlyError } from "../lib/errors";

export function PromoField({ applied, onApply, onClear }: { applied: string | null; onApply: (code: string) => Promise<FriendlyError | null>; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (applied) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-2xl bg-success/10 px-3 text-sm">
        <Check size={16} className="text-success" aria-hidden />
        <span className="flex-1 font-semibold">
          קופון <span className="ltr-nums font-extrabold">{applied}</span> הופעל
        </span>
        <button type="button" onClick={onClear} className="grid h-9 w-9 place-items-center rounded-full text-fg-muted hover:bg-[color-mix(in_oklab,var(--fg)_6%,transparent)]" aria-label="הסרת הקופון">
          <X size={16} aria-hidden />
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError("הקלידו קוד קופון");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await onApply(code);
    setBusy(false);
    if (err) setError(err.code === "invalid_promo" ? "הקוד אינו תקף או שפג תוקפו" : err.message);
    else {
      setCode("");
      setOpen(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-bold text-fg-muted hover:text-fg">
        <TicketPercent size={18} aria-hidden />
        יש לכם קוד קופון?
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form onSubmit={submit} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }} exit={{ height: 0, opacity: 0, overflow: "hidden" }} className="overflow-hidden" noValidate>
            <div className="flex gap-2 pt-1 pb-1">
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                placeholder="לדוגמה HOP10"
                aria-label="קוד קופון"
                dir="ltr"
                className="h-12 flex-1 text-start uppercase"
                maxLength={32}
                invalid={!!error}
                autoCapitalize="characters"
              />
              <Button type="submit" variant="ink" className="h-12" loading={busy}>
                החלה
              </Button>
            </div>
            {error && (
              <div className="field-error px-1 pb-1" role="alert">
                {error}
              </div>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
