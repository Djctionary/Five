// Applies db/schema.sql to the database in DATABASE_URL.
// Usage: DATABASE_URL=... node scripts/init-db.mjs
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

// The HTTP driver runs one statement per request, so split on top-level semicolons.
const statements = schema
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
  console.log("ok:", statement.split("\n")[0].slice(0, 70));
}

console.log(`\nApplied ${statements.length} statements.`);
