import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ClawPlay",
  description: "AI Skills Ecosystem",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fefae0] via-[#faf3d0] to-[#f5ecb8] flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl">🦐</span>
          <span className="text-xl font-bold font-heading text-[#564337] group-hover:text-[#a23f00] transition-colors">
            ClawPlay
          </span>
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Warm card */}
          <div className="bg-[#fffdf7] card-radius card-shadow p-8 md:p-10 space-y-6 border border-[#e8dfc8]">
            {children}
          </div>

          <p className="text-center text-sm text-[#7a6a5a] mt-6 font-body">
            By continuing, you agree to the{" "}
            <Link href="/terms" className="underline hover:text-[#a23f00]">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-[#a23f00]">
              Privacy Policy
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
