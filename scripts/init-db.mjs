// Applies the schema to the database in DATABASE_URL.
// Usage: DATABASE_URL=... node scripts/init-db.mjs
import { neon } from "@neondatabase/serverless";
import { SCHEMA_STATEMENTS } from "../lib/schema.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(url);

for (const statement of SCHEMA_STATEMENTS) {
  await sql.query(statement);
  console.log("ok:", statement.split("\n")[0].trim().slice(0, 70));
}

console.log(`\nApplied ${SCHEMA_STATEMENTS.length} statements.`);
