import { describe, expect, it } from "vitest";
import { agorotToILS, bpToPercent, formatILS, ilsToAgorot } from "@/lib/money";
import { formatDistance, formatDuration, formatEta, formatILS as reexported, initials, percentFromBp } from "@/lib/format";
import { SETTING_DEFAULTS } from "@/server/settings";

/** Strips bidi marks and non-breaking spaces from Intl output. */
const plain = (s: string) => s.replace(/[‎‏  ]/g, " ").replace(/\s+/g, " ").trim();

describe("lib/money formatILS", () => {
  it("formats agorot as shekels with the ₪ sign and 2 decimals", () => {
    const s = plain(formatILS(1234));
    expect(s).toContain("12.34");
    expect(s).toContain("₪");
    expect(plain(formatILS(0))).toContain("0.00");
    expect(plain(formatILS(123456789))).toMatch(/1,234,567\.89/);
  });

  it("prefixes negatives with a minus sign", () => {
    const s = formatILS(-500);
    expect(s.startsWith("-")).toBe(true);
    expect(plain(s)).toContain("5.00");
  });

  it("supports 0 decimals and an explicit plus sign", () => {
    expect(plain(formatILS(1250, { decimals: 0 }))).toMatch(/^13 ₪$|^₪ ?13$/);
    expect(formatILS(100, { sign: true }).startsWith("+")).toBe(true);
    expect(formatILS(0, { sign: true }).startsWith("+")).toBe(false);
    expect(formatILS(-100, { sign: true }).startsWith("-")).toBe(true);
  });

  it("is re-exported from lib/format", () => {
    expect(reexported).toBe(formatILS);
  });

  it("converts between agorot, shekels and basis points", () => {
    expect(agorotToILS(1999)).toBe(19.99);
    expect(ilsToAgorot(19.99)).toBe(1999); // 19.99 × 100 = 1998.9999…
    expect(ilsToAgorot(0.1 + 0.2)).toBe(30);
    expect(bpToPercent(1250)).toBe(12.5);
  });
});

describe("lib/format", () => {
  it("formatDistance uses metres below 1 km, one decimal below 10 km, integers above", () => {
    expect(formatDistance(null)).toBe("—");
    expect(formatDistance(undefined)).toBe("—");
    expect(formatDistance(0)).toBe("0 מ'");
    expect(formatDistance(999.4)).toBe("999 מ'");
    expect(formatDistance(1000)).toBe('1.0 ק"מ');
    expect(formatDistance(9_949)).toBe('9.9 ק"מ');
    expect(formatDistance(12_345)).toBe('12 ק"מ');
  });

  it("formatDuration rounds to minutes and switches to hours", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(20)).toBe("פחות מדקה");
    expect(formatDuration(30)).toBe("1 דק'");
    expect(formatDuration(59 * 60)).toBe("59 דק'");
    expect(formatDuration(3600)).toBe("1 ש'");
    expect(formatDuration(3900)).toBe("1 ש' 5 דק'");
    expect(formatDuration(2 * 3600 + 60)).toBe("2 ש' 1 דק'");
  });

  it("formatEta never shows less than one minute", () => {
    expect(formatEta(null)).toBe("—");
    expect(formatEta(0)).toBe("1 דק'");
    expect(formatEta(10)).toBe("1 דק'");
    expect(formatEta(600)).toBe("10 דק'");
  });

  it("percentFromBp shows a decimal only when needed", () => {
    expect(percentFromBp(1200)).toBe("12%");
    expect(percentFromBp(1250)).toBe("12.5%");
    expect(percentFromBp(0)).toBe("0%");
    expect(percentFromBp(10000)).toBe("100%");
  });

  it("initials takes the first letter of the first two words", () => {
    expect(initials("נועה לוי")).toBe("נל");
    expect(initials("  Dana   Ben  Ami ")).toBe("DB");
    expect(initials("מנהל")).toBe("מ");
    expect(initials("")).toBe("");
  });
});

describe("settings defaults", () => {
  it("defines every dispatch, demo and platform key with the right type", () => {
    const numeric = [
      "dispatch.offerTimeoutSec",
      "dispatch.searchTimeoutSec",
      "dispatch.searchRadiusM",
      "dispatch.maxOfferAttempts",
      "dispatch.driverStaleLocationSec",
      "dispatch.minAcceptanceRateBp",
      "dispatch.retryIntervalSec",
      "demo.autopilotAcceptDelaySec",
      "demo.driverSpeedMps",
    ] as const;
    expect(Object.keys(SETTING_DEFAULTS).sort()).toEqual([...numeric, "demo.autopilot", "dispatch.requirePickupPin", "platform.operatingNotice"].sort());
    for (const k of numeric) {
      expect(typeof SETTING_DEFAULTS[k], k).toBe("number");
      expect(SETTING_DEFAULTS[k], k).toBeGreaterThanOrEqual(0);
    }
    expect(typeof SETTING_DEFAULTS["demo.autopilot"]).toBe("boolean");
    expect(SETTING_DEFAULTS["dispatch.requirePickupPin"]).toBe(false); // opt-in safety feature
    expect(typeof SETTING_DEFAULTS["platform.operatingNotice"]).toBe("string");
  });

  it("ships fair, sane dispatch defaults", () => {
    expect(SETTING_DEFAULTS["dispatch.minAcceptanceRateBp"]).toBe(0);
    expect(SETTING_DEFAULTS["dispatch.offerTimeoutSec"]).toBeGreaterThan(0);
    expect(SETTING_DEFAULTS["dispatch.searchTimeoutSec"]).toBeGreaterThan(SETTING_DEFAULTS["dispatch.offerTimeoutSec"]);
    expect(SETTING_DEFAULTS["dispatch.maxOfferAttempts"]).toBeGreaterThanOrEqual(1);
  });
});
