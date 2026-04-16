"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` once when the element enters the viewport.
 * Returns the current displayed value (floored integer).
 */
export function useCountUp(target: number, enabled: boolean, duration = 1200) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, target, duration]);

  return count;
}
