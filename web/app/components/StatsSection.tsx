import { raw } from "@/lib/db";
import { StatsSectionClient } from "./StatsSectionClient";
import type { Stats } from "./StatsSectionClient";

export async function StatsSection() {
  const stats: Stats = {
    installs: 0,
    creators: 0,
    skills: 0,
    activeThisWeek: 0,
  };

  try {
    // Total installs: sum of statsInstalls across all approved, non-deleted skills
    const installsRows = (await raw(
      `SELECT COALESCE(SUM(stats_installs), 0) as total FROM skills WHERE moderation_status = 'approved' AND deleted_at IS NULL`
    )) as { total: number }[];
    stats.installs = Number(installsRows[0]?.total ?? 0);

    // Total creators
    const creatorsRows = (await raw(
      `SELECT COUNT(*) as total FROM users`
    )) as { total: number }[];
    stats.creators = Number(creatorsRows[0]?.total ?? 0);

    // Total approved skills
    const skillsRows = (await raw(
      `SELECT COUNT(*) as total FROM skills WHERE moderation_status = 'approved' AND deleted_at IS NULL`
    )) as { total: number }[];
    stats.skills = Number(skillsRows[0]?.total ?? 0);

    // Active users this week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeRows = (await raw(
      `SELECT COUNT(DISTINCT user_id) as total FROM event_logs WHERE user_id IS NOT NULL AND created_at >= ?`,
      [weekAgo.getTime()]
    )) as { total: number }[];
    stats.activeThisWeek = Number(activeRows[0]?.total ?? 0);
  } catch {
    // DB not ready yet — render zeros
  }

  return <StatsSectionClient stats={stats} />;
}
