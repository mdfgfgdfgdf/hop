/** Formatting helpers for integer agorot. Safe for client and server. */
export function formatILS(agorot: number, opts: { decimals?: 0 | 2; sign?: boolean } = {}) {
  const decimals = opts.decimals ?? 2;
  // Built by hand (digits from Intl, no bidi marks) so the sign always leads the
  // number and the string renders identically inside RTL and LTR text.
  const num = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Math.abs(agorot) / 100);
  const sign = agorot < 0 ? "-" : opts.sign && agorot > 0 ? "+" : "";
  return `${sign}${num}\u00a0₪`;
}

export const agorotToILS = (agorot: number) => agorot / 100;
export const ilsToAgorot = (ils: number) => Math.round(ils * 100);
export const bpToPercent = (bp: number) => bp / 100;
