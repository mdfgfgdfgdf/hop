"use client";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, BadgeCheck, Clock, LocateFixed, ReceiptText, Search, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Pill, Skeleton } from "@/components/ui";
import type { RecentPlace } from "../lib/storage";
import { StaggerItem, StaggerList } from "../motion";
import { SheetTitle } from "./SheetLayout";
import type { SelectedPlace } from "./types";
import { placeLabel } from "./types";

export function HomeSheet({
  pickup,
  pickupLoading,
  approx,
  recents,
  onSearch,
  onEditPickup,
  onPickRecent,
}: {
  pickup: SelectedPlace | null;
  pickupLoading: boolean;
  approx: boolean;
  recents: RecentPlace[];
  onSearch: () => void;
  onEditPickup: () => void;
  onPickRecent: (p: RecentPlace) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-1 flex-col">
      <SheetTitle>לאן נוסעים?</SheetTitle>
      <motion.button
        type="button"
        onClick={onSearch}
        whileTap={reduce ? undefined : { scale: 0.98 }}
        whileHover={reduce ? undefined : { y: -1 }}
        transition={{ type: "spring", stiffness: 600, damping: 30 }}
        className="group relative flex h-[60px] w-full items-center gap-3 overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,#3566ff_0%,var(--brand)_55%,var(--brand-600)_100%)] ps-4 pe-3 text-start text-white shadow-[0_16px_34px_-14px_rgba(36,87,255,.75),inset_0_1px_0_rgba(255,255,255,.35)]"
        data-testid="destination-trigger"
      >
        {!reduce && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-24 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent)]"
            initial={{ x: "120%" }}
            animate={{ x: ["120%", "-520%"] }}
            transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 3.2, ease: "easeInOut" }}
            style={{ insetInlineStart: 0 }}
          />
        )}
        <Search size={22} aria-hidden />
        <span className="flex-1 text-[17px] font-bold">חיפוש יעד</span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 transition-transform group-hover:-translate-x-0.5">
          <ArrowLeft size={20} aria-hidden />
        </span>
      </motion.button>

      <button
        type="button"
        onClick={onEditPickup}
        className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface/70 px-3 py-2 text-start transition-colors hover:bg-surface"
        aria-label="שינוי נקודת האיסוף"
        data-testid="pickup-row"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-brand">
          <LocateFixed size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[11px] font-bold text-fg-muted">
            איסוף מ־
            {approx && (
              <Pill tone="warning" className="h-5! px-2! text-[10px]!">
                מיקום משוער
              </Pill>
            )}
          </span>
          {pickupLoading || !pickup ? (
            <Skeleton className="mt-1 h-4 w-40" />
          ) : (
            <span className="block truncate text-[15px] font-semibold">{placeLabel(pickup)}</span>
          )}
        </span>
        <span className="shrink-0 text-sm font-bold text-brand">שינוי</span>
      </button>

      <div className="mt-5">
        <div className="mb-1 px-1 text-xs font-bold text-fg-muted">יעדים אחרונים</div>
        {recents.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">
              <Sparkles size={17} aria-hidden />
            </span>
            <p className="text-sm text-fg-muted">
              <b className="text-fg">עוד אין פה כלום — עדיין.</b> המקומות שתיסעו אליהם יחכו לכם כאן, במרחק נגיעה.
            </p>
          </div>
        ) : (
          <StaggerList className="-mx-1">
            {recents.slice(0, 3).map((p) => (
              <StaggerItem key={`${p.lat},${p.lng}`}>
                <button
                  type="button"
                  onClick={() => onPickRecent(p)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-1 py-2 text-start transition-colors hover:bg-[color-mix(in_oklab,var(--fg)_5%,transparent)]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--fg)_7%,transparent)] text-fg-muted">
                    <Clock size={17} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                    <span className="block truncate text-xs text-fg-muted">{p.address}</span>
                  </span>
                  <ArrowLeft size={16} className="shrink-0 text-fg-muted" aria-hidden />
                </button>
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
      <div className="mt-auto hidden pt-8 lg:block">
        <div className="rounded-[24px] border border-line bg-surface/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Logo height={20} />
            <span className="text-xs font-bold text-fg-muted">העיר שלך. הופ אחד.</span>
          </div>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center gap-2.5">
              <ReceiptText size={17} className="shrink-0 text-brand" aria-hidden />
              <span>
                <b>המחיר לפני ההזמנה</b> — מחושב בשרת, בלי הפתעות.
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <BadgeCheck size={17} className="shrink-0 text-brand" aria-hidden />
              <span>
                <b>נהגים מאומתים</b> — רישיונות ומסמכים נבדקים מראש.
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Sparkles size={17} className="shrink-0 text-brand" aria-hidden />
              <span>
                <b>עמלה שקופה</b> — רואים כמה מקבל הנהג וכמה HOP.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
