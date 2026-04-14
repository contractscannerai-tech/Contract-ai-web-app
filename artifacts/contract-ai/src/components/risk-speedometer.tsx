import { useEffect, useState } from "react";

type RiskLevel = "low" | "medium" | "high";

const RISK_CONFIG: Record<RiskLevel, { pct: number; label: string; color: string; glow: string }> = {
  low:    { pct: 20, label: "Low Risk",    color: "#22c55e", glow: "rgba(34,197,94,0.5)"  },
  medium: { pct: 55, label: "Medium Risk", color: "#f59e0b", glow: "rgba(245,158,11,0.5)" },
  high:   { pct: 84, label: "High Risk",   color: "#ef4444", glow: "rgba(239,68,68,0.5)"  },
};

const R = 88;
const CX = 120;
const CY = 118;
const TOTAL_LEN = Math.PI * R;

function polarToXY(angleDeg: number, radius = R) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

function semiArc(r: number) {
  const s = polarToXY(180, r);
  const e = polarToXY(0, r);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 1 1 ${e.x} ${e.y}`;
}

export function RiskSpeedometer({ riskLevel }: { riskLevel: RiskLevel }) {
  const cfg = RISK_CONFIG[riskLevel];
  const [animPct, setAnimPct] = useState(0);

  useEffect(() => {
    setAnimPct(0);
    const t = setTimeout(() => setAnimPct(cfg.pct), 120);
    return () => clearTimeout(t);
  }, [riskLevel, cfg.pct]);

  const dashOffset = TOTAL_LEN * (1 - animPct / 100);

  const needleRotateDeg = -90 + animPct * 1.8;
  const needleTipLocal = { x: CX, y: CY - (R - 16) };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 240 136" className="w-56 sm:w-64" aria-label={`Risk level: ${cfg.label}`}>
        {/* Zone backgrounds */}
        <path d={semiArc(R)} fill="none" stroke="#22c55e" strokeWidth={20} strokeLinecap="butt"
              strokeDasharray={`${TOTAL_LEN * 0.3} ${TOTAL_LEN}`} strokeDashoffset={TOTAL_LEN * 0.7} opacity={0.18} />
        <path d={semiArc(R)} fill="none" stroke="#f59e0b" strokeWidth={20} strokeLinecap="butt"
              strokeDasharray={`${TOTAL_LEN * 0.3} ${TOTAL_LEN}`} strokeDashoffset={TOTAL_LEN * 0.4} opacity={0.18} />
        <path d={semiArc(R)} fill="none" stroke="#ef4444" strokeWidth={20} strokeLinecap="butt"
              strokeDasharray={`${TOTAL_LEN * 0.4} ${TOTAL_LEN}`} strokeDashoffset={0} opacity={0.18} />

        {/* Track */}
        <path d={semiArc(R)} fill="none" stroke="hsl(var(--muted))" strokeWidth={14} strokeLinecap="round" opacity={0.3} />

        {/* Active arc */}
        <path
          d={semiArc(R)}
          fill="none"
          stroke={cfg.color}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${TOTAL_LEN} ${TOTAL_LEN}`}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 1.4s cubic-bezier(0.25,0.46,0.45,0.94), stroke 0.6s ease",
            filter: `drop-shadow(0 0 8px ${cfg.glow})`,
          }}
        />

        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const angle = 180 - pct * 1.8;
          const outer = polarToXY(angle, R + 6);
          const inner = polarToXY(angle, R - 6);
          return (
            <line key={pct} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
                  stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} opacity={0.4} />
          );
        })}

        {/* Needle */}
        <g style={{
          transform: `rotate(${needleRotateDeg}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          transition: "transform 1.4s cubic-bezier(0.25,0.46,0.45,0.94)",
        }}>
          <line
            x1={CX} y1={CY}
            x2={needleTipLocal.x} y2={needleTipLocal.y}
            stroke={cfg.color}
            strokeWidth={3}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${cfg.glow})` }}
          />
          {/* Needle tip triangle */}
          <polygon
            points={`${CX},${CY - R + 6} ${CX - 5},${CY - R + 22} ${CX + 5},${CY - R + 22}`}
            fill={cfg.color}
            style={{ filter: `drop-shadow(0 0 4px ${cfg.glow})` }}
          />
        </g>

        {/* Pivot */}
        <circle cx={CX} cy={CY} r={10} fill={cfg.color} style={{ filter: `drop-shadow(0 0 10px ${cfg.glow})` }} />
        <circle cx={CX} cy={CY} r={5} fill="white" />

        {/* Percentage */}
        <text x={CX} y={CY + 28} textAnchor="middle" fontSize={22} fontWeight="bold" fill={cfg.color}
              style={{ filter: `drop-shadow(0 0 10px ${cfg.glow})`, transition: "fill 0.6s ease" }}>
          {animPct}%
        </text>

        {/* Zone labels */}
        <text x={18} y={CY + 10} textAnchor="middle" fontSize={9} fill="#22c55e" fontWeight={600} opacity={0.7}>LOW</text>
        <text x={CX} y={22}       textAnchor="middle" fontSize={9} fill="#f59e0b" fontWeight={600} opacity={0.7}>MED</text>
        <text x={222} y={CY + 10} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight={600} opacity={0.7}>HIGH</text>
      </svg>

      <span
        className="text-sm font-bold tracking-wide uppercase"
        style={{ color: cfg.color, textShadow: `0 0 12px ${cfg.glow}` }}
      >
        {cfg.label}
      </span>
    </div>
  );
}
