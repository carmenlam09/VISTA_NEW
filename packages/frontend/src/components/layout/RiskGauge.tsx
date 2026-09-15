import { Link } from "react-router-dom";

import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { RISK_TIERS } from "@/lib/risk";

const SIZE = 132;
const STROKE = 11;
const R = (SIZE - STROKE) / 2;
/** Arc sweep in degrees - a 240° horseshoe, open at the bottom. */
const SWEEP = 240;
const START = 90 + (360 - SWEEP) / 2; // 150°, measured clockwise from 3 o'clock

function point(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: SIZE / 2 + R * Math.cos(rad), y: SIZE / 2 + R * Math.sin(rad) };
}

// pathLength="100" lets the value arc be drawn as a plain percentage dash.
const start = point(START);
const end = point(START + SWEEP);
const ARC = `M ${start.x} ${start.y} A ${R} ${R} 0 1 1 ${end.x} ${end.y}`;

/**
 * Portfolio risk posture, shown in the sidebar. The score is the mean derived
 * risk of vendors that have findings - see the methodology note on the
 * dashboard's Risk Exposure card; it is a rule-based heuristic, not a
 * validated model, and the caption says so rather than dressing it up.
 */
export function RiskGauge() {
  const { data } = useDashboardOverview();
  if (!data) return null;

  const { portfolioScore, portfolioTier } = data.risk;
  const tier = RISK_TIERS[portfolioTier];
  const assessed = portfolioScore !== null;

  return (
    <div className="mx-3 mb-3 rounded-xl border border-sidebar-border bg-sidebar-raised/60 p-4">
      <div className="text-xs font-bold text-white">Risk Intelligence</div>

      <div className="relative mx-auto mt-1" style={{ width: SIZE, height: SIZE * 0.82 }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <path
            d={ARC}
            fill="none"
            stroke="hsl(var(--sidebar-border))"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {assessed && (
            <path
              d={ARC}
              fill="none"
              stroke={tier.hex}
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${portfolioScore} 100`}
              style={{ filter: `drop-shadow(0 0 6px ${tier.hex}66)` }}
            />
          )}
        </svg>
        <div className="absolute inset-x-0 top-[34%] flex flex-col items-center">
          <div className="flex items-baseline">
            <span className="text-3xl font-extrabold leading-none tabular-nums text-white">
              {assessed ? portfolioScore : "—"}
            </span>
            {assessed && <span className="ml-0.5 text-[10px] text-sidebar-muted">/100</span>}
          </div>
          <span className="mt-1 text-[10px] text-sidebar-muted">Overall Risk Posture</span>
          <span className="mt-0.5 text-xs font-bold" style={{ color: tier.hex }}>
            {tier.label}
          </span>
        </div>
      </div>

      <Link
        to="/#risk"
        className="mt-1 block text-center text-[11px] font-semibold text-brand transition-colors hover:text-white"
      >
        View risk summary →
      </Link>
    </div>
  );
}
