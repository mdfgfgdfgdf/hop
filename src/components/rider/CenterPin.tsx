"use client";
import { motion } from "motion/react";
import { cn } from "@/components/ui/cn";

/** Fixed pin in the centre of the map; its tip marks the exact point. */
export function CenterPin({ lifted, kind = "pickup" }: { lifted: boolean; kind?: "pickup" | "dropoff" }) {
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2 z-[2]" aria-hidden>
      {/* ground shadow at the exact centre */}
      <motion.div
        className="absolute top-0 left-0 h-2 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/30 blur-[1px]"
        animate={{ scale: lifted ? 0.6 : 1, opacity: lifted ? 0.45 : 0.8 }}
      />
      <motion.div
        className="absolute left-0 flex -translate-x-1/2 flex-col items-center"
        style={{ bottom: 0 }}
        animate={{ y: lifted ? -14 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
      >
        <div
          className={cn(
            "grid h-11 w-11 place-items-center border-[3px] border-white shadow-[0_12px_24px_-8px_rgba(17,19,24,.55)]",
            kind === "pickup" ? "rounded-full bg-brand" : "rounded-xl bg-ink",
          )}
        >
          <div className={cn("h-3.5 w-3.5 bg-white", kind === "pickup" ? "rounded-full" : "rounded-[4px]")} />
        </div>
        <div className={cn("h-5 w-[3px] rounded-b-full", kind === "pickup" ? "bg-brand" : "bg-ink")} />
      </motion.div>
    </div>
  );
}
