import type { Metadata } from "next";
import Link from "next/link";
import { ShrimpLogoIcon } from "@/components/icons";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { WhyChooseClawPlay } from "@/components/WhyChooseClawPlay";
import { getT } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "ClawPlay",
  description: "AI Skills Ecosystem",
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tHome = await getT("home");
  return (
    <div className="min-h-screen relative flex flex-col overflow-x-hidden bg-[#f8faff] text-[#1f2b45]">
      <div className="pointer-events-none absolute inset-0 select-none overflow-hidden bg-[url('/images/auth-bg.png')] bg-cover bg-center opacity-55 blur-[1px] scale-105">
        <div className="absolute inset-0 bg-[#f8faff]/34" />
      </div>

      <header className="sticky top-0 z-50 bg-transparent backdrop-blur-[2px]">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:h-[72px] sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <ShrimpLogoIcon className="h-14 w-14 drop-shadow-[0_4px_12px_rgba(45,103,247,0.35)]" />
            <span className="text-[22px] font-bold tracking-tight text-[#1f2b45] drop-shadow-[0_1px_6px_rgba(248,250,255,0.5)]">
              ClawPlay
            </span>
          </Link>
          <LanguageSwitcher variant="home" />
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto px-4 pt-10 pb-6 md:px-8 md:pt-14 md:pb-10">
        <div className="mx-auto grid w-full max-w-[1540px] items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(340px,380px)] lg:items-end lg:gap-10 xl:gap-12">
          <div className="order-2 lg:order-1">
            <WhyChooseClawPlay
              title={tHome("features_title")}
              mode="auth"
              sectionClassName="w-full"
            />
          </div>

          <div className="order-1 flex justify-center lg:order-2 lg:justify-start">
            {children}
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex justify-center px-4 py-4 md:py-6">
        <span className="text-xs text-[#7c879f] font-medium">
          © {new Date().getFullYear()} ClawPlay AI Community
        </span>
      </footer>
    </div>
  );
}
