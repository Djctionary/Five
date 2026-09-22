// A day is divided into 48 slots of 30 minutes. Slot ranges are [start, end).
export const SLOTS_PER_DAY = 48;
const MINUTES_PER_SLOT = 30;

// The calendar only draws the second half of the day, noon to midnight, so
// that a whole day fits on screen without scrolling.
export const VIEW_FIRST_SLOT = 24;
// One slot past midnight: the last hour of the grid is the 彻底疯狂 row,
// which runs from 24:00 to 01:00 and belongs to the night it started.
export const VIEW_LAST_SLOT = 50;
export const MIDNIGHT_SLOT = 48;
export const VIEW_SLOT_COUNT = VIEW_LAST_SLOT - VIEW_FIRST_SLOT;

export type Block = { id: number; start: number; end: number; note: string | null };

/** Vertical position of a slot inside the drawn day, as a percentage. */
export function slotToPercent(slot: number): number {
  return ((slot - VIEW_FIRST_SLOT) / VIEW_SLOT_COUNT) * 100;
}

/** The slot a point at `ratio` down the drawn day falls in. */
export function percentToSlot(ratio: number): number {
  const slot = VIEW_FIRST_SLOT + Math.floor(ratio * VIEW_SLOT_COUNT);
  return Math.min(VIEW_LAST_SLOT - 1, Math.max(VIEW_FIRST_SLOT, slot));
}

export function slotLabel(slot: number): string {
  const minutes = slot * MINUTES_PER_SLOT;
  // Slots past midnight belong to the small hours, so the hour wraps.
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function blockLabel(block: Block): string {
  return `${slotLabel(block.start)}-${slotLabel(block.end)}`;
}

// --- Dates are handled as plain YYYY-MM-DD strings in a single shared timezone. ---

export const DEFAULT_TIME_ZONE = "Asia/Shanghai";

/**
 * Falls back to the default when APP_TIMEZONE is unset, blank or not a real
 * IANA name. An empty environment variable is a configured-but-empty value,
 * which `??` would pass straight through to Intl and crash the page.
 */
export function resolveTimeZone(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

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

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromDateKey(key: string): Date {
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

const WEEKDAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function weekdayName(key: string): string {
  const date = fromDateKey(key);
  return WEEKDAY_NAMES[(date.getDay() + 6) % 7];
}

export function monthDayLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}`;
}
