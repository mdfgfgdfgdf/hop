import "dotenv/config";
import { getDb, closeDb } from "../src/server/db/client";
import { seedBaseline, seedDemo } from "../src/server/db/seed";

process.env.DB_AUTO_MIGRATE = "true";
process.env.DB_AUTO_SEED = "false";

getDb()
  .then(async (db) => {
    await seedBaseline(db);
    if (process.env.HOP_DEMO_MODE !== "false") {
      await seedDemo(db);
      console.log("✓ demo data seeded (HOP_DEMO_MODE)");
    }
    console.log("✓ baseline seeded");
    await closeDb();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
