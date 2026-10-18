/**
 * Database client.
 *
 *   DATABASE_URL=pglite://./data/hop   → embedded PGlite (file-backed)   [dev default]
 *   DATABASE_URL=memory://             → embedded PGlite (in-memory)     [tests]
 *   DATABASE_URL=postgres://...        → PostgreSQL via node-postgres    [production]
 *
 * A single instance is kept on globalThis so Next.js hot reloads and route
 * handlers share one connection. `getDb()` also runs pending migrations and
 * baseline seed data once per process when enabled.
 */
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import path from "node:path";
import fs from "node:fs";
import { env } from "../env";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type Holder = {
  db?: Db;
  ready?: Promise<Db>;
  kind?: "pglite" | "postgres";
  close?: () => Promise<void>;
};

const g = globalThis as unknown as { __hopDb?: Holder };
const holder: Holder = (g.__hopDb ??= {});

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

async function connect(): Promise<Db> {
  const url = env().DATABASE_URL;

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url, max: 10 });
    const db = drizzle(pool, { schema });
    if (env().DB_AUTO_MIGRATE === "true") {
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    }
    holder.kind = "postgres";
    holder.close = () => pool.end();
    return db as unknown as Db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  let client: InstanceType<typeof PGlite>;
  if (url === "memory://" || url === "pglite://memory") {
    client = new PGlite();
  } else {
    const dir = url.replace(/^pglite:\/\//, "");
    const abs = path.resolve(process.cwd(), dir);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    client = new PGlite(abs);
  }
  const db = drizzle(client, { schema });
  if (env().DB_AUTO_MIGRATE === "true") {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  }
  holder.kind = "pglite";
  holder.close = () => client.close();
  return db as unknown as Db;
}

/** Returns the shared database, connecting + migrating on first use. */
export async function getDb(): Promise<Db> {
  if (holder.db) return holder.db;
  if (!holder.ready) {
    holder.ready = connect()
      .then(async (db) => {
        holder.db = db;
        if (env().DB_AUTO_SEED === "true") {
          const { seedBaseline } = await import("./seed");
          await seedBaseline(db);
        }
        return db;
      })
      .catch((err) => {
        holder.ready = undefined;
        throw err;
      });
  }
  return holder.ready;
}

export function dbKind() {
  return holder.kind ?? "pglite";
}

/** Closes the connection (tests / scripts). */
export async function closeDb() {
  const close = holder.close;
  holder.db = undefined;
  holder.ready = undefined;
  holder.close = undefined;
  holder.kind = undefined;
  if (close) await close();
}

export { schema };
