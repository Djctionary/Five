"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ProfileMenu } from "@/components/ProfileMenu";
import { clearWeek, saveDay } from "@/app/actions/availability";
import type { AvailabilityMap, Member } from "@/lib/queries";
import { userColor } from "@/lib/colors";
import {
  SLOTS_PER_DAY,
  addDays,
  blockLabel,
  blocksToMask,
  formatWeekRange,
  maskToBlocks,
  monthDayLabel,
  slotLabel,
  weekDays,
  weekdayName,
} from "@/lib/time";

const SLOT_HEIGHT = 14; // px per 30 minutes
const DEFAULT_SCROLL_HOUR = 8;

type DayMask = Record<string, boolean[]>;

function emptyMask(): boolean[] {
  return new Array<boolean>(SLOTS_PER_DAY).fill(false);
}

function buildMasks(map: AvailabilityMap, userId: string, days: string[]): DayMask {
  const result: DayMask = {};
  for (const day of days) {
    result[day] = blocksToMask(map[userId]?.[day] ?? []);
  }
  return result;
}

export function Planner({
  me,
  members,
  availability,
  weekStart,
  today,
}: {
  me: Member;
  members: Member[];
  availability: AvailabilityMap;
  weekStart: string;
  today: string;
}) {
  const router = useRouter();
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const others = useMemo(() => members.filter((m) => m.id !== me.id), [members, me.id]);

  const [masks, setMasks] = useState<DayMask>(() => buildMasks(availability, me.id, days));
  const [visible, setVisible] = useState<string[]>(() => members.map((m) => m.id));
  const [showOthers, setShowOthers] = useState(true);
  const [saving, startSaving] = useTransition();

  // The server is the source of truth: re-sync whenever the week or the data changes.
  useEffect(() => {
    setMasks(buildMasks(availability, me.id, days));
  }, [availability, me.id, days]);

  useEffect(() => {
    setVisible((current) => {
      const known = new Set(members.map((m) => m.id));
      const kept = current.filter((id) => known.has(id));
      const added = members.filter((m) => !current.includes(m.id)).map((m) => m.id);
      return kept.length + added.length === current.length ? current : [...kept, ...added];
    });
  }, [members]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = DEFAULT_SCROLL_HOUR * 2 * SLOT_HEIGHT;
  }, []);

  // --- marking -------------------------------------------------------------
  // Mouse and pen drag across cells. Touch uses two taps to pick a range,
  // because a drag gesture there is needed for scrolling the grid.
  const dragRef = useRef<{ paint: boolean; touched: Set<string> } | null>(null);
  const tapRef = useRef<{ day: string; slot: number; x: number; y: number; moved: boolean } | null>(
    null,
  );
  const [rangeStart, setRangeStart] = useState<{ day: string; slot: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  // State updates are async, so reads during a drag go through a ref.
  const masksRef = useRef(masks);
  masksRef.current = masks;

  function persist(days_: string[]) {
    setStatus("saving");
    startSaving(async () => {
      try {
        for (const day of days_) {
          const result = await saveDay(day, masksRef.current[day] ?? emptyMask());
          if (!result.ok) throw new Error(result.error);
        }
        setStatus("idle");
        setErrorText("");
        router.refresh();
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : String(error));
        setStatus("error");
      }
    });
  }

  function applyDay(day: string, next: boolean[]) {
    setMasks((current) => ({ ...current, [day]: next }));
    masksRef.current = { ...masksRef.current, [day]: next };
    persist([day]);
  }

  function applyCell(day: string, slot: number, paint: boolean) {
    setMasks((current) => {
      const mask = current[day] ?? emptyMask();
      if (mask[slot] === paint) return current;
      const next = mask.slice();
      next[slot] = paint;
      return { ...current, [day]: next };
    });
  }

  function cellFromPoint(x: number, y: number): { day: string; slot: number } | null {
    const target = document.elementFromPoint(x, y);
    const cell = target?.closest<HTMLElement>("[data-day]");
    if (!cell?.dataset.day || cell.dataset.slot === undefined) return null;
    return { day: cell.dataset.day, slot: Number(cell.dataset.slot) };
  }

  function handleTap(day: string, slot: number) {
    const mask = masksRef.current[day] ?? emptyMask();

    if (mask[slot]) {
      // Tapping inside a marked block removes that whole block.
      let start = slot;
      let end = slot;
      while (start > 0 && mask[start - 1]) start--;
      while (end < SLOTS_PER_DAY - 1 && mask[end + 1]) end++;
      const next = mask.slice();
      for (let i = start; i <= end; i++) next[i] = false;
      setRangeStart(null);
      applyDay(day, next);
      return;
    }

    if (!rangeStart || rangeStart.day !== day) {
      setRangeStart({ day, slot });
      return;
    }

    const from = Math.min(rangeStart.slot, slot);
    const to = Math.max(rangeStart.slot, slot);
    const next = mask.slice();
    for (let i = from; i <= to; i++) next[i] = true;
    setRangeStart(null);
    applyDay(day, next);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (!cell) return;

    if (event.pointerType === "touch") {
      tapRef.current = { ...cell, x: event.clientX, y: event.clientY, moved: false };
      return;
    }

    if (event.button !== 0) return;
    event.preventDefault();
    // Capture so the whole drag keeps reporting to this grid.
    event.currentTarget.setPointerCapture(event.pointerId);
    const paint = !(masksRef.current[cell.day]?.[cell.slot] ?? false);
    dragRef.current = { paint, touched: new Set([cell.day]) };
    setRangeStart(null);
    applyCell(cell.day, cell.slot, paint);
  }

  function onPointerMove(event: React.PointerEvent) {
    const tap = tapRef.current;
    if (tap) {
      if (Math.abs(event.clientX - tap.x) > 8 || Math.abs(event.clientY - tap.y) > 8) {
        tap.moved = true;
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (!cell) return;
    drag.touched.add(cell.day);
    applyCell(cell.day, cell.slot, drag.paint);
  }

  function onPointerUp() {
    const tap = tapRef.current;
    if (tap) {
      tapRef.current = null;
      if (!tap.moved) handleTap(tap.day, tap.slot);
      return;
    }

    const drag = dragRef.current;
    dragRef.current = null;
    if (drag) persist([...drag.touched]);
  }

  // --- overlap -------------------------------------------------------------
  const visibleSet = useMemo(() => new Set(visible), [visible]);

  const counts = useMemo(() => {
    const result: Record<string, number[]> = {};
    for (const day of days) {
      const row = new Array<number>(SLOTS_PER_DAY).fill(0);
      for (const member of members) {
        if (!visibleSet.has(member.id)) continue;
        const mask =
          member.id === me.id
            ? (masks[day] ?? emptyMask())
            : blocksToMask(availability[member.id]?.[day] ?? []);
        for (let i = 0; i < SLOTS_PER_DAY; i++) if (mask[i]) row[i]++;
      }
      result[day] = row;
    }
    return result;
  }, [days, members, visibleSet, masks, availability, me.id]);

  const othersCounts = useMemo(() => {
    const result: Record<string, number[]> = {};
    for (const day of days) {
      const row = new Array<number>(SLOTS_PER_DAY).fill(0);
      for (const member of others) {
        if (!visibleSet.has(member.id)) continue;
        const mask = blocksToMask(availability[member.id]?.[day] ?? []);
        for (let i = 0; i < SLOTS_PER_DAY; i++) if (mask[i]) row[i]++;
      }
      result[day] = row;
    }
    return result;
  }, [days, others, visibleSet, availability]);

  const visibleCount = visible.length;

  const commonSlots = useMemo(() => {
    if (visibleCount < 2) return [];
    const found: { day: string; start: number; end: number }[] = [];
    for (const day of days) {
      const row = counts[day] ?? [];
      let start = -1;
      for (let i = 0; i <= SLOTS_PER_DAY; i++) {
        const full = i < SLOTS_PER_DAY && row[i] === visibleCount;
        if (full && start === -1) start = i;
        if (!full && start !== -1) {
          found.push({ day, start, end: i });
          start = -1;
        }
      }
    }
    return found;
  }, [counts, days, visibleCount]);

  const myBlocks = useMemo(
    () => days.flatMap((day) => maskToBlocks(masks[day] ?? emptyMask()).map((b) => ({ day, ...b }))),
    [days, masks],
  );

  function goto(offset: number) {
    router.push(offset === 0 ? "/" : `/?week=${addDays(weekStart, offset * 7)}`);
  }

  function onClearWeek() {
    if (!confirm("清空本周你标记的所有空闲时间？")) return;
    const cleared: DayMask = {};
    for (const day of days) cleared[day] = emptyMask();
    setMasks(cleared);
    masksRef.current = cleared;
    setRangeStart(null);
    setStatus("saving");
    startSaving(async () => {
      const result = await clearWeek(weekStart, addDays(weekStart, 6));
      setStatus(result.ok ? "idle" : "error");
      setErrorText(result.ok ? "" : result.error);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold tracking-tight">Soul V</span>
          <span className="hidden text-sm text-muted sm:inline">找到我们都有空的时间</span>
        </div>
        <ProfileMenu me={me} />
      </header>

      <section className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost px-2.5" onClick={() => goto(-1)} aria-label="上一周">
            ‹
          </button>
          <button className="btn btn-ghost px-3" onClick={() => goto(0)}>
            本周
          </button>
          <button className="btn btn-ghost px-2.5" onClick={() => goto(1)} aria-label="下一周">
            ›
          </button>
        </div>
        <span className="text-sm text-muted">{formatWeekRange(weekStart)}</span>

        <div className="ml-auto flex items-center gap-2">
          <span
            className="max-w-[22rem] truncate text-xs"
            title={errorText || undefined}
            style={{ color: status === "error" ? "#e11d48" : "var(--muted)" }}
          >
            {status === "error" ? `保存失败：${errorText}` : saving ? "保存中" : "已保存"}
          </span>
          <button className="btn btn-ghost text-xs" onClick={onClearWeek}>
            清空本周
          </button>
        </div>
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-2">
        {members.map((member) => {
          const on = visibleSet.has(member.id);
          const color = userColor(member.colorIndex);
          return (
            <button
              key={member.id}
              onClick={() =>
                setVisible((current) =>
                  current.includes(member.id)
                    ? current.filter((id) => id !== member.id)
                    : [...current, member.id],
                )
              }
              className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-sm transition"
              style={{
                borderColor: on ? color.solid : "var(--border)",
                background: on ? color.soft : "transparent",
                opacity: on ? 1 : 0.5,
              }}
            >
              <Avatar
                style={member.avatarStyle}
                seed={member.avatarSeed}
                size={20}
                colorIndex={member.colorIndex}
              />
              <span>{member.username}</span>
              {member.id === me.id ? <span className="text-xs text-muted">你</span> : null}
            </button>
          );
        })}

        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={showOthers}
            onChange={(e) => setShowOthers(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          显示他人时间
        </label>
      </section>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          <div className="grid border-b border-line" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
            <div />
            {days.map((day) => (
              <div
                key={day}
                className={`px-2 py-2 text-center text-xs ${
                  day === today ? "text-accent font-medium" : "text-muted"
                }`}
              >
                <div>{weekdayName(day)}</div>
                <div className="text-[11px]">{monthDayLabel(day)}</div>
              </div>
            ))}
          </div>

          <div ref={scrollerRef} className="max-h-[60vh] overflow-y-auto">
            <div
              className="no-select grid"
              style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div>
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    className="relative text-[10px] text-muted"
                    style={{ height: SLOT_HEIGHT * 2 }}
                  >
                    <span className="absolute -top-1.5 right-1.5">{hour === 0 ? "" : `${hour}:00`}</span>
                  </div>
                ))}
              </div>

              {days.map((day) => (
                <DayColumn
                  key={day}
                  day={day}
                  mine={masks[day] ?? emptyMask()}
                  others={showOthers ? (othersCounts[day] ?? []) : []}
                  otherTotal={others.filter((m) => visibleSet.has(m.id)).length}
                  isToday={day === today}
                  pendingSlot={rangeStart?.day === day ? rangeStart.slot : null}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <Panel title={`共同空闲 (${visibleCount} 人)`}>
            {visibleCount < 2 ? (
              <p className="text-sm text-muted">至少选中两个人才能算重合。</p>
            ) : commonSlots.length === 0 ? (
              <p className="text-sm text-muted">本周没有所有人都有空的时段。</p>
            ) : (
              <ul className="space-y-1.5">
                {commonSlots.map((slot) => (
                  <li key={`${slot.day}-${slot.start}`} className="flex justify-between text-sm">
                    <span className="text-muted">
                      {weekdayName(slot.day)} {monthDayLabel(slot.day)}
                    </span>
                    <span className="tabular-nums">
                      {slotLabel(slot.start)}-{slotLabel(slot.end)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="我的本周空闲">
            {myBlocks.length === 0 ? (
              <p className="text-sm text-muted">在左边的格子上拖动即可标记。</p>
            ) : (
              <ul className="space-y-1.5">
                {myBlocks.map((block) => (
                  <li key={`${block.day}-${block.start}`} className="flex justify-between text-sm">
                    <span className="text-muted">
                      {weekdayName(block.day)} {monthDayLabel(block.day)}
                    </span>
                    <span className="tabular-nums">{blockLabel(block)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <p className="text-xs leading-relaxed text-muted">
            电脑上拖动格子标记空闲，拖动已标记的格子取消。
            <br />
            手机上点一下选起点，再点一下选终点；点已标记的区块可取消。
            <br />
            每格 30 分钟，改动自动保存。
          </p>
          {rangeStart ? (
            <p className="text-xs text-accent">
              已选起点 {weekdayName(rangeStart.day)} {slotLabel(rangeStart.slot)}，再点一下终点。
            </p>
          ) : null}
        </aside>
      </div>

      <div className="sr-only" aria-live="polite">
        {saving ? "保存中" : "已保存"}
      </div>
    </div>
  );
}

function DayColumn({
  day,
  mine,
  others,
  otherTotal,
  isToday,
  pendingSlot,
}: {
  day: string;
  mine: boolean[];
  others: number[];
  otherTotal: number;
  isToday: boolean;
  pendingSlot: number | null;
}) {
  return (
    <div className={`border-l border-line ${isToday ? "bg-accent-soft/30" : ""}`}>
      {Array.from({ length: SLOTS_PER_DAY }, (_, slot) => {
        const count = others[slot] ?? 0;
        const ratio = otherTotal > 0 ? count / otherTotal : 0;
        const isMine = mine[slot];
        const isPending = pendingSlot === slot;

        return (
          <div
            key={slot}
            data-day={day}
            data-slot={slot}
            title={`${slotLabel(slot)} 起 · 其他人 ${count}/${otherTotal}`}
            className="cursor-pointer border-t"
            style={{
              height: SLOT_HEIGHT,
              // Hour rules would cut through a filled block, so hide them there.
              borderTopColor: !isMine && slot % 2 === 0 ? "var(--border)" : "transparent",
              background: isMine
                ? "var(--accent)"
                : ratio > 0
                  ? `color-mix(in srgb, var(--accent) ${Math.round(ratio * 42)}%, transparent)`
                  : "transparent",
              outline: isPending ? "2px solid var(--accent)" : undefined,
              outlineOffset: "-2px",
            }}
          />
        );
      })}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </div>
  );
}
