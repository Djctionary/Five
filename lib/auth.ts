import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { sql } from "./db";

const scryptAsync = promisify(scrypt);

const SESSION_COOKIE = "five_session";
const SESSION_DAYS = 60;
const KEY_LENGTH = 64;

export type CurrentUser = {
  id: string;
  username: string;
  avatarStyle: string;
  avatarSeed: string;
  colorIndex: number;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;

  const expected = Buffer.from(hashB64, "base64");
  const derived = (await scryptAsync(
    password,
    Buffer.from(saltB64, "base64"),
    expected.length,
  )) as Buffer;

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await sql`
    insert into sessions (token, user_id, expires_at)
    values (${token}, ${userId}, ${expiresAt.toISOString()})
  `;

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await sql`delete from sessions where token = ${token}`;
  }
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = (await sql`
    select u.id, u.username, u.avatar_style, u.avatar_seed, u.color_index
    from sessions s
    join users u on u.id = s.user_id
    where s.token = ${token} and s.expires_at > now()
  `) as Record<string, unknown>[];

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id as string,
    username: row.username as string,
    avatarStyle: row.avatar_style as string,
    avatarSeed: row.avatar_seed as string,
    colorIndex: row.color_index as number,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录");
  return user;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}
