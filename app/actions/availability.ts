"use server";

import { revalidatePath } from "next/cache";
import { describeDbError, sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { VIEW_LAST_SLOT, isDateKey } from "@/lib/time";
import type { ActionResult } from "./auth";

const MAX_NOTE = 120;

function dbFail(error: unknown): ActionResult {
  const { code, message } = describeDbError(error);
  if (code === "42703" || code === "23514") {
    return { ok: false, error: "数据库表结构是旧的，请重新访问 /api/init 更新" };
  }
  return { ok: false, error: code ? `数据库出错 ${code}: ${message}` : message };
}

/** A note is required, so this returns null only when there is nothing to save. */
function cleanNote(value: unknown): string | null {
  return String(value ?? "").trim().slice(0, MAX_NOTE) || null;
}

/**
 * Adds one free block. A block never spans days, and a new one replaces any
 * of the caller's blocks it overlaps, so the same time is never listed twice.
 */
export async function createBlock(
  day: string,
  start: number,
  end: number,
  note: unknown,
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "未登录" };
    if (!isDateKey(day)) return { ok: false, error: "日期无效" };

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end > VIEW_LAST_SLOT ||
      start >= end
    ) {
      return { ok: false, error: "时间范围无效" };
    }

    const text = cleanNote(note);
    if (!text) return { ok: false, error: "请输入文本" };

    await sql`
      delete from availability
      where user_id = ${user.id}
        and day = ${day}::date
        and start_slot < ${end}
        and end_slot > ${start}
    `;

    await sql`
      insert into availability (user_id, day, start_slot, end_slot, note)
      values (${user.id}, ${day}::date, ${start}, ${end}, ${text})
    `;

    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return dbFail(error);
  }
}

export async function updateBlockNote(id: number, note: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "未登录" };
    if (!Number.isInteger(id)) return { ok: false, error: "id 无效" };

    const text = cleanNote(note);
    if (!text) return { ok: false, error: "请输入文本" };

    await sql`
      update availability set note = ${text}
      where id = ${id} and user_id = ${user.id}
    `;

    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return dbFail(error);
  }
}

export async function deleteBlock(id: number): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "未登录" };
    if (!Number.isInteger(id)) return { ok: false, error: "id 无效" };

    await sql`delete from availability where id = ${id} and user_id = ${user.id}`;

    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return dbFail(error);
  }
}

/** Removes the caller's blocks across the days currently on screen. */
export async function clearRange(from: string, to: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "未登录" };
    if (!isDateKey(from) || !isDateKey(to)) return { ok: false, error: "日期无效" };

    await sql`
      delete from availability
      where user_id = ${user.id} and day between ${from}::date and ${to}::date
    `;

    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return dbFail(error);
  }
}
