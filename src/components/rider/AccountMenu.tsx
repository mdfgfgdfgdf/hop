"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { History, LifeBuoy, LogOut, Settings } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Avatar, useToast } from "@/components/ui";
import { useSession } from "@/components/app/session";
import { useRiderInfo } from "./RiderContext";

const ITEMS = [
  { href: "/ride/history", label: "היסטוריית נסיעות", icon: History },
  { href: "/ride/settings", label: "הגדרות", icon: Settings },
  { href: "/ride/support", label: "תמיכה", icon: LifeBuoy },
] as const;

/** Avatar button with the account dropdown (history, settings, support, logout). */
export function AccountMenu() {
  const { name } = useRiderInfo();
  const { logout } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onLogout() {
    setBusy(true);
    try {
      await logout();
    } catch {
      toast.error("ההתנתקות נכשלה", "בדקו את החיבור ונסו שוב.");
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="תפריט החשבון"
        className="grid h-11 w-11 place-items-center rounded-full ring-2 ring-white/80 transition-transform active:scale-95"
        data-testid="account-menu"
      >
        <Avatar name={name || "HOP"} size={40} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 460, damping: 34 }}
            className="glass glass-strong glass-md absolute end-0 top-[calc(100%+8px)] z-50 w-60 origin-top-left p-2"
          >
            <div className="px-3 pt-2 pb-3">
              <div className="truncate text-sm font-bold">{name}</div>
              <div className="text-xs text-fg-muted">נוסע/ת ב־HOP</div>
            </div>
            <div className="divider mb-1" />
            {ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-[color-mix(in_oklab,var(--fg)_6%,transparent)]"
              >
                <Icon size={18} className="text-fg-muted" aria-hidden />
                {label}
              </Link>
            ))}
            <div className="divider my-1" />
            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              disabled={busy}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger/10 disabled:opacity-60"
            >
              <LogOut size={18} aria-hidden />
              {busy ? "מתנתקים…" : "התנתקות"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
