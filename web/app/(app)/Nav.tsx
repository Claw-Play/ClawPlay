import Link from "next/link";
import { ShrimpLogoIcon } from "@/components/icons";

interface NavProps {
  auth: { userId: number; role: string } | null;
}

export default function Nav({ auth }: NavProps) {
  return (
    <nav className="bg-[#f8faff]/90 border-b border-[#dbe5f7] sticky top-0 z-50 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <ShrimpLogoIcon className="w-10 h-10 text-[#2d67f7]" />
          <span className="text-xl font-bold font-heading text-[#1f2b45] group-hover:text-[#2d67f7] transition-colors">
            ClawPlay
          </span>
        </Link>
        <div className="flex items-center gap-4 md:gap-6">
          <Link
            href="/skills"
            className="text-sm font-medium text-[#52617d] hover:text-[#2d67f7] transition-colors font-body"
          >
            Skills
          </Link>
          {auth ? (
            <Link
              href="/dashboard"
              className="px-5 py-2.5 bg-gradient-to-r from-[#2d67f7] to-[#4f82f7] hover:opacity-90 text-white text-sm font-semibold btn-pill shadow-[0_6px_24px_rgba(45,103,247,0.2)] transition-all font-heading"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-[#52617d] hover:text-[#2d67f7] transition-colors font-body"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="px-5 py-2.5 bg-gradient-to-r from-[#2d67f7] to-[#4f82f7] hover:opacity-90 text-white text-sm font-semibold btn-pill shadow-[0_6px_24px_rgba(45,103,247,0.2)] transition-all font-heading"
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
