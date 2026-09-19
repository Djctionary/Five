import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

// Resolved on first query rather than at import time, so a build without a
// database connection string still succeeds.
function client_(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
      );
    }
    client = neon(url);
  }
  return client;
}

export const sql: NeonQueryFunction<false, false> = new Proxy(
  (() => {}) as unknown as NeonQueryFunction<false, false>,
  {
    apply: (_target, _thisArg, args: unknown[]) =>
      (client_() as unknown as (...a: unknown[]) => unknown)(...args),
    get: (_target, prop) => Reflect.get(client_(), prop),
  },
);

/**
 * Turns a driver error into something safe to show. Postgres error codes are
 * not sensitive, but the message can carry the connection target, so only the
 * first line is kept and anything resembling a URL is stripped.
 */
export function describeDbError(error: unknown): { code: string; message: string } {
  const raw_code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code: unknown }).code
      : undefined;
  const code = raw_code === undefined || raw_code === null ? "" : String(raw_code);

  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.split("\n")[0].replace(/[a-z]+:\/\/\S+/gi, "<url>").slice(0, 200);

  return { code, message };
}

/** Postgres reports a missing table as 42P01. */
export function isMissingTable(error: unknown): boolean {
  return describeDbError(error).code === "42P01";
}
