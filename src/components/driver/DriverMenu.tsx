"use client";
/** Slide-in navigation drawer (from the end edge, next to the menu button). */
import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChartNoAxesColumn, ChevronLeft, History, LifeBuoy, LogOut, Star, UserRound, X } from "lucide-react";
import { Avatar, cn } from "@/components/ui";
import { TonePill } from "./TonePill";
import { AnimatedLogo } from "@/components/brand/AnimatedLogo";
import { useSession } from "@/components/app/session";
import { AVAILABILITY_HE } from "@/lib/labels";
import { useDriverRuntime } from "./DriverRuntime";
import { Plate } from "./Plate";
import { CHIP, TEXT, TILE } from "./tone";

export const DRIVER_NAV = [
  { href: "/drive/earnings", label: "הכנסות", icon: ChartNoAxesColumn },
  { href: "/drive/history", label: "היסטוריה", icon: History },
  { href: "/drive/profile", label: "פרופיל ומסמכים", icon: UserRound },
  { href: "/drive/support", label: "תמיכה ובטיחות", icon: LifeBuoy },
] as const;

export function DriverMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useSession();
  const { profile } = useDriverRuntime();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const vehicle = [profile?.vehicleMake, profile?.vehicleModel].filter(Boolean).join(" ");
  const online = profile != null && profile.availability !== "offline";
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[65]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" tabIndex={-1} aria-label="סגירת התפריט" className="absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[3px]" onClick={onClose} />
          <motion.nav
            aria-label="תפריט נהג"
            initial={{ x: "-104%" }}
            animate={{ x: 0 }}
            exit={{ x: "-104%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            className="glass glass-strong absolute inset-y-2 end-2 flex [--glass-bg-strong:rgba(242,244,249,0.92)] w-[min(340px,86vw)] flex-col overflow-y-auto rounded-[30px] p-4 safe-top"
          >
            <div className="flex items-center justify-between ps-1">
              <AnimatedLogo height={26} hopOn="both" mode={online ? "moving" : "idle"} />
              <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] text-fg-muted transition-colors hover:text-fg" aria-label="סגירת התפריט" autoFocus>
                <X size={20} aria-hidden />
              </button>
            </div>
            <div className={cn(TILE, "mt-4 rounded-[22px] p-3")}>
              <div className="flex items-center gap-3">
                <Avatar name={user?.name ?? "נהג"} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-extrabold">{user?.name ?? "…"}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                    {profile?.rating != null && (
                      <span className="inline-flex items-center gap-1 font-bold text-fg">
                        <Star size={13} className="fill-amber-400 text-amber-400" aria-hidden />
                        <span className="tabular-nums">{profile.rating.toFixed(1)}</span>
                      </span>
                    )}
                    {vehicle && <span className="truncate">{vehicle}</span>}
                  </div>
                </div>
                {profile && (
                  <TonePill tone={online ? "brand" : "muted"} className="shrink-0">
                    {AVAILABILITY_HE[profile.availability]}
                  </TonePill>
                )}
              </div>
              {profile?.vehiclePlate && (
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-xs font-semibold text-fg-muted">
                  <span>הרכב שלך</span>
                  <Plate plate={profile.vehiclePlate} size="sm" />
                </div>
              )}
            </div>
            <ul className="mt-3 grid gap-1">
              {DRIVER_NAV.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} onClick={onClose} className="flex min-h-14 items-center gap-3 rounded-2xl px-2 font-bold transition-colors hover:bg-surface/70">
                    <span className={cn("grid h-10 w-10 place-items-center rounded-xl", CHIP.brand)}>
                      <Icon size={20} aria-hidden />
                    </span>
                    <span className="flex-1">{label}</span>
                    <ChevronLeft size={18} className="text-fg-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-4">
              <button type="button" onClick={() => void logout()} className={cn("flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 font-bold transition-colors hover:bg-danger/8", TEXT.danger)}>
                <span className={cn("grid h-10 w-10 place-items-center rounded-xl", CHIP.danger)}>
                  <LogOut size={20} aria-hidden />
                </span>
                התנתקות
              </button>
              <p className="mt-3 px-2 text-[11px] leading-relaxed text-fg-muted">HOP מחברת נוסעים לנהגים מורשים בלבד. אין נסיעות ברכב פרטי.</p>
            </div>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
