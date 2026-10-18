"use client";
import { Hand } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { GlowButton } from "../motion";
import type { PlaceDTO } from "@/lib/types";
import type { FriendlyError } from "../lib/errors";
import { SheetFooter, SheetTitle } from "./SheetLayout";

export function PinSheet({
  target,
  place,
  loading,
  moving,
  error,
  onConfirm,
}: {
  target: "pickup" | "dropoff";
  place: PlaceDTO | null;
  loading: boolean;
  moving: boolean;
  error: FriendlyError | null;
  onConfirm: () => void;
}) {
  const busy = loading || moving;
  return (
    <div className="flex flex-1 flex-col">
      <SheetTitle eyebrow={target === "pickup" ? "נקודת איסוף" : "יעד"}>{target === "pickup" ? "מאיפה אוספים אתכם?" : "לאן נוסעים?"}</SheetTitle>
      <div className="tile flex min-h-16 items-center gap-3 rounded-[20px] px-3 py-2.5" aria-live="polite">
        <span
          className={
            target === "pickup"
              ? "h-4 w-4 shrink-0 rounded-full border-[3px] border-white bg-brand shadow-[0_0_0_1px_var(--line-strong),0_4px_10px_-3px_rgba(36,87,255,.6)]"
              : "h-4 w-4 shrink-0 rounded-[5px] border-[3px] border-white bg-ink shadow-[0_0_0_1px_var(--line-strong)]"
          }
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          {busy ? (
            <>
              <Skeleton className="h-4 w-44" />
              <Skeleton className="mt-1.5 h-3 w-28" />
            </>
          ) : place ? (
            <>
              <div className="truncate text-[15px] font-bold">{place.name}</div>
              <div className="truncate text-xs text-fg-muted">{place.address}</div>
            </>
          ) : (
            <div className="text-sm text-fg-muted">{error ? error.message : "לא מצאנו כתובת מדויקת — אפשר להמשיך עם הנקודה שעל המפה."}</div>
          )}
        </div>
      </div>
      <p className="mt-3 flex items-center gap-2 px-1 text-xs text-fg-muted">
        <Hand size={14} aria-hidden />
        הזיזו את המפה כדי למקם את הסיכה בדיוק במקום.
      </p>
      <SheetFooter>
        <GlowButton onClick={onConfirm} disabled={busy} data-testid="pin-confirm">
          {target === "pickup" ? "אישור נקודת איסוף" : "אישור יעד"}
        </GlowButton>
      </SheetFooter>
    </div>
  );
}
