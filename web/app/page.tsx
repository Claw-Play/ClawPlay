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
              探索 Skill
            </Link>
            {auth ? (
              <Link
                href="/dashboard"
                className="px-5 py-2.5 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
              >
                控制台
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-[#7a6a5a] hover:text-[#a23f00] transition-colors font-body"
                >
                  登录
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
                >
                  立即开始
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
            <span>开源 AI Skills 生态系统</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold font-heading text-[#564337] leading-[1.05] tracking-tight">
            为{" "}
            <span className="bg-gradient-to-r from-[#a23f00] to-[#fa7025] bg-clip-text text-transparent">X Claw</span>{" "}
            智能体构建技能生态
          </h1>

          <p className="text-xl md:text-2xl text-[#7a6a5a] max-w-2xl mx-auto leading-relaxed font-body">
            ClawPlay 是 X Claw 社交娱乐 Skills 的开源社区枢纽。分享创意、发现优质技能，让你的 AI 智能体拥有统一的多模态能力。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href={auth ? "/dashboard" : "/register"}
              className="px-8 py-4 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-base font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
            >
              免费开始使用
            </Link>
            <Link
              href="/skills"
              className="px-8 py-4 bg-white hover:bg-[#faf3d0] text-[#a23f00] text-base font-semibold rounded-[40px] border-2 border-[#a23f00] transition-colors font-heading"
            >
              浏览 Skills
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
            为什么选择 ClawPlay？
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
                  精选推荐
                </span>
                <h2 className="text-2xl md:text-3xl font-bold font-heading text-[#564337]">
                  热门 Skills
                </h2>
              </div>
              <Link
                href="/skills"
                className="text-sm font-medium text-[#a23f00] hover:text-[#c45000] transition-colors font-body"
              >
                查看全部 →
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
                      免费
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold font-heading text-[#564337] text-base">{s.name}</h3>
                    <p className="text-xs text-[#7a6a5a] line-clamp-2 mt-1 font-body">
                      {s.summary || "暂无描述。"}
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
            准备好开始构建了吗？
          </h2>
          <p className="text-lg text-[#7a6a5a] font-body">
            加入社区，今天就开始创建或使用 Skills。免费套餐包含 1,000 配额。
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
          >
            创建你的账号
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
                X Claw 社交娱乐 Skills 的开源社区枢纽。开源、人工审核、隐私优先。
              </p>
            </div>

            {/* About */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold font-heading text-[#564337] uppercase tracking-wider">关于</h4>
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
              <h4 className="text-xs font-semibold font-heading text-[#564337] uppercase tracking-wider">资源</h4>
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
              <h4 className="text-xs font-semibold font-heading text-[#564337] uppercase tracking-wider">联系我们</h4>
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
                用心构建。© {new Date().getFullYear()} ClawPlay。
              </p>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-[#e8dfc8] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#a89888] font-body">
              © {new Date().getFullYear()} ClawPlay。用心构建。
            </p>
            <div className="flex gap-5">
              <Link href="/terms" className="text-xs text-[#a89888] hover:text-[#a23f00] transition-colors font-body">服务条款</Link>
              <Link href="/privacy" className="text-xs text-[#a89888] hover:text-[#a23f00] transition-colors font-body">隐私政策</Link>
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
    title: "统一多模态 CLI",
    desc: "一行命令生成图片、合成语音，无需管理多个 API 密钥。",
  },
  {
    icon: "🛡️",
    title: "API 密钥保护",
    desc: "你的服务商密钥安全地存储在服务端，Skill 开发者只能使用加密令牌。",
  },
  {
    icon: "🎁",
    title: "免费配额",
    desc: "每个账号赠送 1,000 配额，足以探索体验，无需绑定信用卡。",
  },
  {
    icon: "🤖",
    title: "人工审核",
    desc: "所有 Skills 上线前均经过人工审核，确保质量和安全。",
  },
  {
    icon: "⚡",
    title: "一键安装",
    desc: "复制一条命令即可完成 X Claw 环境配置，无需任何配置。",
  },
  {
    icon: "🌍",
    title: "开源透明",
    desc: "代码开源、社区共建。Fork、贡献，一起塑造 AI Skills 的未来。",
  },
];

const FOOTER_ABOUT = [
  { label: "关于我们", href: "/about" },
  { label: "文档", href: "/docs" },
  { label: "博客", href: "/blog" },
  { label: "加入我们", href: "/careers" },
];

const FOOTER_RESOURCES = [
  { label: "Skill 编写指南", href: "/docs/skill-authoring" },
  { label: "CLI 命令参考", href: "/docs/cli" },
  { label: "API 文档", href: "/docs/api" },
  { label: "社区", href: "/community" },
];

const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com", icon: "⌨️" },
  { label: "Twitter", href: "https://twitter.com", icon: "🐦" },
  { label: "Discord", href: "https://discord.gg", icon: "💬" },
];
