import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./cn";

type Props = HTMLAttributes<HTMLDivElement> & { strong?: boolean; radius?: "sm" | "md" | "xl" | "pill"; brand?: boolean };

/** Liquid-glass surface. */
export const Glass = forwardRef<HTMLDivElement, Props>(function Glass({ strong, radius = "xl", brand, className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={cn("glass", strong && "glass-strong", radius === "sm" && "glass-sm", radius === "md" && "glass-md", radius === "pill" && "glass-pill", brand && "glass-brand", className)}
      {...rest}
    />
  );
});
