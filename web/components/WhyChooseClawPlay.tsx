"use client";
import { useT } from "@/lib/i18n/context";

const FEATURE_KEYS = [
  { icon: "✦", titleKey: "feature_1_title", descKey: "feature_1_desc" },
  { icon: "✓", titleKey: "feature_2_title", descKey: "feature_2_desc" },
  { icon: "☰", titleKey: "feature_3_title", descKey: "feature_3_desc" },
  { icon: "↥", titleKey: "feature_4_title", descKey: "feature_4_desc" },
  { icon: "⚡", titleKey: "feature_5_title", descKey: "feature_5_desc" },
  { icon: "◎", titleKey: "feature_6_title", descKey: "feature_6_desc" },
] as const;

function ValueCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <article className="flex gap-4 rounded-[16px] border border-[#dfe7fb] bg-white/85 p-5 shadow-[0_8px_20px_rgba(22,38,77,0.04)]">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f2f6ff] text-[20px] text-[#2d67f7]">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-[#1f2b45]">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-6 text-[#72809c]">{desc}</p>
      </div>
    </article>
  );
}

export function WhyChooseClawPlay({
  title,
  mode = "home",
  sectionClassName = "",
}: {
  title: string;
  mode?: "home" | "auth";
  sectionClassName?: string;
}) {
  const t = useT("home");
  const isAuth = mode === "auth";

  return (
    <section className={sectionClassName}>
      <div
        className={[
          "relative w-full",
          isAuth ? "max-w-[680px]" : "mx-auto max-w-[1240px]",
        ].join(" ")}
      >
        {isAuth ? (
          <div className="pr-2 sm:pr-6 lg:pl-8 lg:pr-2 xl:pl-12">
            <h2 className="text-center text-[clamp(1.45rem,2.2vw,2rem)] font-semibold tracking-[-0.04em] text-[#15213b]">
              {title}
            </h2>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {FEATURE_KEYS.map((f) => (
                <ValueCard key={f.titleKey} icon={f.icon} title={t(f.titleKey)} desc={t(f.descKey)} />
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-[#eaf1ff] px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:pb-16">
            <div className="mx-auto max-w-[1240px]">
              <h2 className="text-center text-[clamp(1.55rem,2.8vw,2.25rem)] font-semibold tracking-[-0.04em] text-[#15213b]">
                {title}
              </h2>

              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {FEATURE_KEYS.map((f) => (
                  <ValueCard key={f.titleKey} icon={f.icon} title={t(f.titleKey)} desc={t(f.descKey)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
