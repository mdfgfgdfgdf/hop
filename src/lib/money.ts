/** Formatting helpers for integer agorot. Safe for client and server. */
export function formatILS(agorot: number, opts: { decimals?: 0 | 2; sign?: boolean } = {}) {
  const decimals = opts.decimals ?? 2;
  const abs = Math.abs(agorot) / 100;
  const formatted = new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(abs);
  if (agorot < 0) return `-${formatted}`;
  return opts.sign && agorot > 0 ? `+${formatted}` : formatted;
}

export const agorotToILS = (agorot: number) => agorot / 100;
export const ilsToAgorot = (ils: number) => Math.round(ils * 100);
export const bpToPercent = (bp: number) => bp / 100;
