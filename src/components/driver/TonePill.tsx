/** The shared Pill with status text darkened to ≥ 4.5:1 on its tinted background. */
import { Pill, cn } from "@/components/ui";
import { TEXT } from "./tone";

type Tone = "brand" | "ink" | "success" | "warning" | "danger" | "muted";
const TEXT_FOR: Partial<Record<Tone, string>> = { success: TEXT.success, warning: TEXT.warning, danger: TEXT.danger };

export function TonePill({ tone = "muted", className, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <Pill tone={tone} className={cn(TEXT_FOR[tone], className)} {...rest} />;
}
