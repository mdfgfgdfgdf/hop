import { defineConfig } from "drizzle-kit";

// Migrations are generated from the Postgres-dialect schema and applied by
// scripts/migrate.ts (or automatically on first access in development).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
