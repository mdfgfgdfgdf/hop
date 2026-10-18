import { describe, expect, it } from "vitest";
import { channels, publish, subscribe, type RealtimeEvent } from "@/server/realtime/bus";

describe("realtime/bus", () => {
  it("delivers published events to subscribers with id, type, timestamp and data", () => {
    const got: RealtimeEvent[] = [];
    const off = subscribe(["unit:a"], (e) => got.push(e));
    const sent = publish("unit:a", "notification", { kind: "hello" });
    off();
    expect(got).toEqual([sent]);
    expect(sent.type).toBe("notification");
    expect(sent.data).toEqual({ kind: "hello" });
    expect(new Date(sent.at).toISOString()).toBe(sent.at);
    expect(sent.id).toMatch(/^[0-9a-z]+-[0-9a-z]+$/);
  });

  it("gives every event a unique id", () => {
    const ids = new Set(Array.from({ length: 50 }, () => publish("unit:ids", "ping", null).id));
    expect(ids.size).toBe(50);
  });

  it("only delivers events on subscribed channels, across several channels", () => {
    const got: string[] = [];
    const off = subscribe(["unit:x", "unit:y"], (e) => got.push(String(e.data)));
    publish("unit:x", "ping", "x1");
    publish("unit:z", "ping", "z1");
    publish("unit:y", "ping", "y1");
    off();
    expect(got).toEqual(["x1", "y1"]);
  });

  it("stops delivering after unsubscribe, without affecting other subscribers", () => {
    const first: unknown[] = [];
    const second: unknown[] = [];
    const offFirst = subscribe(["unit:u"], (e) => first.push(e.data));
    const offSecond = subscribe(["unit:u"], (e) => second.push(e.data));
    publish("unit:u", "ping", 1);
    offFirst();
    publish("unit:u", "ping", 2);
    offSecond();
    publish("unit:u", "ping", 3);
    expect(first).toEqual([1]);
    expect(second).toEqual([1, 2]);
  });

  it("names channels per user, per ride and for the admin feed", () => {
    expect(channels.user("u1")).toBe("user:u1");
    expect(channels.ride("r1")).toBe("ride:r1");
    expect(channels.admin).toBe("admin");
  });
});
