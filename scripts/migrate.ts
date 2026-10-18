import "dotenv/config";
import { getDb, closeDb, dbKind } from "../src/server/db/client";

process.env.DB_AUTO_MIGRATE = "true";
process.env.DB_AUTO_SEED = process.env.DB_AUTO_SEED ?? "false";

getDb()
  .then(async () => {
    console.log(`✓ migrations applied (${dbKind()})`);
    await closeDb();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
