import { redirect } from "next/navigation";
import { Planner } from "@/components/Planner";
import { SetupNotice } from "@/components/SetupNotice";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { describeDbError, isMissingTable } from "@/lib/db";
import { getWeekAvailability, listMembers, type Member } from "@/lib/queries";
import { isDateKey, resolveTimeZone, startOfWeek, todayInZone } from "@/lib/time";

export const dynamic = "force-dynamic";

function dbNotice(error: unknown) {
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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  let user: CurrentUser | null;
  let members: Member[];
  let availability: Awaited<ReturnType<typeof getWeekAvailability>>;

  const { week } = await searchParams;
  const today = todayInZone(resolveTimeZone(process.env.APP_TIMEZONE));
  const weekStart = startOfWeek(isDateKey(week) ? week : today);

  // A database that is unreachable or not yet migrated would otherwise surface
  // as an opaque digest in production, so report what actually went wrong.
  // redirect() throws by design, so it is kept out of the try blocks.
  try {
    user = await getCurrentUser();
  } catch (error) {
    return dbNotice(error);
  }

  if (!user) redirect("/login");

  try {
    [members, availability] = await Promise.all([
      listMembers(),
      getWeekAvailability(weekStart),
    ]);
  } catch (error) {
    return dbNotice(error);
  }

  const me = members.find((m) => m.id === user.id) ?? {
    id: user.id,
    username: user.username,
    avatarStyle: user.avatarStyle,
    avatarSeed: user.avatarSeed,
    colorIndex: user.colorIndex,
  };

  return (
    <main className="min-h-screen">
      <Planner
        me={me}
        members={members}
        availability={availability}
        weekStart={weekStart}
        today={today}
      />
    </main>
  );
}
