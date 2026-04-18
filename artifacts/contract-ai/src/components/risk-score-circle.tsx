import { useEffect, useState } from "react";

type Props = {
  score: number;
  category: string;
  size?: number;
};

export function RiskScoreCircle({ score, category, size = 160 }: Props) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  const color = score >= 80 ? "#16a34a"
    : score >= 50 ? "#ca8a04"
    : score >= 20 ? "#ea580c"
    : "#dc2626";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} data-testid="risk-score-circle">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-muted opacity-30" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums" style={{ color }} data-testid="risk-score-number">{Math.round(animated)}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">/ 100</span>
        <span className="text-xs font-semibold mt-1" style={{ color }} data-testid="risk-score-category">{category}</span>
      </div>
    </div>
  );
}
