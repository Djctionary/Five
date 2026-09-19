"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkInviteCode, login, register } from "@/app/actions/auth";
import { AVATAR_STYLES, AVATAR_STYLE_LABELS, avatarUrl, randomSeed } from "@/lib/avatar";

type Mode = "login" | "register";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Five</h1>
        <p className="mt-1 text-sm text-muted">找到我们都有空的时间</p>
      </div>

      <div className="mb-6 inline-flex rounded-lg border border-line-strong bg-panel p-0.5 text-sm">
        {(["login", "register"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-3.5 py-1.5 transition ${
              mode === m ? "bg-accent text-white" : "text-muted hover:text-ink"
            }`}
          >
            {m === "login" ? "登录" : "注册"}
          </button>
        ))}
      </div>

      {mode === "login" ? (
        <LoginPanel onDone={() => router.replace("/")} />
      ) : (
        <RegisterPanel onDone={() => router.replace("/")} />
      )}
    </div>
  );
}

function LoginPanel({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    start(async () => {
      const result = await login(data);
      if (result.ok) onDone();
      else setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="用户名">
        <input name="username" className="field" autoComplete="username" autoFocus />
      </Field>
      <Field label="密码">
        <input
          name="password"
          type="password"
          className="field"
          autoComplete="current-password"
        />
      </Field>
      <ErrorLine message={error} />
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "登录中" : "登录"}
      </button>
    </form>
  );
}

function RegisterPanel({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const [style, setStyle] = useState<string>(AVATAR_STYLES[0]);
  const [seed, setSeed] = useState(() => randomSeed());

  function onCheckCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    start(async () => {
      const result = await checkInviteCode(code);
      if (result.ok) setStep(2);
      else setError(result.error);
    });
  }

  function onRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("code", code);
    data.set("avatarStyle", style);
    data.set("avatarSeed", seed);
    setError("");
    start(async () => {
      const result = await register(data);
      if (result.ok) onDone();
      else setError(result.error);
    });
  }

  if (step === 1) {
    return (
      <form onSubmit={onCheckCode} className="space-y-4">
        <Field label="注册密钥" hint="向已加入的成员索取">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="field tracking-[0.3em]"
            inputMode="numeric"
            autoFocus
          />
        </Field>
        <ErrorLine message={error} />
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? "验证中" : "继续"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onRegister} className="space-y-5">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl(style, seed)}
          alt="头像预览"
          className="h-16 w-16 rounded-full bg-subtle"
        />
        <div className="space-y-2">
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="field py-1.5 text-sm"
          >
            {AVATAR_STYLES.map((s) => (
              <option key={s} value={s}>
                {AVATAR_STYLE_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost w-full py-1.5 text-xs"
            onClick={() => setSeed(randomSeed())}
          >
            换一个
          </button>
        </div>
      </div>

      <Field label="用户名">
        <input name="username" className="field" maxLength={24} autoFocus />
      </Field>
      <Field label="密码" hint="没有格式限制，也无法找回">
        <input name="password" type="password" className="field" autoComplete="new-password" />
      </Field>

      <ErrorLine message={error} />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setStep(1);
            setError("");
          }}
        >
          返回
        </button>
        <button type="submit" className="btn btn-primary flex-1" disabled={pending}>
          {pending ? "创建中" : "创建账号"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm">
        <span>{label}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function ErrorLine({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-sm text-[#e11d48] dark:text-[#fb7185]">{message}</p>;
}
