"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import {
  clientIp,
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { AVATAR_STYLES, isAvatarStyle, randomSeed } from "@/lib/avatar";
import { USER_COLORS } from "@/lib/colors";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW = "15 minutes";

function inviteCode(): string {
  const code = process.env.INVITE_CODE;
  if (!code) throw new Error("服务端未配置 INVITE_CODE");
  return code;
}

async function tooManyAttempts(ip: string): Promise<boolean> {
  const rows = (await sql`
    select count(*)::int as n
    from invite_attempts
    where ip = ${ip}
      and ok = false
      and at > now() - ${ATTEMPT_WINDOW}::interval
  `) as { n: number }[];
  return (rows[0]?.n ?? 0) >= MAX_ATTEMPTS;
}

async function recordAttempt(ip: string, ok: boolean): Promise<void> {
  await sql`insert into invite_attempts (ip, ok) values (${ip}, ${ok})`;
}

/** Step one of registration. The code itself never reaches the browser. */
export async function checkInviteCode(code: string): Promise<ActionResult> {
  const ip = await clientIp();

  if (await tooManyAttempts(ip)) {
    return { ok: false, error: "尝试次数过多，请 15 分钟后再试" };
  }

  const ok = code.trim() === inviteCode();
  await recordAttempt(ip, ok);

  return ok ? { ok: true } : { ok: false, error: "密钥不正确" };
}

export async function register(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const avatarStyle = String(formData.get("avatarStyle") ?? "");
  const avatarSeed = String(formData.get("avatarSeed") ?? "").trim();

  const codeCheck = await checkInviteCode(code);
  if (!codeCheck.ok) return codeCheck;

  if (!username) return { ok: false, error: "请填写用户名" };
  if (username.length > 24) return { ok: false, error: "用户名最多 24 个字符" };
  if (!password) return { ok: false, error: "请填写密码" };
  if (password.length > 200) return { ok: false, error: "密码过长" };

  const existing = (await sql`
    select 1 from users where username_lower = ${username.toLowerCase()}
  `) as unknown[];
  if (existing.length > 0) return { ok: false, error: "该用户名已被使用" };

  const countRows = (await sql`select count(*)::int as n from users`) as { n: number }[];
  const colorIndex = (countRows[0]?.n ?? 0) % USER_COLORS.length;

  const rows = (await sql`
    insert into users (username, username_lower, password_hash, avatar_style, avatar_seed, color_index)
    values (
      ${username},
      ${username.toLowerCase()},
      ${await hashPassword(password)},
      ${isAvatarStyle(avatarStyle) ? avatarStyle : AVATAR_STYLES[0]},
      ${avatarSeed || randomSeed()},
      ${colorIndex}
    )
    returning id
  `) as { id: string }[];

  await createSession(rows[0].id);
  return { ok: true };
}

export async function login(formData: FormData): Promise<ActionResult> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) return { ok: false, error: "请填写用户名和密码" };

  const rows = (await sql`
    select id, password_hash from users where username_lower = ${username.toLowerCase()}
  `) as { id: string; password_hash: string }[];

  const row = rows[0];
  // Hash even when the user does not exist, so both paths cost the same.
  const placeholder = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAA==";
  const valid = await verifyPassword(password, row?.password_hash ?? placeholder);

  if (!row || !valid) return { ok: false, error: "用户名或密码不正确" };

  await createSession(row.id);
  return { ok: true };
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "未登录" };

  const avatarStyle = String(formData.get("avatarStyle") ?? "");
  const avatarSeed = String(formData.get("avatarSeed") ?? "").trim();

  if (!isAvatarStyle(avatarStyle)) return { ok: false, error: "头像风格无效" };
  if (!avatarSeed || avatarSeed.length > 40) return { ok: false, error: "头像种子无效" };

  await sql`
    update users
    set avatar_style = ${avatarStyle}, avatar_seed = ${avatarSeed}
    where id = ${user.id}
  `;

  return { ok: true };
}
