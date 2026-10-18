import { desc, eq, and, type SQL } from "drizzle-orm";
import { getDb, type Db, type Tx } from "../db/client";
import { auditLogs } from "../db/schema";

export type AuditInput = {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  data?: Record<string, unknown>;
  ip?: string | null;
};

/** Records a privileged / important action. Never throws to the caller. */
export async function audit(input: AuditInput, db?: Db | Tx) {
  try {
    const conn = db ?? (await getDb());
    await conn.insert(auditLogs).values({
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      data: input.data ?? {},
      ip: input.ip ?? null,
    });
  } catch (err) {
    console.error("[audit] failed", err);
  }
}

export async function listAudit(opts: { limit?: number; actorId?: string; targetType?: string; targetId?: string } = {}) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (opts.actorId) conds.push(eq(auditLogs.actorId, opts.actorId));
  if (opts.targetType) conds.push(eq(auditLogs.targetType, opts.targetType));
  if (opts.targetId) conds.push(eq(auditLogs.targetId, opts.targetId));
  return db
    .select()
    .from(auditLogs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(opts.limit ?? 100);
}
