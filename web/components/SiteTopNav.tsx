import type { ReactNode } from "react";
import { CenteredNavLinks, type CenteredNavLink } from "@/components/CenteredNavLinks";

type SiteTopNavProps = {
  centerItems: CenteredNavLink[];
  leftSlot: ReactNode;
  rightSlot: ReactNode;
  containerClassName?: string;
  headerClassName?: string;
};

export function SiteTopNav({
  centerItems,
  leftSlot,
  rightSlot,
  containerClassName = "mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8",
  headerClassName = "sticky top-0 z-50 border-b border-[#dbe5f7] bg-white/80 backdrop-blur-xl",
}: SiteTopNavProps) {
  return (
    <header className={headerClassName}>
      <div className={containerClassName}>
        <div className="relative flex h-16 items-center sm:h-[72px]">
          <div className="flex min-w-0 items-center gap-2">{leftSlot}</div>

          <div className="pointer-events-none absolute inset-x-0 hidden justify-center md:flex">
            <div className="pointer-events-auto">
              <CenteredNavLinks items={centerItems} />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 md:gap-3">{rightSlot}</div>
        </div>
      </div>
    </header>
  );
}
