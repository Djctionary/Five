export function SetupNotice({
  title,
  detail,
  hint,
}: {
  title: string;
  detail?: string;
  hint?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border border-line bg-panel p-6">
        <h1 className="text-base font-medium">{title}</h1>
        {hint ? <p className="mt-2 text-sm text-muted">{hint}</p> : null}
        {detail ? (
          <pre className="mt-4 overflow-x-auto rounded-lg bg-subtle p-3 text-xs text-muted">
            {detail}
          </pre>
        ) : null}
        <p className="mt-4 text-xs text-muted">
          访问 <code>/api/health</code> 可以看到数据库连接和建表情况。
        </p>
      </div>
    </main>
  );
}
