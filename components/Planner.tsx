"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { BlockDialog, type DialogState } from "@/components/BlockDialog";
import { ProfileMenu } from "@/components/ProfileMenu";
import {
  clearRange,
  createBlock,
  deleteBlock,
  updateBlockNote,
} from "@/app/actions/availability";
import { userColor } from "@/lib/colors";
import type { AvailabilityMap, Member } from "@/lib/queries";
import {
  VIEW_FIRST_SLOT,
  VIEW_LAST_SLOT,
  addDays,
  monthDayLabel,
  percentToSlot,
  slotLabel,
  slotToPercent,
  startOfWeek,
  weekdayName,
  type Block,
} from "@/lib/time";

const WIDE_QUERY = "(min-width: 768px)";
const WIDE_COLUMNS = 7;
const NARROW_COLUMNS = 3;
const SWIPE_THRESHOLD = 48;

type DayBlocks = Record<string, Block[]>;
type Preview = { day: string; from: number; to: number };
type Gesture =
  | { kind: "select"; day: string; rect: DOMRect; from: number; to: number }
  | { kind: "swipe"; x: number }
  | { kind: "undecided"; day: string; rect: DOMRect; from: number; x: number; y: number };

export function Planner({
  me,
  members,
  availability,
  anchor,
  rangeFrom,
  rangeTo,
  today,
}: {
  me: Member;
  members: Member[];
  availability: AvailabilityMap;
  anchor: string;
  rangeFrom: string;
  rangeTo: string;
  today: string;
}) {
  const router = useRouter();

  const [columns, setColumns] = useState(WIDE_COLUMNS);
  const [viewStart, setViewStart] = useState(() => startOfWeek(anchor));
  const [visible, setVisible] = useState<string[]>(() => members.map((m) => m.id));
  const [mine, setMine] = useState<DayBlocks>(() => ({ ...(availability[me.id] ?? {}) }));
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // The column count depends on the viewport, which only the browser knows, so
  // the first paint uses the wide layout and this corrects it.
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const apply = () => {
      setColumns(query.matches ? WIDE_COLUMNS : NARROW_COLUMNS);
      setViewStart(query.matches ? startOfWeek(anchor) : anchor);
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [anchor]);

  useEffect(() => {
    setMine({ ...(availability[me.id] ?? {}) });
  }, [availability, me.id]);

  useEffect(() => {
    setVisible((current) => {
      const known = new Set(members.map((m) => m.id));
      const kept = current.filter((id) => known.has(id));
      const added = members.filter((m) => !current.includes(m.id)).map((m) => m.id);
      return added.length === 0 && kept.length === current.length ? current : [...kept, ...added];
    });
  }, [members]);

  const days = useMemo(
    () => Array.from({ length: columns }, (_, i) => addDays(viewStart, i)),
    [viewStart, columns],
  );

  const mineRef = useRef(mine);
  mineRef.current = mine;

  // --- navigation ----------------------------------------------------------
  function goTo(nextStart: string) {
    const last = addDays(nextStart, columns - 1);
    if (nextStart < rangeFrom || last > rangeTo) {
      router.push(`/?d=${nextStart}`);
    } else {
      setViewStart(nextStart);
    }
  }

  function shift(direction: number) {
    goTo(addDays(viewStart, direction * columns));
  }

  function goToday() {
    goTo(columns === WIDE_COLUMNS ? startOfWeek(today) : today);
  }

  // --- members -------------------------------------------------------------
  const visibleSet = useMemo(() => new Set(visible), [visible]);
  const lanes = useMemo(() => {
    const shown = members.filter((m) => visibleSet.has(m.id));
    const mineShown = shown.some((m) => m.id === me.id);
    const others = shown.filter((m) => m.id !== me.id);

    const result: { member: Member; left: number; width: number; isMe: boolean }[] = [];
    if (mineShown && others.length > 0) {
      result.push({ member: me, left: 1.5, width: 45, isMe: true });
      const span = 48 / others.length;
      others.forEach((member, i) =>
        result.push({ member, left: 49.5 + i * span, width: span - 2, isMe: false }),
      );
    } else if (mineShown) {
      result.push({ member: me, left: 1.5, width: 97, isMe: true });
    } else {
      const span = 97 / Math.max(1, others.length);
      others.forEach((member, i) =>
        result.push({ member, left: 1.5 + i * span, width: span - 2, isMe: false }),
      );
    }
    return result;
  }, [members, visibleSet, me]);

  function blocksOf(member: Member, day: string): Block[] {
    const source = member.id === me.id ? mine : (availability[member.id] ?? {});
    return source[day] ?? [];
  }

  /** Runs where every shown member is free. Nothing to mark below two people. */
  const shared = useMemo(() => {
    const shown = members.filter((m) => visibleSet.has(m.id));
    if (shown.length < 2) return {} as Record<string, { start: number; end: number }[]>;

    const result: Record<string, { start: number; end: number }[]> = {};
    for (const day of days) {
      const counts = new Array<number>(VIEW_LAST_SLOT).fill(0);
      for (const member of shown) {
        for (const block of blocksOf(member, day)) {
          for (let i = Math.max(block.start, VIEW_FIRST_SLOT); i < Math.min(block.end, VIEW_LAST_SLOT); i++) {
            counts[i]++;
          }
        }
      }
      const runs: { start: number; end: number }[] = [];
      let start = -1;
      for (let i = VIEW_FIRST_SLOT; i <= VIEW_LAST_SLOT; i++) {
        const full = i < VIEW_LAST_SLOT && counts[i] === shown.length;
        if (full && start === -1) start = i;
        if (!full && start !== -1) {
          runs.push({ start, end: i });
          start = -1;
        }
      }
      result[day] = runs;
    }
    return result;
    // blocksOf closes over mine and availability, both listed below.
  }, [days, members, visibleSet, mine, availability, me.id]);

  // --- pointer -------------------------------------------------------------
  const gestureRef = useRef<Gesture | null>(null);

  function slotAt(rect: DOMRect, clientY: number): number {
    return percentToSlot((clientY - rect.top) / rect.height);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("[data-block]")) return; // handled by the block's own click
    const column = target.closest<HTMLElement>("[data-day]");
    if (!column?.dataset.day) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const rect = column.getBoundingClientRect();
    const from = slotAt(rect, event.clientY);
    try {
      // Keeps the rest of the gesture reporting to this element. Not fatal if
      // the browser refuses, so it must not abort the handler.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignored on purpose
    }

    if (event.pointerType === "touch") {
      gestureRef.current = {
        kind: "undecided",
        day: column.dataset.day,
        rect,
        from,
        x: event.clientX,
        y: event.clientY,
      };
      return;
    }

    event.preventDefault();
    gestureRef.current = { kind: "select", day: column.dataset.day, rect, from, to: from };
    setPreview({ day: column.dataset.day, from, to: from });
  }

  function onPointerMove(event: React.PointerEvent) {
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.kind === "undecided") {
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        gestureRef.current = { kind: "swipe", x: gesture.x };
        return;
      }
      if (Math.abs(dy) > 8) {
        const to = slotAt(gesture.rect, event.clientY);
        gestureRef.current = { kind: "select", day: gesture.day, rect: gesture.rect, from: gesture.from, to };
        setPreview({ day: gesture.day, from: gesture.from, to });
      }
      return;
    }

    if (gesture.kind === "select") {
      // The rect is the column the drag started in, so a selection never
      // crosses into another day however far sideways the pointer goes.
      gesture.to = slotAt(gesture.rect, event.clientY);
      setPreview({ day: gesture.day, from: gesture.from, to: gesture.to });
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture) return;

    if (gesture.kind === "swipe") {
      const dx = event.clientX - gesture.x;
      if (Math.abs(dx) > SWIPE_THRESHOLD) shift(dx < 0 ? 1 : -1);
      return;
    }

    if (gesture.kind === "undecided") return; // a tap that never became a drag

    // Read the range from the gesture, not from state: a click is a down and
    // an up with no render in between, so the state would still be empty.
    setPreview(null);
    const start = Math.min(gesture.from, gesture.to);
    const end = Math.max(gesture.from, gesture.to) + 1;
    setError("");
    setDialog({ mode: "create", day: gesture.day, block: { id: 0, start, end, note: null } });
  }

  // --- mutations -----------------------------------------------------------
  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setDialog(null);
        setError("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function onSaveDialog(note: string) {
    if (!dialog || dialog.mode === "view") return;
    const { day, block, mode } = dialog;

    if (mode === "create") {
      const optimistic: Block = { id: -Date.now(), start: block.start, end: block.end, note: note.trim() || null };
      setMine((current) => {
        const kept = (current[day] ?? []).filter((b) => b.start >= block.end || b.end <= block.start);
        return { ...current, [day]: [...kept, optimistic].sort((a, b) => a.start - b.start) };
      });
      run(() => createBlock(day, block.start, block.end, note));
      return;
    }

    setMine((current) => ({
      ...current,
      [day]: (current[day] ?? []).map((b) =>
        b.id === block.id ? { ...b, note: note.trim() || null } : b,
      ),
    }));
    run(() => updateBlockNote(block.id, note));
  }

  function onDeleteDialog() {
    if (!dialog || dialog.mode !== "edit") return;
    const { day, block } = dialog;
    setMine((current) => ({
      ...current,
      [day]: (current[day] ?? []).filter((b) => b.id !== block.id),
    }));
    run(() => deleteBlock(block.id));
  }

  function onClear() {
    const from = days[0];
    const to = days[days.length - 1];
    setMine((current) => {
      const next = { ...current };
      for (const day of days) next[day] = [];
      return next;
    });
    startTransition(async () => {
      const result = await clearRange(from, to);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  // --- render --------------------------------------------------------------
  const hours = useMemo(
    () => Array.from({ length: (VIEW_LAST_SLOT - VIEW_FIRST_SLOT) / 2 + 1 }, (_, i) => VIEW_FIRST_SLOT + i * 2),
    [],
  );

  const rangeLabel = `${monthDayLabel(days[0])} - ${monthDayLabel(days[days.length - 1])}`;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-3 pt-3 sm:px-5">
        <span className="text-base font-semibold tracking-tight">Soul V</span>

        <div className="ml-auto flex items-center gap-1">
          <button className="btn btn-ghost px-2 py-1" onClick={() => shift(-1)} aria-label="前一段">
            ‹
          </button>
          <button className="btn btn-ghost px-2.5 py-1 text-xs" onClick={goToday}>
            今天
          </button>
          <button className="btn btn-ghost px-2 py-1" onClick={() => shift(1)} aria-label="后一段">
            ›
          </button>
        </div>

        <span className="hidden text-sm text-muted sm:inline">{rangeLabel}</span>

        <button
          className="btn btn-ghost px-2.5 py-1 text-xs"
          onClick={onClear}
          disabled={pending}
        >
          {columns === WIDE_COLUMNS ? "清空本周" : "清空这三天"}
        </button>

        <ProfileMenu me={me} />
      </header>

      <div className="flex items-center gap-2 overflow-x-auto px-3 py-2.5 sm:px-5">
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
              className="flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition"
              style={{
                borderColor: on ? color.solid : "var(--border)",
                background: on ? color.soft : "transparent",
                opacity: on ? 1 : 0.45,
              }}
            >
              <Avatar
                style={member.avatarStyle}
                seed={member.avatarSeed}
                size={18}
                colorIndex={member.colorIndex}
              />
              <span>{member.username}</span>
            </button>
          );
        })}

        <span className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted">
          <span className="shared-swatch" />
          都有空
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 sm:px-5 sm:pb-5">
        <div className="flex overflow-hidden rounded-t-xl border border-line border-b-0 bg-panel">
          <div className="w-10 shrink-0 sm:w-12" />
          {days.map((day) => (
            <div
              key={day}
              className={`flex-1 border-l border-line px-1 py-1.5 text-center text-[11px] ${
                day === today ? "font-medium text-accent" : "text-muted"
              }`}
            >
              <div>{weekdayName(day)}</div>
              <div>{monthDayLabel(day)}</div>
            </div>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden rounded-b-xl border border-line bg-panel">
          <div className="relative w-10 shrink-0 sm:w-12">
            {hours.map((slot, i) => (
              <span
                key={slot}
                className="absolute right-1.5 text-[10px] tabular-nums text-muted"
                style={{
                  top: `${slotToPercent(slot)}%`,
                  transform: i === 0 ? "none" : "translateY(-50%)",
                  display: slot === VIEW_LAST_SLOT ? "none" : undefined,
                }}
              >
                {slotLabel(slot)}
              </span>
            ))}
          </div>

          <div
            className="no-select relative flex flex-1"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {days.map((day) => (
              <div
                key={day}
                data-day={day}
                className="relative flex-1 border-l border-line"
                style={{ background: day === today ? "var(--accent-soft)" : undefined }}
              >
                {hours.slice(1, -1).map((slot) => (
                  <div
                    key={slot}
                    className="pointer-events-none absolute inset-x-0 border-t border-line"
                    style={{ top: `${slotToPercent(slot)}%` }}
                  />
                ))}

                {(shared[day] ?? []).map((run) => (
                  <div
                    key={`s-${run.start}`}
                    className="shared-band pointer-events-none absolute inset-x-0"
                    style={{
                      top: `${slotToPercent(run.start)}%`,
                      height: `${slotToPercent(run.end) - slotToPercent(run.start)}%`,
                    }}
                  />
                ))}

                {lanes.map((lane) =>
                  blocksOf(lane.member, day)
                    .filter((block) => block.end > VIEW_FIRST_SLOT && block.start < VIEW_LAST_SLOT)
                    .map((block) => {
                      const top = slotToPercent(Math.max(block.start, VIEW_FIRST_SLOT));
                      const bottom = slotToPercent(Math.min(block.end, VIEW_LAST_SLOT));
                      const color = userColor(lane.member.colorIndex);
                      const label = `${lane.member.username} ${slotLabel(block.start)}-${slotLabel(block.end)}${
                        block.note ? ` · ${block.note}` : ""
                      }`;

                      return (
                        <div
                          key={`${lane.member.id}-${block.id}`}
                          data-block=""
                          title={label}
                          onClick={() => {
                            setError("");
                            setDialog(
                              lane.isMe
                                ? { mode: "edit", day, block }
                                : { mode: "view", day, block, member: lane.member },
                            );
                          }}
                          className={`absolute z-10 cursor-pointer overflow-hidden rounded-md ${
                            lane.isMe ? "px-1.5 py-0.5" : ""
                          }`}
                          style={{
                            top: `${top}%`,
                            height: `${Math.max(bottom - top, 1.6)}%`,
                            left: `${lane.left}%`,
                            width: `${lane.width}%`,
                            background: lane.isMe ? color.soft : color.solid,
                            borderLeft: lane.isMe ? `3px solid ${color.solid}` : undefined,
                            opacity: lane.isMe ? 1 : 0.85,
                          }}
                        >
                          {lane.isMe ? (
                            <span
                              className="block truncate text-[10px] leading-tight"
                              style={{ color: color.solid }}
                            >
                              {block.note ?? slotLabel(block.start)}
                            </span>
                          ) : null}
                        </div>
                      );
                    }),
                )}

                {preview?.day === day ? (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-dashed"
                    style={{
                      top: `${slotToPercent(Math.min(preview.from, preview.to))}%`,
                      height: `${
                        slotToPercent(Math.max(preview.from, preview.to) + 1) -
                        slotToPercent(Math.min(preview.from, preview.to))
                      }%`,
                      borderColor: "var(--accent)",
                      background: "var(--accent-soft)",
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {error && !dialog ? (
          <p className="pt-2 text-xs text-[#e11d48]">{error}</p>
        ) : null}
      </div>

      {dialog ? (
        <BlockDialog
          state={dialog}
          pending={pending}
          error={error}
          onSave={onSaveDialog}
          onDelete={onDeleteDialog}
          onClose={() => {
            setDialog(null);
            setError("");
          }}
        />
      ) : null}
    </div>
  );
}
