import { and, desc, eq, type SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import { rides, supportTickets, ticketMessages, users, type SupportTicket, type TicketMessage, type User } from "../db/schema";
import { forbidden, notFound } from "../errors";
import { audit } from "../audit";
import { channels, publish } from "../realtime/bus";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function serializeTicket(t: SupportTicket, extra: { openerName?: string; messages?: (TicketMessage & { authorName?: string | null })[]; viewerIsStaff: boolean }) {
  return {
    id: t.id,
    rideId: t.rideId,
    openedBy: t.openedBy,
    openerName: extra.openerName ?? null,
    category: t.category,
    priority: t.priority,
    status: t.status,
    subject: t.subject,
    body: t.body,
    assignedTo: t.assignedTo,
    resolvedAt: iso(t.resolvedAt),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    messages: (extra.messages ?? [])
      .filter((m) => extra.viewerIsStaff || !m.internal)
      .map((m) => ({ id: m.id, authorId: m.authorId, authorName: m.authorName ?? null, body: m.body, internal: m.internal, createdAt: m.createdAt.toISOString() })),
  };
}
export type TicketDTO = ReturnType<typeof serializeTicket>;

export async function createTicket(user: User, input: { rideId?: string | null; category: SupportTicket["category"]; subject: string; body: string; priority?: SupportTicket["priority"] }) {
  const db = await getDb();
  if (input.rideId) {
    const [ride] = await db.select({ riderId: rides.riderId, driverId: rides.driverId }).from(rides).where(eq(rides.id, input.rideId));
    if (!ride) throw notFound("הנסיעה לא נמצאה");
    if (ride.riderId !== user.id && ride.driverId !== user.id) throw forbidden();
  }
  const priority = input.priority ?? (input.category === "safety" || input.category === "incident" ? "urgent" : "normal");
  const [t] = await db
    .insert(supportTickets)
    .values({ rideId: input.rideId ?? null, openedBy: user.id, category: input.category, subject: input.subject, body: input.body, priority })
    .returning();
  publish(channels.admin, "notification", { kind: "ticket.created", ticketId: t.id, priority, category: input.category });
  await audit({ actorId: user.id, actorRole: user.role, action: "ticket.create", targetType: "ticket", targetId: t.id, data: { category: input.category, priority } });
  return t;
}

export async function listTicketsFor(user: User, filter: { status?: SupportTicket["status"]; limit?: number } = {}) {
  const db = await getDb();
  const staff = user.role === "admin" || user.role === "support";
  const conds: SQL[] = [];
  if (!staff) conds.push(eq(supportTickets.openedBy, user.id));
  if (filter.status) conds.push(eq(supportTickets.status, filter.status));
  const rows = await db
    .select({ t: supportTickets, openerName: users.name })
    .from(supportTickets)
    .innerJoin(users, eq(users.id, supportTickets.openedBy))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(supportTickets.updatedAt))
    .limit(filter.limit ?? 100);
  return rows.map((r) => serializeTicket(r.t, { openerName: r.openerName, viewerIsStaff: staff }));
}

export async function getTicket(user: User, id: string) {
  const db = await getDb();
  const staff = user.role === "admin" || user.role === "support";
  const [row] = await db
    .select({ t: supportTickets, openerName: users.name })
    .from(supportTickets)
    .innerJoin(users, eq(users.id, supportTickets.openedBy))
    .where(eq(supportTickets.id, id));
  if (!row) throw notFound();
  if (!staff && row.t.openedBy !== user.id) throw forbidden();
  const messages = (
    await db
      .select({ m: ticketMessages, authorName: users.name })
      .from(ticketMessages)
      .leftJoin(users, eq(users.id, ticketMessages.authorId))
      .where(eq(ticketMessages.ticketId, id))
      .orderBy(ticketMessages.createdAt)
  ).map((r) => ({ ...r.m, authorName: r.authorName }));
  return serializeTicket(row.t, { openerName: row.openerName, messages, viewerIsStaff: staff });
}

export async function addMessage(user: User, ticketId: string, body: string, internal = false) {
  const db = await getDb();
  const staff = user.role === "admin" || user.role === "support";
  const [t] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId));
  if (!t) throw notFound();
  if (!staff && t.openedBy !== user.id) throw forbidden();
  await db.insert(ticketMessages).values({ ticketId, authorId: user.id, body, internal: staff && internal });
  const nextStatus = staff ? (t.status === "open" ? "in_progress" : t.status) : t.status === "resolved" ? "open" : t.status;
  await db
    .update(supportTickets)
    .set({ status: nextStatus, resolvedAt: nextStatus === "resolved" || nextStatus === "closed" ? t.resolvedAt : null, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId));
  if (!staff) publish(channels.admin, "notification", { kind: "ticket.message", ticketId });
  else publish(channels.user(t.openedBy), "notification", { kind: "ticket.reply", ticketId });
  return getTicket(user, ticketId);
}

export async function updateTicket(staff: User, ticketId: string, patch: { status?: SupportTicket["status"]; priority?: SupportTicket["priority"]; assignedTo?: string | null }) {
  const db = await getDb();
  const [t] = await db
    .update(supportTickets)
    .set({
      ...patch,
      resolvedAt: patch.status === undefined ? undefined : patch.status === "resolved" || patch.status === "closed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(supportTickets.id, ticketId))
    .returning();
  if (!t) throw notFound();
  await audit({ actorId: staff.id, actorRole: staff.role, action: "ticket.update", targetType: "ticket", targetId: ticketId, data: patch as Record<string, unknown> });
  publish(channels.user(t.openedBy), "notification", { kind: "ticket.updated", ticketId, status: t.status });
  return getTicket(staff, ticketId);
}
