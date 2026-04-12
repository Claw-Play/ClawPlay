import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "ClawPlay",
  description: "AI Skills Ecosystem",
};

// Background illustration
const bgIllustration = "/images/auth-bg.png";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen overflow-hidden relative flex flex-col" data-name="Registration">
      {/* Immersive Background */}
      <div
        className="absolute inset-0 pointer-events-none overflow-clip"
        data-name="Immersive Background Illustration Container"
      >
        <Image
          alt=""
          fill
          className="object-cover object-left-top"
          src={bgIllustration}
          style={{ objectPosition: "left top" }}
        />
        {/* Warm overlay to ensure readability and warmth */}
        <div
          className="absolute inset-0 bg-[rgba(162,63,0,0.05)] mix-blend-multiply"
          data-name="Overlay"
        />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl">🦐</span>
          <span className="text-xl font-bold font-heading text-[#564337] group-hover:text-[#a23f00] transition-colors">
            ClawPlay
          </span>
        </Link>
      </header>

      {/* Main — centered canvas */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-8 py-11 overflow-y-auto">
        {children}
      </main>

      {/* Simple branding footer */}
      <footer className="relative z-10 flex justify-center py-6">
        <span className="text-xs text-[#564337] font-body">
          © {new Date().getFullYear()} ClawPlay AI Community
        </span>
      </footer>
    </div>
  );
}
