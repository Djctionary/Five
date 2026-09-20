"use client";

import { useEffect, useRef, useState } from "react";
import { blockLabel, monthDayLabel, weekdayName, type Block } from "@/lib/time";

export type DialogState = {
  mode: "create" | "edit";
  day: string;
  block: Block;
};

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
  const [note, setNote] = useState(state.block.note ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(note);
        }}
      >
        <p className="text-sm text-muted">
          {weekdayName(state.day)} {monthDayLabel(state.day)} · {blockLabel(state.block)}
        </p>

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
      </form>
    </div>
  );
}
