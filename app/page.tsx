import { redirect } from "next/navigation";
import { Planner } from "@/components/Planner";
import { getCurrentUser } from "@/lib/auth";
import { getWeekAvailability, listMembers } from "@/lib/queries";
import { isDateKey, startOfWeek, todayInZone } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { week } = await searchParams;
  const today = todayInZone(process.env.APP_TIMEZONE ?? "Asia/Shanghai");
  const weekStart = startOfWeek(isDateKey(week) ? week : today);

  const [members, availability] = await Promise.all([
    listMembers(),
    getWeekAvailability(weekStart),
  ]);

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
