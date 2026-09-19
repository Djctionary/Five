import { NextResponse } from "next/server";
import { describeDbError, sql } from "@/lib/db";
import { resolveTimeZone } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLES = ["users", "sessions", "availability", "invite_attempts"];

/**
 * Reports whether the database is reachable and whether the tables exist.
 * Returns no data from the tables and no connection details.
 */
export async function GET() {
  const hasUrl = Boolean(process.env.DATABASE_URL);
  const config = {
    databaseUrl: hasUrl,
    inviteCode: Boolean(process.env.INVITE_CODE),
    migrateToken: Boolean(process.env.MIGRATE_TOKEN),
    // Reports the value actually in use, and flags a configured value that
    // had to be discarded.
    timezone: resolveTimeZone(process.env.APP_TIMEZONE),
    timezoneRaw: process.env.APP_TIMEZONE ?? null,
    timezoneIgnored:
      Boolean(process.env.APP_TIMEZONE?.trim()) &&
      resolveTimeZone(process.env.APP_TIMEZONE) !== process.env.APP_TIMEZONE?.trim(),
  };

  if (!hasUrl) {
    return NextResponse.json({ ok: false, config, error: "DATABASE_URL 未配置" }, { status: 500 });
  }

  try {
    const rows = (await sql`
      select
        to_regclass('public.users')           is not null as users,
        to_regclass('public.sessions')        is not null as sessions,
        to_regclass('public.availability')    is not null as availability,
        to_regclass('public.invite_attempts') is not null as invite_attempts
    `) as Record<string, boolean>[];

    const tables = rows[0] ?? {};
    const missing = TABLES.filter((name) => !tables[name]);

    return NextResponse.json({
      ok: missing.length === 0,
      config,
      tables,
      hint: missing.length ? `缺少表 ${missing.join(", ")}，先访问 /api/init 建表` : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, config, error: describeDbError(error) },
      { status: 500 },
    );
  }
}
