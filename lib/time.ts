// A day is divided into 48 slots of 30 minutes. Slot ranges are [start, end).
export const SLOTS_PER_DAY = 48;
export const MINUTES_PER_SLOT = 30;

export type Block = { start: number; end: number };

export function slotLabel(slot: number): string {
  const minutes = slot * MINUTES_PER_SLOT;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function blockLabel(block: Block): string {
  return `${slotLabel(block.start)}-${slotLabel(block.end)}`;
}

export function maskToBlocks(mask: boolean[]): Block[] {
  const blocks: Block[] = [];
  let start = -1;
  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    if (mask[i] && start === -1) start = i;
    if (!mask[i] && start !== -1) {
      blocks.push({ start, end: i });
      start = -1;
    }
  }
  if (start !== -1) blocks.push({ start, end: SLOTS_PER_DAY });
  return blocks;
}

export function blocksToMask(blocks: Block[]): boolean[] {
  const mask = new Array<boolean>(SLOTS_PER_DAY).fill(false);
  for (const b of blocks) {
    for (let i = Math.max(0, b.start); i < Math.min(SLOTS_PER_DAY, b.end); i++) {
      mask[i] = true;
    }
  }
  return mask;
}

// --- Dates are handled as plain YYYY-MM-DD strings in a single shared timezone. ---

/** Today in the single timezone the whole group shares. */
export function todayInZone(timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

// Monday is the first column of the week.
export function startOfWeek(key: string): string {
  const date = fromDateKey(key);
  const offset = (date.getDay() + 6) % 7;
  return addDays(key, -offset);
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

const WEEKDAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function weekdayName(key: string): string {
  const date = fromDateKey(key);
  return WEEKDAY_NAMES[(date.getDay() + 6) % 7];
}

export function monthDayLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const [, sm, sd] = weekStart.split("-");
  const [ey, em, ed] = end.split("-");
  if (sm === em) return `${ey} 年 ${Number(sm)} 月 ${Number(sd)} - ${Number(ed)} 日`;
  return `${ey} 年 ${Number(sm)} 月 ${Number(sd)} 日 - ${Number(em)} 月 ${Number(ed)} 日`;
}
