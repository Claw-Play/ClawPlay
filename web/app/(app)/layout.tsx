"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_TOP = [
  { label: "首页", href: "/" },
  { label: "探索", href: "/skills" },
  { label: "技能库", href: "/skills" },
  { label: "社区", href: "/community" },
];

const NAV_SIDEBAR = [
  { label: "全部技能", href: "/skills", icon: "grid" },
  { label: "热门趋势", href: "/skills?sort=trending", icon: "trending" },
  { label: "最新上线", href: "/skills?sort=new", icon: "new" },
  { label: "我的收藏", href: "/dashboard", icon: "bookmark" },
  { label: "设置", href: "/dashboard", icon: "settings" },
];

function NavIcon({ name }: { name: string }) {
  if (name === "grid") return <span className="inline-block w-4 text-center text-base">⊞</span>;
  if (name === "trending") return <span className="inline-block w-4 text-center text-base">↗</span>;
  if (name === "new") return <span className="inline-block w-4 text-center text-base">✦</span>;
  if (name === "bookmark") return <span className="inline-block w-4 text-center text-base">▦</span>;
  if (name === "settings") return <span className="inline-block w-4 text-center text-base">⚙</span>;
  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isSkillsRoute = pathname.startsWith("/skills");

  const sidebarItems = NAV_SIDEBAR.map((item) => ({
    ...item,
    active:
      item.href === "/skills"
        ? pathname === "/skills" || pathname.startsWith("/skills")
        : false,
  }));

  return (
    <div className="min-h-screen bg-[#fefae0]">
      {/* Top Navigation Bar */}
      <header className="bg-[#fefae0] border-b border-[#e8dfc8] sticky top-0 z-50">
        <div className="max-w-[1536px] mx-auto px-8 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl">🦐</span>
            <span className="text-xl font-bold font-heading text-[#a23f00] group-hover:text-[#c45000] transition-colors">
              ClawPlay
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="flex items-center gap-8">
            {NAV_TOP.map(({ label, href }) => {
              const active =
                label === "技能库"
                  ? pathname.startsWith("/skills")
                  : false;
              return (
                <Link
                  key={label}
                  href={href}
                  className={`text-sm font-semibold transition-colors font-body ${
                    active
                      ? "text-[#a23f00] border-b-2 border-[#a23f00] pb-1"
                      : "text-[#586330] hover:text-[#a23f00]"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Link
              href="/submit"
              className="px-6 py-2 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold rounded-full shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
            >
              添加技能
            </Link>
            <div className="w-10 h-10 rounded-full bg-[#faf3d0] border-2 border-[#e8dfc8] flex items-center justify-center text-lg">
              🦐
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar — shown only on Skills routes */}
        {isSkillsRoute && (
          <aside className="w-[256px] shrink-0 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
            <div className="bg-[#fefae0] p-4 flex flex-col gap-1">
              {/* Sidebar header */}
              <div className="px-3 pb-4 border-b border-[#e8dfc8]">
                <p className="text-base font-bold text-[#a23f00] font-heading">技能库</p>
                <p className="text-xs text-[#564337] opacity-60 font-body mt-0.5">
                  发现精选 AI 行为
                </p>
              </div>

              {/* Nav items */}
              <div className="pt-2 flex flex-col gap-1">
                {sidebarItems.map(({ label, href, icon, active }) => (
                  <Link
                    key={label}
                    href={href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium font-body transition-colors ${
                      active
                        ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white"
                        : "text-[#586330] hover:bg-[#ede9cf]"
                    }`}
                  >
                    <NavIcon name={icon} />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>

              {/* Join Workshop — bottom */}
              <div className="mt-auto pt-4 border-t border-[#e8dfc8]">
                <Link
                  href="/submit"
                  className="block w-full text-center py-3 rounded-full bg-[#d8e6a6] text-[#5c6834] text-sm font-bold font-heading hover:bg-[#c8d896] transition-colors"
                >
                  加入工作坊
                </Link>
              </div>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
