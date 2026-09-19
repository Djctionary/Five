"use server";

import { revalidatePath } from "next/cache";
import { describeDbError, sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SLOTS_PER_DAY, isDateKey, maskToBlocks } from "@/lib/time";
import type { ActionResult } from "./auth";

/**
 * Replaces the caller's free blocks for one day. The client sends the whole
 * 48-slot mask for that day, so the write is idempotent and needs no merging.
 */
export async function saveDay(day: string, mask: boolean[]): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "未登录" };

    if (!isDateKey(day)) return { ok: false, error: "日期格式无效" };
    if (!Array.isArray(mask) || mask.length !== SLOTS_PER_DAY) {
      return { ok: false, error: "时间数据无效" };
    }

    const blocks = maskToBlocks(mask.map(Boolean));

    await sql`delete from availability where user_id = ${user.id} and day = ${day}::date`;

    for (const block of blocks) {
      await sql`
        insert into availability (user_id, day, start_slot, end_slot)
        values (${user.id}, ${day}::date, ${block.start}, ${block.end})
      `;
    }

    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    const { code, message } = describeDbError(error);
    return { ok: false, error: code ? `数据库出错 ${code}: ${message}` : message };
  }
}

export async function clearWeek(weekStart: string, weekEnd: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "未登录" };
    if (!isDateKey(weekStart) || !isDateKey(weekEnd)) {
      return { ok: false, error: "日期格式无效" };
    }

    await sql`
      delete from availability
      where user_id = ${user.id} and day between ${weekStart}::date and ${weekEnd}::date
    `;

    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    const { code, message } = describeDbError(error);
    return { ok: false, error: code ? `数据库出错 ${code}: ${message}` : message };
  }
}
