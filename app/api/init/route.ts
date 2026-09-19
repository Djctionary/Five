import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SCHEMA_STATEMENTS } from "@/lib/schema.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Creates the tables, using the connection string the deployment already has.
 * Every statement is `if not exists`, so calling this again changes nothing.
 *
 * Guarded by MIGRATE_TOKEN. With that variable unset the route does nothing,
 * so it can be left in place after the first run.
 */
export async function GET(request: Request) {
  const expected = process.env.MIGRATE_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "MIGRATE_TOKEN 未配置" }, { status: 404 });
  }

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!timingSafeEqual(digest(token), digest(expected))) {
    return NextResponse.json({ error: "token 不正确" }, { status: 403 });
  }

  const applied: string[] = [];
  try {
    for (const statement of SCHEMA_STATEMENTS) {
      await sql.query(statement);
      applied.push(statement.split("\n")[0].trim());
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, applied, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }

  const counts = (await sql`
    select count(*)::int as users from users
  `) as { users: number }[];

  return NextResponse.json({ ok: true, applied: applied.length, users: counts[0]?.users ?? 0 });
}
