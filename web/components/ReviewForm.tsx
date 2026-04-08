"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";

interface Props {
  skillSlug: string;
}

const STARS = [1, 2, 3, 4, 5] as const;

export function ReviewForm({ skillSlug }: Props) {
  const t = useT("reviews");
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;

    setStatus("loading");
    try {
      const res = await fetch(`/api/skills/${skillSlug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating, comment }),
      });

      if (res.ok) {
        setStatus("success");
        setRating(0);
        setComment("");
        // Reload page to show new review
        window.location.reload();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Star rating */}
      <div>
        <p className="text-sm font-medium text-[#564337] mb-2 font-heading">
          {t("your_rating")}
        </p>
        <div className="flex gap-1">
          {STARS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRating(s)}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              className="text-2xl transition-transform hover:scale-110 focus:outline-none"
              aria-label={t("stars", {count: String(s)})}
            >
              <span
                className={
                  s <= (hover || rating)
                    ? "text-[#fa7025]"
                    : "text-[#d4c8b8]"
                }
              >
                ★
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("comment_placeholder")}
          rows={3}
          className="w-full px-4 py-3 rounded-2xl border border-[#e8dfc8] bg-[#fffdf7] text-sm text-[#564337] placeholder-[#c8b898] focus:outline-none focus:border-[#a23f00] focus:ring-2 focus:ring-[#a23f00]/10 transition-colors resize-none font-body"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={rating === 0 || status === "loading"}
          className="px-5 py-2.5 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold btn-pill shadow-[0_4px_16px_rgba(162,63,0,0.2)] transition-all font-heading disabled:cursor-not-allowed"
        >
          {status === "loading" ? t("submitting") : t("submit_review")}
        </button>
        {status === "success" && (
          <span className="text-sm text-[#586330] font-body">{t("submitted")}</span>
        )}
        {status === "error" && (
          <span className="text-sm text-[#c44] font-body">{t("failed")}</span>
        )}
      </div>
    </form>
  );
}
