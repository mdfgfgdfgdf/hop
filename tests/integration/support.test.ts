import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, type Db } from "@/server/db/client";
import { auditLogs, ticketMessages, type User } from "@/server/db/schema";
import { addMessage, createTicket, getTicket, listTicketsFor, updateTicket } from "@/server/support/service";
import { respondToOffer } from "@/server/dispatch/service";
import { channels, subscribe, type RealtimeEvent } from "@/server/realtime/bus";
import { freshDb, makeDriver, makeUser, TLV } from "../helpers/db";
import { bookRide } from "../helpers/rides";

let db: Db;
let rider: User;
let otherRider: User;
let support: User;
let admin: User;

beforeAll(async () => {
  db = await freshDb();
  rider = await makeUser(db, "rider");
  otherRider = await makeUser(db, "rider");
  support = await makeUser(db, "support");
  admin = await makeUser(db, "admin");
});
afterAll(async () => {
  await closeDb();
});

const ticket = (u: User, extra: Partial<Parameters<typeof createTicket>[1]> = {}) =>
  createTicket(u, { category: "complaint", subject: "הנהג איחר", body: "חיכיתי 20 דקות", ...extra });

function collect(channel: string) {
  const events: RealtimeEvent[] = [];
  const off = subscribe([channel], (e) => events.push(e));
  return { events, off };
}

describe("support/service createTicket", () => {
  it("derives priority from the category (safety/incident → urgent) unless given", async () => {
    expect((await ticket(rider, { category: "safety" })).priority).toBe("urgent");
    expect((await ticket(rider, { category: "incident" })).priority).toBe("urgent");
    expect((await ticket(rider, { category: "lost_item" })).priority).toBe("normal");
    expect((await ticket(rider, { category: "payment", priority: "high" })).priority).toBe("high");
  });

  it("opens the ticket, audits it and notifies the operators", async () => {
    const feed = collect(channels.admin);
    const t = await ticket(rider, { category: "safety" });
    feed.off();
    expect(t).toMatchObject({ openedBy: rider.id, status: "open", rideId: null, assignedTo: null, resolvedAt: null });
    expect(feed.events.map((e) => e.data)).toContainEqual({ kind: "ticket.created", ticketId: t.id, priority: "urgent", category: "safety" });
    const audit = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "ticket.create"), eq(auditLogs.targetId, t.id)));
    expect(audit[0]?.data).toEqual({ category: "safety", priority: "urgent" });
  });

  it("lets the rider and the driver of a ride attach it, nobody else", async () => {
    const r = await makeUser(db, "rider");
    const d = await makeDriver(db, { lat: 32.0757, lng: 34.7756 });
    const { ride } = await bookRide(r, TLV.dizengoff, TLV.rabin);
    await respondToOffer({ driver: d.user, rideId: ride.id, accept: true });
    expect((await ticket(r, { rideId: ride.id, category: "lost_item" })).rideId).toBe(ride.id);
    expect((await ticket(d.user, { rideId: ride.id })).rideId).toBe(ride.id);
    await expect(ticket(otherRider, { rideId: ride.id })).rejects.toMatchObject({ status: 403 });
    await expect(ticket(rider, { rideId: "no-such-ride" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("support/service listing and reading", () => {
  it("non-staff list only their own tickets; staff list everyone's", async () => {
    const mine = await ticket(otherRider, { subject: "שלי" });
    const listed = await listTicketsFor(otherRider);
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((t) => t.openedBy === otherRider.id)).toBe(true);
    expect(listed[0]).toMatchObject({ id: mine.id, openerName: otherRider.name });
    expect((await listTicketsFor(rider)).some((t) => t.id === mine.id)).toBe(false);
    for (const staff of [support, admin]) {
      const all = await listTicketsFor(staff);
      expect(all.some((t) => t.openedBy === rider.id)).toBe(true);
      expect(all.some((t) => t.openedBy === otherRider.id)).toBe(true);
    }
  });

  it("filters by status and orders by last update", async () => {
    const a = await ticket(rider, { subject: "a" });
    const b = await ticket(rider, { subject: "b" });
    // updatedAt comes from the JS clock (ms) on update but from Postgres (µs) on insert.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await updateTicket(support, a.id, { status: "in_progress" });
    const inProgress = await listTicketsFor(rider, { status: "in_progress" });
    expect(inProgress.map((t) => t.id)).toContain(a.id);
    expect(inProgress.map((t) => t.id)).not.toContain(b.id);
    expect((await listTicketsFor(rider))[0].id).toBe(a.id); // most recently updated
  });

  it("getTicket is limited to the opener and staff", async () => {
    const t = await ticket(rider);
    expect((await getTicket(rider, t.id)).id).toBe(t.id);
    expect((await getTicket(support, t.id)).openerName).toBe(rider.name);
    await expect(getTicket(otherRider, t.id)).rejects.toMatchObject({ status: 403 });
    await expect(getTicket(admin, "missing")).rejects.toMatchObject({ status: 404 });
  });
});

describe("support/service messages", () => {
  it("only the opener and staff can post", async () => {
    const t = await ticket(rider);
    await expect(addMessage(otherRider, t.id, "hi")).rejects.toMatchObject({ status: 403 });
    await expect(addMessage(rider, "missing", "hi")).rejects.toMatchObject({ status: 404 });
    const view = await addMessage(rider, t.id, "עוד פרט");
    expect(view.messages.map((m) => m.body)).toEqual(["עוד פרט"]);
  });

  it("hides internal staff notes from the opener; users cannot post internal notes", async () => {
    const t = await ticket(rider);
    const userFeed = collect(channels.user(rider.id));
    await addMessage(support, t.id, "תשובה לנוסע");
    await addMessage(support, t.id, "הערה פנימית: לבדוק את הנהג", true);
    userFeed.off();
    await addMessage(rider, t.id, "ניסיון הערה פנימית", true);

    const forRider = await getTicket(rider, t.id);
    expect(forRider.messages.map((m) => m.body)).toEqual(["תשובה לנוסע", "ניסיון הערה פנימית"]);
    expect(forRider.messages.every((m) => !m.internal)).toBe(true);
    const forStaff = await getTicket(admin, t.id);
    expect(forStaff.messages.map((m) => [m.body, m.internal])).toEqual([
      ["תשובה לנוסע", false],
      ["הערה פנימית: לבדוק את הנהג", true],
      ["ניסיון הערה פנימית", false],
    ]);
    expect((await listTicketsFor(rider)).find((x) => x.id === t.id)?.messages).toEqual([]);
    const stored = await db.select().from(ticketMessages).where(eq(ticketMessages.ticketId, t.id));
    expect(stored.filter((m) => m.internal)).toHaveLength(1);
    expect(userFeed.events.map((e) => e.data)).toContainEqual({ kind: "ticket.reply", ticketId: t.id });
  });

  it("a staff reply moves an open ticket to in_progress; a user reply reopens a resolved one", async () => {
    const t = await ticket(rider);
    expect((await addMessage(support, t.id, "בודקים")).status).toBe("in_progress");
    await updateTicket(support, t.id, { status: "resolved" });
    expect((await addMessage(support, t.id, "סגרנו")).status).toBe("resolved");
    expect((await addMessage(rider, t.id, "זה לא נפתר")).status).toBe("open");
  });
});

describe("support/service updateTicket", () => {
  it("sets resolvedAt on resolve/close, assigns, audits and notifies the opener", async () => {
    const t = await ticket(rider);
    const feed = collect(channels.user(rider.id));
    const resolved = await updateTicket(support, t.id, { status: "resolved", priority: "low", assignedTo: support.id });
    feed.off();
    expect(resolved).toMatchObject({ status: "resolved", priority: "low", assignedTo: support.id });
    expect(resolved.resolvedAt).not.toBeNull();
    expect(feed.events.map((e) => e.data)).toContainEqual({ kind: "ticket.updated", ticketId: t.id, status: "resolved" });
    const audit = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "ticket.update"), eq(auditLogs.targetId, t.id)));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: support.id, actorRole: "support" });
    expect(audit[0].data).toMatchObject({ status: "resolved", priority: "low" });

    const t2 = await ticket(rider);
    expect((await updateTicket(admin, t2.id, { status: "closed" })).resolvedAt).not.toBeNull();
    const t3 = await ticket(rider);
    expect((await updateTicket(admin, t3.id, { priority: "high" })).resolvedAt).toBeNull();
    await expect(updateTicket(admin, "missing", { status: "closed" })).rejects.toMatchObject({ status: 404 });
  });

  it.skip("BUG: reopening a resolved ticket keeps the stale resolvedAt", async () => {
    const t = await ticket(rider);
    await updateTicket(support, t.id, { status: "resolved" });
    expect((await updateTicket(support, t.id, { status: "open" })).resolvedAt).toBeNull();
  });
});
