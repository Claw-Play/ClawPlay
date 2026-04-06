import Link from "next/link";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getAuthFromCookies } from "@/lib/auth";
import { HomeClient } from "./HomeClient";

export default async function HomePage() {
  // Fetch featured skills (latest 4 approved)
  let featuredSkills: { slug: string; name: string; iconEmoji: string; summary: string }[] = [];
  try {
    const rows = await db
      .select({
        slug: skills.slug,
        name: skills.name,
        iconEmoji: skills.iconEmoji,
        summary: skills.summary,
      })
      .from(skills)
      .where(and(eq(skills.moderationStatus, "approved"), isNull(skills.deletedAt)))
      .limit(4);
    featuredSkills = rows;
  } catch {
    // DB not ready yet — show placeholder
  }

  const auth = await getAuthFromCookies();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#fefae0]/90 backdrop-blur-md border-b border-[#e8dfc8]">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl">🦐</span>
            <span className="text-xl font-bold font-heading text-[#564337] group-hover:text-[#a23f00] transition-colors">
              ClawPlay
            </span>
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            <Link
              href="/skills"
              className="text-sm font-medium text-[#7a6a5a] hover:text-[#a23f00] transition-colors font-body"
            >
              Explore Skills
            </Link>
            {auth ? (
              <Link
                href="/dashboard"
                className="px-5 py-2.5 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-[#7a6a5a] hover:text-[#a23f00] transition-colors font-body"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#fefae0] via-[#faf3d0] to-[#f5ecb8] py-20 md:py-28 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#fffdf7] border border-[#e8dfc8] rounded-full px-5 py-2 text-sm text-[#7a6a5a] shadow-sm font-body">
            <span>✨</span>
            <span>Open-source AI Skills Ecosystem</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold font-heading text-[#564337] leading-[1.05] tracking-tight">
            Build the future of{" "}
            <span className="bg-gradient-to-r from-[#a23f00] to-[#fa7025] bg-clip-text text-transparent">AI Social</span> play
          </h1>

          <p className="text-xl md:text-2xl text-[#7a6a5a] max-w-2xl mx-auto leading-relaxed font-body">
            ClawPlay is the community hub for X Claw social &amp; entertainment Skills.
            Share your creativity, discover amazing Skills, and power your X Claw with
            unified multimodal capabilities.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/register"
              className="px-8 py-4 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-base font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
            >
              Start for free
            </Link>
            <Link
              href="/skills"
              className="px-8 py-4 bg-white hover:bg-[#faf3d0] text-[#a23f00] text-base font-semibold rounded-[40px] border-2 border-[#a23f00] transition-colors font-heading"
            >
              Browse Skills
            </Link>
          </div>
        </div>
      </section>

      {/* Token Setup — shown when logged in */}
      {auth && <HomeClient />}

      {/* Features */}
      <section className="py-16 md:py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold font-heading text-[#564337] text-center mb-12">
            Why ClawPlay?
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-[#fffdf7] card-radius p-6 md:p-8 border border-[#e8dfc8] card-shadow space-y-3"
              >
                <div className="text-3xl">{f.icon}</div>
                <h3 className="font-semibold font-heading text-[#564337] text-lg">{f.title}</h3>
                <p className="text-sm text-[#7a6a5a] leading-relaxed font-body">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Skills */}
      {featuredSkills.length > 0 && (
        <section className="py-16 md:py-20 px-6 bg-[#faf3d0]">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-xs font-semibold font-heading text-[#fa7025] uppercase tracking-wider mb-1 block">
                  Handpicked for you
                </span>
                <h2 className="text-2xl md:text-3xl font-bold font-heading text-[#564337]">
                  Featured Skills
                </h2>
              </div>
              <Link
                href="/skills"
                className="text-sm font-medium text-[#a23f00] hover:text-[#c45000] transition-colors font-body"
              >
                View all skills →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
              {featuredSkills.map((s) => (
                <Link
                  key={s.slug}
                  href={`/skills/${s.slug}`}
                  className="bg-[#fffdf7] card-radius p-5 border border-[#e8dfc8] card-shadow card-shadow-hover transition-all duration-200 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{s.iconEmoji}</span>
                    <span className="inline-block px-2 py-0.5 bg-[#d8e6a6]/60 text-[#586330] text-xs font-semibold rounded-full font-body">
                      Free
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold font-heading text-[#564337] text-base">{s.name}</h3>
                    <p className="text-xs text-[#7a6a5a] line-clamp-2 mt-1 font-body">
                      {s.summary || "No description yet."}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-[#564337]">
            Ready to build something fun?
          </h2>
          <p className="text-lg text-[#7a6a5a] font-body">
            Join the community and start creating or using Skills today.
            Free tier includes 1,000 quota units.
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
          >
            Create your account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e8dfc8] py-12 px-6" style={{ background: "#fefae0" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🦐</span>
                <span className="text-base font-bold font-heading text-[#564337]">ClawPlay</span>
              </div>
              <p className="text-sm text-[#7a6a5a] font-body leading-relaxed">
                The community hub for X Claw social &amp; entertainment Skills. Open source, human-reviewed, privacy-first.
              </p>
            </div>

            {/* About */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold font-heading text-[#564337] uppercase tracking-wider">About</h4>
              <ul className="space-y-2">
                {FOOTER_ABOUT.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-[#7a6a5a] hover:text-[#a23f00] transition-colors font-body">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold font-heading text-[#564337] uppercase tracking-wider">Resources</h4>
              <ul className="space-y-2">
                {FOOTER_RESOURCES.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-[#7a6a5a] hover:text-[#a23f00] transition-colors font-body">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold font-heading text-[#564337] uppercase tracking-wider">Connect</h4>
              <div className="flex gap-3">
                {SOCIAL_LINKS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-[14px] bg-[#fffdf7] border border-[#e8dfc8] flex items-center justify-center text-[#7a6a5a] hover:text-[#a23f00] hover:border-[#a23f00] transition-all"
                    title={s.label}
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
              <p className="text-xs text-[#a89888] font-body">
                Built with intention. © {new Date().getFullYear()} ClawPlay.
              </p>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-[#e8dfc8] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#a89888] font-body">
              © {new Date().getFullYear()} ClawPlay. Created with intention.
            </p>
            <div className="flex gap-5">
              <Link href="/terms" className="text-xs text-[#a89888] hover:text-[#a23f00] transition-colors font-body">Terms</Link>
              <Link href="/privacy" className="text-xs text-[#a89888] hover:text-[#a23f00] transition-colors font-body">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: "🖼️",
    title: "Unified Multimodal CLI",
    desc: "One command to generate images, synthesize speech, and more. No more managing multiple API keys.",
  },
  {
    icon: "🛡️",
    title: "API Key Protection",
    desc: "Your provider API keys stay secure on our server. Skill developers only get encrypted tokens.",
  },
  {
    icon: "🎁",
    title: "Free Tier Included",
    desc: "Every account gets 1,000 free quota units. Generous enough to explore, simple enough to start.",
  },
  {
    icon: "🤖",
    title: "Human Review",
    desc: "All Skills are reviewed before publication. Quality and safety guaranteed for X Claw users.",
  },
  {
    icon: "⚡",
    title: "One-click Setup",
    desc: "Copy one command to your X Claw environment. No configuration needed.",
  },
  {
    icon: "🌍",
    title: "Open Source",
    desc: "Built in the open, for the community. Fork, contribute, and shape the future of AI Skills.",
  },
];

const FOOTER_ABOUT = [
  { label: "About", href: "/about" },
  { label: "Documentation", href: "/docs" },
  { label: "Blog", href: "/blog" },
  { label: "Careers", href: "/careers" },
];

const FOOTER_RESOURCES = [
  { label: "Skill Authoring Guide", href: "/docs/skill-authoring" },
  { label: "CLI Reference", href: "/docs/cli" },
  { label: "API Docs", href: "/docs/api" },
  { label: "Community", href: "/community" },
];

const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com", icon: "⌨️" },
  { label: "Twitter", href: "https://twitter.com", icon: "🐦" },
  { label: "Discord", href: "https://discord.gg", icon: "💬" },
];
