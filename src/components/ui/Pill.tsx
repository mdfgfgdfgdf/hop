import { cn } from "./cn";

type Tone = "brand" | "ink" | "success" | "warning" | "danger" | "muted";

export function Pill({ tone = "muted", className, children, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={cn("pill", `pill-${tone}`, className)} {...rest}>
      {children}
    </span>
  );
}
