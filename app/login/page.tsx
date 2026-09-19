import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { SetupNotice } from "@/components/SetupNotice";
import { getCurrentUser } from "@/lib/auth";
import { describeDbError, isMissingTable } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // redirect() throws by design, so it is kept out of the try block.
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (isMissingTable(error)) {
      return (
        <SetupNotice
          title="数据库还没有建表"
          hint="先访问 /api/init?token=<MIGRATE_TOKEN> 建表，然后刷新本页。"
        />
      );
    }
    const { code, message } = describeDbError(error);
    return (
      <SetupNotice
        title="读取数据失败"
        hint="数据库连接出了问题。"
        detail={code ? `${code}: ${message}` : message}
      />
    );
  }

  if (user) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <AuthForm />
    </main>
  );
}
