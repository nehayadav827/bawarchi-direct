import { getDb } from "../src/db/client";
import { seedDb } from "../src/db/seed";

const db = await getDb();
await seedDb(db);
console.log("Database migrated and seeded.");
process.exit(0);
