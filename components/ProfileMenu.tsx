"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { logout, updateProfile } from "@/app/actions/auth";
import { AVATAR_STYLES, AVATAR_STYLE_LABELS, avatarUrl, randomSeed } from "@/lib/avatar";
import type { Member } from "@/lib/queries";

export function ProfileMenu({ me }: { me: Member }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState(me.avatarStyle);
  const [seed, setSeed] = useState(me.avatarSeed);
  const [pending, start] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const dirty = style !== me.avatarStyle || seed !== me.avatarSeed;

  function onSave() {
    const data = new FormData();
    data.set("avatarStyle", style);
    data.set("avatarSeed", seed);
    start(async () => {
      await updateProfile(data);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-line-strong bg-panel py-1 pl-1 pr-3 text-sm"
      >
        <Avatar
          style={me.avatarStyle}
          seed={me.avatarSeed}
          size={26}
          colorIndex={me.colorIndex}
        />
        <span>{me.username}</span>
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-line bg-panel p-4 shadow-lg">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl(style, seed)}
              alt="头像预览"
              className="h-12 w-12 rounded-full bg-subtle"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="field py-1 text-xs"
              >
                {AVATAR_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {AVATAR_STYLE_LABELS[s]}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-ghost w-full py-1 text-xs"
                onClick={() => setSeed(randomSeed())}
              >
                换一个
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary mt-3 w-full text-xs"
            disabled={!dirty || pending}
            onClick={onSave}
          >
            {pending ? "保存中" : "保存头像"}
          </button>

          <form action={logout} className="mt-2">
            <button type="submit" className="btn btn-ghost w-full text-xs">
              退出登录
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
