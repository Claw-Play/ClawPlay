export function averageRating(
  statsStars: number | null | undefined,
  statsRatingsCount: number | null | undefined
): number | null {
  const count = Number(statsRatingsCount ?? 0);
  if (count <= 0) return null;

  const total = Number(statsStars ?? 0);
  const average = total / count;
  if (!Number.isFinite(average)) return null;

  return Math.min(5, Math.max(0, Number(average.toFixed(1))));
}

export function formatAverageRating(
  statsStars: number | null | undefined,
  statsRatingsCount: number | null | undefined
): string {
  return (averageRating(statsStars, statsRatingsCount) ?? 0).toFixed(1);
}
