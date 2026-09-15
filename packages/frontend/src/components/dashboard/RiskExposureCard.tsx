import { Info } from "lucide-react";

import { RISK_TIERS, RISK_TIER_ORDER } from "@/lib/risk";
import type { DashboardOverview } from "@/types/overview";

const SIZE = 132;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Visual gap between segments, in px along the circumference. */
const GAP = 3;

export function RiskExposureCard({ risk }: { risk: DashboardOverview["risk"] }) {
  const { distribution, totalExposures, methodology } = risk;
  // Segments and centre figure share one unit - vendors - so the ring always
  // adds up to the number printed inside it.
  const total = RISK_TIER_ORDER.reduce((sum, t) => sum + distribution[t], 0);

  let offset = 0;
  const segments = RISK_TIER_ORDER.filter((t) => distribution[t] > 0).map((tier) => {
    const fraction = distribution[tier] / total;
    const length = Math.max(0, fraction * CIRCUMFERENCE - (total > 1 ? GAP : 0));
    const seg = { tier, length, offset };
    offset += fraction * CIRCUMFERENCE;
    return seg;
  });

  const methodologyNote =
    `Score = Σ(finding confidence × weight) ÷ ${methodology.divisor}, capped at 100. ` +
    `High ≥ ${methodology.highRiskMin}, Medium ≥ ${methodology.mediumRiskMin}. ` +
    `Weights: confirmed ${methodology.weights.confirmedRelevant}, ` +
    `AI-suggested ${methodology.weights.pendingSuggestedRelevant}, ` +
    `needs review ${methodology.weights.pendingNeedsReview}, ` +
    `false positive ${methodology.weights.falsePositive}. ` +
    `Rule-based demo heuristic, not a validated risk model.`;

  return (
    <div className="card-elevated flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Risk Exposure Summary</h3>
          <p className="text-[11px] text-muted-foreground">Vendors by derived risk tier</p>
        </div>
        <span
          title={methodologyNote}
          aria-label={`How risk is calculated: ${methodologyNote}`}
          className="cursor-help rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Info size={14} />
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-6 text-center text-xs text-muted-foreground">No vendors yet.</p>
      ) : (
        <div className="mt-4 flex flex-1 items-center gap-5">
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={STROKE}
              />
              {segments.map(({ tier, length, offset: segOffset }) => (
                <circle
                  key={tier}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={RISK_TIERS[tier].hex}
                  strokeWidth={STROKE}
                  strokeDasharray={`${length} ${CIRCUMFERENCE}`}
                  strokeDashoffset={-segOffset}
                  strokeLinecap="butt"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold leading-none tabular-nums">{total}</span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Vendors
              </span>
            </div>
          </div>

          <ul className="min-w-0 flex-1 space-y-2.5">
            {RISK_TIER_ORDER.map((tier) => {
              const count = distribution[tier];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <li key={tier} className="flex items-center gap-2 text-xs">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: RISK_TIERS[tier].hex }}
                  />
                  <span className="flex-1 truncate font-medium">{RISK_TIERS[tier].label}</span>
                  <span className="font-bold tabular-nums">{count}</span>
                  <span className="w-9 text-right tabular-nums text-muted-foreground">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span className="font-bold text-foreground">{totalExposures}</span> weighted risk findings
        across the portfolio
      </div>
    </div>
  );
}
