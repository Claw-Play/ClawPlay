import Link from "next/link";

export type CenteredNavLink = {
  label: string;
  href: string;
  active?: boolean;
};

export function CenteredNavLinks({ items }: { items: CenteredNavLink[] }) {
  return (
    <nav className="flex items-center gap-12">
      {items.map(({ label, href, active }) => (
        <Link
          key={label}
          href={href}
          aria-current={active ? "page" : undefined}
          className={[
            "text-[15px] font-semibold transition-colors font-body",
            active
              ? "text-[#2d67f7] border-b-2 border-[#2d67f7] pb-1"
              : "text-[#5f6c86] hover:text-[#2d67f7]",
          ].join(" ")}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
