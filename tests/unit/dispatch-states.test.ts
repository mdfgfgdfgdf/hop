import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  DRIVER_BUSY_STATUSES,
  RIDE_STATUS_HE,
  RIDE_TRANSITIONS,
  TERMINAL_STATUSES,
  assertTransition,
  canTransition,
} from "@/server/dispatch/states";
import { rideStatusEnum, type RideStatus } from "@/server/db/schema";
import { AppError } from "@/server/errors";

const ALL = rideStatusEnum.enumValues as readonly RideStatus[];

/** The lifecycle as specified: every allowed edge, nothing else. */
const EXPECTED: Record<RideStatus, RideStatus[]> = {
  requested: ["searching", "cancelled"],
  searching: ["offered", "cancelled"],
  offered: ["accepted", "searching", "cancelled"],
  accepted: ["driver_arriving", "in_progress", "searching", "cancelled"],
  driver_arriving: ["in_progress", "searching", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

function thrown(fn: () => void): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe("dispatch/states transition table", () => {
  it("covers every ride status", () => {
    expect(Object.keys(RIDE_TRANSITIONS).sort()).toEqual([...ALL].sort());
    expect(Object.keys(RIDE_STATUS_HE).sort()).toEqual([...ALL].sort());
  });

  it("matches the specified lifecycle exactly", () => {
    for (const from of ALL) expect([...RIDE_TRANSITIONS[from]].sort(), from).toEqual([...EXPECTED[from]].sort());
  });

  it("lets every allowed pair pass assertTransition", () => {
    for (const from of ALL) {
      for (const to of EXPECTED[from]) {
        expect(canTransition(from, to)).toBe(true);
        expect(() => assertTransition(from, to)).not.toThrow();
      }
    }
  });

  it("rejects every disallowed pair with a 409 invalid_transition AppError", () => {
    let rejected = 0;
    for (const from of ALL) {
      for (const to of ALL) {
        if (EXPECTED[from].includes(to)) continue;
        expect(canTransition(from, to)).toBe(false);
        const err = thrown(() => assertTransition(from, to));
        expect(err, `${from} → ${to}`).toBeInstanceOf(AppError);
        expect(err).toMatchObject({ status: 409, code: "invalid_transition", details: { from, to } });
        rejected++;
      }
    }
    // 8 × 8 pairs minus the 16 allowed edges.
    expect(rejected).toBe(64 - 16);
  });

  it("rejects representative illegal shortcuts", () => {
    for (const [from, to] of [
      ["searching", "accepted"],
      ["offered", "in_progress"],
      ["requested", "completed"],
      ["in_progress", "searching"],
      ["completed", "cancelled"],
      ["cancelled", "searching"],
      ["accepted", "accepted"],
    ] as [RideStatus, RideStatus][]) {
      expect(() => assertTransition(from, to)).toThrow(AppError);
    }
  });

  it("has no exits from terminal states", () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(["cancelled", "completed"]);
    for (const s of TERMINAL_STATUSES) expect(RIDE_TRANSITIONS[s]).toHaveLength(0);
  });

  it("lets every non-terminal state be cancelled", () => {
    for (const s of ALL.filter((x) => !TERMINAL_STATUSES.includes(x))) expect(canTransition(s, "cancelled")).toBe(true);
  });
});

describe("dispatch/states status groups", () => {
  it("ACTIVE_STATUSES is every non-terminal status", () => {
    expect([...ACTIVE_STATUSES].sort()).toEqual(["accepted", "driver_arriving", "in_progress", "offered", "requested", "searching"]);
    for (const s of TERMINAL_STATUSES) expect(ACTIVE_STATUSES).not.toContain(s);
  });

  it("DRIVER_BUSY_STATUSES are the statuses with an assigned driver", () => {
    expect([...DRIVER_BUSY_STATUSES].sort()).toEqual(["accepted", "driver_arriving", "in_progress"]);
    for (const s of DRIVER_BUSY_STATUSES) expect(ACTIVE_STATUSES).toContain(s);
    expect(DRIVER_BUSY_STATUSES).not.toContain("offered");
  });
});
