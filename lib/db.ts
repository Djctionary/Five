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
