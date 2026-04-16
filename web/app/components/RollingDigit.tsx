"use client";

interface RollingDigitProps {
  digit: string; // "0"-"9"
  rolling: boolean;
}

export function RollingDigit({ digit, rolling }: RollingDigitProps) {
  const target = parseInt(digit, 10);

  return (
    <span
      style={{
        display: "inline-block",
        width: "1em",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        lineHeight: "1.1",
      }}
    >
      <style>{`
        @keyframes digitRoll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-100%); }
        }
      `}</style>
      {/* The strip of 10 digits */}
      <span
        style={{
          display: "block",
          transition: rolling ? "none" : "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
          transform: rolling
            ? undefined
            : `translateY(calc(-${target * 100}% + 0.05em))`,
          animation: rolling
            ? `digitRoll 0.7s linear infinite`
            : "none",
          animationPlayState: rolling ? "running" : "paused",
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span
            key={n}
            style={{
              display: "block",
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              lineHeight: "1.1",
            }}
          >
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}
