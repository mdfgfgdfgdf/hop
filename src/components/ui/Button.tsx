"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

type Variant = "primary" | "glass" | "ink" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, block && "btn-block", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={20} aria-hidden /> : null}
      {children}
    </button>
  );
});
