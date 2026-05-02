"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ReviewForm } from "@/components/ReviewForm";
import { useT } from "@/lib/i18n/context";

interface Review {
  id: number;
  rating: number;
  comment: string;
  createdAt: string | null;
}

interface ReviewsData {
  averageRating: number | null;
  statsRatingsCount: number;
  reviews: Review[];
}

interface Props {
  skillSlug: string;
  authUserId: number | null;
}

export function ReviewsSection({ skillSlug, authUserId }: Props) {
  const t = useT("reviews");
  const tCommon = useT("common");
  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/skills/${skillSlug}/reviews`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [skillSlug]);

  if (loading) {
    return (
      <div className="rounded-[6px] border border-[#dbe5f7] bg-white p-6 shadow-[0_8px_20px_rgba(25,43,87,0.06)]">
        <h2 className="mb-4 font-heading text-[20px] font-bold tracking-[-0.02em] text-[#102040]">{t("title")}</h2>
        <p className="text-sm text-[#667391] font-body">{t("loading")}</p>
      </div>
    );
  }

  if (!data) return null;

  const { averageRating, statsRatingsCount, reviews } = data;

  return (
    <div className="space-y-6 rounded-[6px] border border-[#dbe5f7] bg-white p-6 shadow-[0_8px_20px_rgba(25,43,87,0.06)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-[20px] font-bold tracking-[-0.02em] text-[#102040]">
          {t("title")}
          {statsRatingsCount > 0 && (
            <span className="ml-2 text-sm font-normal text-[#667391] font-body">
              {t("stats_count", {count: String(statsRatingsCount)})}
            </span>
          )}
        </h2>
        {averageRating !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#2d67f7] font-heading">
              {averageRating}
            </span>
            <span className="text-sm text-[#667391] font-body">{t("rating_out_of")}</span>
          </div>
        )}
      </div>

      {/* Review form */}
      {authUserId ? (
        <ReviewForm skillSlug={skillSlug} />
      ) : (
        <div className="rounded-[6px] border border-[#dfe8f8] bg-[#f7faff] p-4 text-sm text-[#667391] font-body">
          <Link href="/login" className="text-[#2d67f7] hover:underline font-medium">
            {tCommon("login")}
          </Link>
          {t("login_suffix")}
        </div>
      )}

      {/* Review list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-[#52617d] italic font-body">
          {t("be_first")}
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
              <div key={r.id} className="border-b border-[#edf4ff] pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={i < r.rating ? "text-[#2d67f7]" : "text-[#c8d7f7]"}
                    >
                      ★
                    </span>
                  ))}
                </span>
                {r.createdAt && (
                  <span className="text-xs text-[#667391] font-body">
                    {new Date(r.createdAt).toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </span>
                )}
              </div>
              {r.comment && (
                <p className="text-sm leading-relaxed text-[#102040] font-body">
                  {r.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
