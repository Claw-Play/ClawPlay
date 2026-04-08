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
      <div className="bg-[#fffdf7] card-radius p-6 border border-[#e8dfc8] card-shadow">
        <h2 className="font-semibold font-heading text-[#564337] mb-4">{t("title")}</h2>
        <p className="text-sm text-[#7a6a5a] font-body">{t("loading")}</p>
      </div>
    );
  }

  if (!data) return null;

  const { averageRating, statsRatingsCount, reviews } = data;

  return (
    <div className="bg-[#fffdf7] card-radius p-6 border border-[#e8dfc8] card-shadow space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold font-heading text-[#564337]">
          {t("title")}
          {statsRatingsCount > 0 && (
            <span className="ml-2 text-sm font-normal text-[#7a6a5a] font-body">
              {t("stats_count", {count: String(statsRatingsCount)})}
            </span>
          )}
        </h2>
        {averageRating !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#fa7025] font-heading">
              {averageRating}
            </span>
            <span className="text-sm text-[#7a6a5a] font-body">{t("rating_out_of")}</span>
          </div>
        )}
      </div>

      {/* Review form */}
      {authUserId ? (
        <ReviewForm skillSlug={skillSlug} />
      ) : (
        <div className="bg-[#faf3d0] rounded-2xl p-4 text-sm text-[#7a6a5a] font-body">
          <Link href="/login" className="text-[#a23f00] hover:underline font-medium">
            {tCommon("login")}
          </Link>
          {t("login_suffix")}
        </div>
      )}

      {/* Review list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-[#7a6a5a] italic font-body">
          {t("be_first")}
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="pb-4 border-b border-[#f0e8d0] last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={i < r.rating ? "text-[#fa7025]" : "text-[#d4c8b8]"}
                    >
                      ★
                    </span>
                  ))}
                </span>
                {r.createdAt && (
                  <span className="text-xs text-[#a89888] font-body">
                    {new Date(r.createdAt).toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </span>
                )}
              </div>
              {r.comment && (
                <p className="text-sm text-[#564337] font-body leading-relaxed">
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
