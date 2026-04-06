import Link from "next/link";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getAuthFromCookies } from "@/lib/auth";
import { SkillsGrid } from "./SkillsGrid";

export const metadata = {
  title: "Explore Skills — ClawPlay",
  description: "Browse and discover social & entertainment Skills for X Claw.",
};

export default async function SkillsPage() {
  const auth = await getAuthFromCookies();

  let allSkills: {
    slug: string;
    name: string;
    summary: string | null;
    authorName: string | null;
    iconEmoji: string | null;
    statsStars: number | null;
    createdAt: Date | null;
  }[] = [];

  try {
    allSkills = await db
      .select({
        slug: skills.slug,
        name: skills.name,
        summary: skills.summary,
        authorName: skills.authorName,
        iconEmoji: skills.iconEmoji,
        statsStars: skills.statsStars,
        createdAt: skills.createdAt,
      })
      .from(skills)
      .where(and(eq(skills.moderationStatus, "approved"), isNull(skills.deletedAt)))
      .orderBy(desc(skills.createdAt));
  } catch {
    // DB not ready
  }

  // Collect unique emojis from skills + standard set
  const standardEmojis = ["🌍", "🎨", "🎮", "🎵", "📸", "🤖", "🦐", "✨"];
  const skillEmojis = Array.from(new Set(allSkills.map((s) => s.iconEmoji).filter(Boolean))) as string[];
  const allEmojis = Array.from(new Set([...standardEmojis, ...skillEmojis]));

  return (
    <div className="min-h-screen bg-[#faf3d0]">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold font-heading text-[#564337]">Explore Skills</h1>
            <p className="text-[#7a6a5a] mt-1 font-body">
              {allSkills.length} Skill{allSkills.length !== 1 ? "s" : ""} available
            </p>
          </div>
          {auth && (
            <Link
              href="/submit"
              className="px-5 py-2.5 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
            >
              Submit a Skill
            </Link>
          )}
        </div>

        {/* Interactive grid with emoji filter */}
        <SkillsGrid initialSkills={allSkills} allEmojis={allEmojis} />

        {/* Empty state when no skills at all */}
        {allSkills.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <div className="text-5xl">🦐</div>
            <h2 className="text-xl font-semibold text-[#564337] font-heading">No skills yet</h2>
            <p className="text-[#7a6a5a] font-body">Be the first to submit a Skill!</p>
            {auth ? (
              <Link
                href="/submit"
                className="inline-block px-6 py-3 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white font-semibold rounded-[40px] shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
              >
                Submit a Skill
              </Link>
            ) : (
              <Link
                href="/register"
                className="inline-block px-6 py-3 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white font-semibold rounded-[40px] shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
              >
                Sign up to submit
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
