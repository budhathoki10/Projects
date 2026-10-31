import { describe, expect, it, vi } from "vitest";
import { recheckRenewals, renewalsToCheck } from "@/lib/billing/renewal-check";

const DAY = 86_400_000;
const now = new Date("2026-11-01T12:00:00Z");
const row = (daysFromNow: number, extra: Partial<{ cancelledAt: Date; suspended: boolean; freemiusLicenseId: string | null }> = {}) => ({
  freemiusLicenseId: "lic-1",
  paidThrough: new Date(now.getTime() + daysFromNow * DAY),
  cancelledAt: null,
  suspended: false,
  ...extra,
});

describe("missed-renewal safety net", () => {
  it("checks only renewing subscriptions due between 7 days ago and 2 days ahead", () => {
    expect(renewalsToCheck([row(1)], now)).toEqual(["lic-1"]);
    expect(renewalsToCheck([row(-3)], now)).toEqual(["lic-1"]);
    expect(renewalsToCheck([row(10)], now)).toEqual([]); // not due yet
    expect(renewalsToCheck([row(-9)], now)).toEqual([]); // long over
    expect(renewalsToCheck([row(1, { cancelledAt: now })], now)).toEqual([]); // won't renew
    expect(renewalsToCheck([row(1, { suspended: true })], now)).toEqual([]);
    expect(renewalsToCheck([row(1, { freemiusLicenseId: null })], now)).toEqual([]);
  });

  it("re-reads due licenses from Freemius, at most once an hour", async () => {
    const sync = vi.fn(async () => null);
    let calls = 0;
    const limited = vi.fn(async () => ++calls > 1);
    const deps = { rows: async () => [row(1)], sync, limited };
    expect(await recheckRenewals("u1", now, deps)).toBe(1);
    expect(await recheckRenewals("u1", now, deps)).toBe(0);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith("lic-1", now);
  });

  it("does no work, not even a rate-limit write, when nothing is due", async () => {
    const limited = vi.fn(async () => false);
    const sync = vi.fn(async () => null);
    expect(await recheckRenewals("u1", now, { rows: async () => [row(20)], sync, limited })).toBe(0);
    expect(limited).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  it("never throws when Freemius is unreachable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deps = { rows: async () => [row(0)], sync: async () => Promise.reject(new Error("timeout")), limited: async () => false };
    await expect(recheckRenewals("u1", now, deps)).resolves.toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
