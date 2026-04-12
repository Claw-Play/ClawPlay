import Link from "next/link";

interface NavProps {
  auth: { userId: number; role: string } | null;
}

export default function Nav({ auth }: NavProps) {
  return (
    <nav className="bg-[#fefae0]/90 border-b border-[#e8dfc8] sticky top-0 z-50 backdrop-blur-md">
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
            Skills
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
                href="/login"
                className="px-5 py-2.5 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
