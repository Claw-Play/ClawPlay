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
        <p className="mb-2 font-heading text-sm font-medium text-[#102040]">
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
                    ? "text-[#2d67f7]"
                    : "text-[#c8d7f7]"
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
          className="w-full resize-none rounded-[6px] border border-[#d9e4f7] bg-[#fbfdff] px-4 py-3 text-sm text-[#102040] placeholder-[#98a3bc] transition-colors focus:border-[#2d67f7] focus:outline-none focus:ring-2 focus:ring-[#2d67f7]/10 font-body"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={rating === 0 || status === "loading"}
          className="rounded-[6px] bg-[#2d67f7] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2457d4] disabled:cursor-not-allowed disabled:opacity-50 font-heading"
        >
          {status === "loading" ? t("submitting") : t("submit_review")}
        </button>
        {status === "success" && (
          <span className="text-sm text-[#2f6fdd] font-body">{t("submitted")}</span>
        )}
        {status === "error" && (
          <span className="text-sm text-[#c44] font-body">{t("failed")}</span>
        )}
      </div>
    </form>
  );
}
