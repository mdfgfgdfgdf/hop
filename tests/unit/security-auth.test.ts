import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, rateLimit } from "@/server/security/rate-limit";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/server/auth/password";
import { AppError } from "@/server/errors";

let n = 0;
const key = () => `unit-test:${++n}:${Math.random()}`;

describe("security/rate-limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows `limit` hits, then throws a 429 AppError", () => {
    const k = key();
    for (let i = 0; i < 3; i++) expect(() => rateLimit(k, 3, 60_000)).not.toThrow();
    let err: unknown;
    try {
      rateLimit(k, 3, 60_000);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ status: 429, code: "rate_limited" });
  });

  it("slides the window: old hits expire one by one", () => {
    const k = key();
    rateLimit(k, 2, 10_000); // t=0
    vi.advanceTimersByTime(4_000);
    rateLimit(k, 2, 10_000); // t=4s
    expect(() => rateLimit(k, 2, 10_000)).toThrow(AppError);
    vi.advanceTimersByTime(5_999); // t=9.999s → first hit still inside
    expect(() => rateLimit(k, 2, 10_000)).toThrow(AppError);
    vi.advanceTimersByTime(1); // t=10s → first hit expired
    expect(() => rateLimit(k, 2, 10_000)).not.toThrow();
    expect(() => rateLimit(k, 2, 10_000)).toThrow(AppError);
    vi.advanceTimersByTime(4_000); // t=14s → second hit expired
    expect(() => rateLimit(k, 2, 10_000)).not.toThrow();
  });

  it("does not count rejected attempts against the window", () => {
    const k = key();
    rateLimit(k, 1, 10_000);
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(1_000);
      expect(() => rateLimit(k, 1, 10_000)).toThrow(AppError);
    }
    vi.advanceTimersByTime(5_000); // 10 s after the only accepted hit
    expect(() => rateLimit(k, 1, 10_000)).not.toThrow();
  });

  it("keeps keys independent", () => {
    const a = key();
    const b = key();
    rateLimit(a, 1, 60_000);
    expect(() => rateLimit(a, 1, 60_000)).toThrow(AppError);
    expect(() => rateLimit(b, 1, 60_000)).not.toThrow();
  });

  it("clientIp prefers the first x-forwarded-for hop, then x-real-ip, then 'local'", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } }))).toBe("1.2.3.4");
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "5.6.7.8" } }))).toBe("5.6.7.8");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});

describe("auth/password", () => {
  it("hashes with argon2 and verifies the round trip", async () => {
    const h = await hashPassword("Sod1234!");
    expect(h).toMatch(/^\$argon2/);
    expect(h).not.toContain("Sod1234!");
    expect(await verifyPassword(h, "Sod1234!")).toBe(true);
  });

  it("rejects a wrong password and a malformed hash without throwing", async () => {
    const h = await hashPassword("Sod1234!");
    expect(await verifyPassword(h, "sod1234!")).toBe(false);
    expect(await verifyPassword(h, "")).toBe(false);
    expect(await verifyPassword("not-a-hash", "Sod1234!")).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("Same1234")).not.toBe(await hashPassword("Same1234"));
  });

  it("validatePasswordStrength enforces length, a digit and a letter", () => {
    expect(validatePasswordStrength("Abc1234")).toMatch(/8/); // 7 chars
    expect(validatePasswordStrength("abcdefgh")).toMatch(/ספרה/);
    expect(validatePasswordStrength("12345678")).toMatch(/אותיות/);
    expect(validatePasswordStrength("!!!!!!!1")).toMatch(/אותיות/);
    expect(validatePasswordStrength("abcdefg1")).toBeNull();
    expect(validatePasswordStrength("ABCDEFG1")).toBeNull();
  });

  it("counts Hebrew letters as letters", () => {
    expect(validatePasswordStrength("שלוםשלום1")).toBeNull();
    expect(validatePasswordStrength("סיסמה12")).not.toBeNull(); // 7 chars
    expect(validatePasswordStrength("סיסמה123")).toBeNull();
  });
});
