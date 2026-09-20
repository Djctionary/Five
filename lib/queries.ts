import "server-only";
import { sql } from "./db";
import type { Block } from "./time";

export type Member = {
  id: string;
  username: string;
  avatarStyle: string;
  avatarSeed: string;
  colorIndex: number;
};

/** userId -> dateKey -> blocks */
export type AvailabilityMap = Record<string, Record<string, Block[]>>;

export async function listMembers(): Promise<Member[]> {
  const rows = (await sql`
    select id, username, avatar_style, avatar_seed, color_index
    from users
    order by created_at asc
  `) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as string,
    username: row.username as string,
    avatarStyle: row.avatar_style as string,
    avatarSeed: row.avatar_seed as string,
    colorIndex: row.color_index as number,
  }));
}

/** `from` inclusive, `to` inclusive, both YYYY-MM-DD. */
export async function getAvailability(from: string, to: string): Promise<AvailabilityMap> {
  const rows = (await sql`
    select id, user_id, to_char(day, 'YYYY-MM-DD') as day, start_slot, end_slot, note
    from availability
    where day between ${from}::date and ${to}::date
    order by user_id, day, start_slot
  `) as {
    id: number;
    user_id: string;
    day: string;
    start_slot: number;
    end_slot: number;
    note: string | null;
  }[];

  const map: AvailabilityMap = {};
  for (const row of rows) {
    const byDay = (map[row.user_id] ??= {});
    (byDay[row.day] ??= []).push({
      id: Number(row.id),
      start: row.start_slot,
      end: row.end_slot,
      note: row.note,
    });
  }
  return map;
}
