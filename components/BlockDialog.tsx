"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { userColor } from "@/lib/colors";
import type { Member } from "@/lib/queries";
import { blockLabel, monthDayLabel, weekdayName, type Block } from "@/lib/time";

export type DialogState =
  | { mode: "create"; day: string; block: Block }
  | { mode: "edit"; day: string; block: Block }
  | { mode: "view"; day: string; block: Block; member: Member };

function Shell({
  onClose,
  children,
  asForm,
  onSubmit,
}: {
  onClose: () => void;
  children: React.ReactNode;
  asForm: boolean;
  onSubmit?: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inner = "w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-2xl";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {asForm ? (
        <form
          className={inner}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.();
          }}
        >
          {children}
        </form>
      ) : (
        <div className={inner}>{children}</div>
      )}
    </div>
  );
}

export function BlockDialog({
  state,
  pending,
  error,
  onSave,
  onDelete,
  onClose,
}: {
  state: DialogState;
  pending: boolean;
  error: string;
  onSave: (note: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const when = `${weekdayName(state.day)} ${monthDayLabel(state.day)} · ${blockLabel(state.block)}`;

  if (state.mode === "view") {
    const color = userColor(state.member.colorIndex);
    return (
      <Shell onClose={onClose} asForm={false}>
        <div className="flex items-center gap-2.5">
          <Avatar
            style={state.member.avatarStyle}
            seed={state.member.avatarSeed}
            size={28}
            colorIndex={state.member.colorIndex}
          />
          <span className="text-sm font-medium" style={{ color: color.solid }}>
            {state.member.username}
          </span>
        </div>

        <p className="mt-3 text-sm text-muted">{when}</p>

        <p className="mt-4 text-base">
          {state.block.note ?? <span className="text-muted">没写想干什么</span>}
        </p>

        <div className="mt-5 flex justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
        </div>
      </Shell>
    );
  }

  return <EditPanel state={state} pending={pending} error={error} onSave={onSave} onDelete={onDelete} onClose={onClose} when={when} />;
}

function EditPanel({
  state,
  pending,
  error,
  onSave,
  onDelete,
  onClose,
  when,
}: {
  state: Extract<DialogState, { mode: "create" | "edit" }>;
  pending: boolean;
  error: string;
  onSave: (note: string) => void;
  onDelete: () => void;
  onClose: () => void;
  when: string;
}) {
  const [note, setNote] = useState(state.block.note ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Shell onClose={onClose} asForm onSubmit={() => onSave(note)}>
      <p className="text-sm text-muted">{when}</p>

      <label className="mt-4 block text-sm">
        这段时间想干什么？
        <input
          ref={inputRef}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="随便写点，留空也行"
          maxLength={120}
          className="field mt-1.5"
        />
      </label>

      {error ? <p className="mt-3 text-sm text-[#e11d48]">{error}</p> : null}

      <div className="mt-5 flex items-center gap-2">
        {state.mode === "edit" ? (
          <button
            type="button"
            className="btn btn-ghost text-[#e11d48]"
            disabled={pending}
            onClick={onDelete}
          >
            删除
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost ml-auto" onClick={onClose}>
          取消
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "保存中" : "保存"}
        </button>
      </div>
    </Shell>
  );
}
