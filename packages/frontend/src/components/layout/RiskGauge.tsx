import { Link, useLocation, useParams } from "react-router-dom";

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
 * Risk posture for whichever vendor is currently open, not the portfolio.
 * This card sits in the sidebar on every vendor screen (intake, screening,
 * adverse media, triage, KYV report...), so a static portfolio-wide number
 * here is actively misleading - a reviewer staring at a 100/High vendor would
 * see the sidebar claim "78/High" because that's the blend across every
 * vendor. Scoping it to the open vendor fixes that mismatch. The portfolio
 * figure still lives on the Dashboard's Risk Exposure Summary card, so it
 * isn't lost - it's just shown where it's actually about the portfolio.
 *
 * Score is a rule-based heuristic derived from Module 4 triage findings, not
 * a validated risk model - see the methodology note on the Risk Exposure card.
 */
export function RiskGauge() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { pathname } = useLocation();
  const { data } = useDashboardOverview();
  if (!data) return null;

  const vendorRisk = vendorId
    ? data.risk.byVendor.find((v) => v.vendorId === vendorId)
    : undefined;

  // "Not assessed" (a vendor with zero triage findings) and "no vendor open"
  // are different situations and read differently: the former still names
  // the vendor and shows a tier pill, the latter is a plain prompt.
  const tier = vendorRisk ? RISK_TIERS[vendorRisk.tier] : null;
  const assessed = Boolean(vendorRisk && vendorRisk.score !== null);
  // The link below sends the reviewer to this vendor's profile page - but
  // this gauge is shown in the sidebar on that very page too, and a link to
  // the page you are already on is a no-op click that just looks broken.
  const onVendorProfile = Boolean(vendorId) && pathname === `/vendor/${vendorId}`;

  return (
    <div className="mx-3 mb-3 rounded-xl border border-sidebar-border bg-sidebar-raised/60 p-4">
      <div className="text-xs font-bold text-white">Risk Intelligence</div>
      {vendorRisk && (
        <div className="mt-0.5 truncate text-[10px] text-sidebar-muted" title={vendorRisk.companyName}>
          {vendorRisk.companyName}
        </div>
      )}

      <div className="relative mx-auto mt-2" style={{ width: SIZE, height: SIZE * 0.82 }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-hidden="true"
          // Decorative and sized taller than the container it sits in (the
          // container is deliberately cropped to hide the horseshoe's empty
          // bottom gap) - without this the svg's own unclipped bounding box
          // overflows into, and intercepts clicks meant for, the link below.
          className="pointer-events-none"
        >
          <path
            d={ARC}
            fill="none"
            stroke="hsl(var(--sidebar-border))"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {assessed && vendorRisk && tier && (
            <path
              d={ARC}
              fill="none"
              stroke={tier.hex}
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${vendorRisk.score} 100`}
              style={{ filter: `drop-shadow(0 0 6px ${tier.hex}66)` }}
            />
          )}
        </svg>
        <div className="absolute inset-x-0 top-[34%] flex flex-col items-center">
          <div className="flex items-baseline">
            <span className="text-3xl font-extrabold leading-none tabular-nums text-white">
              {assessed && vendorRisk ? vendorRisk.score : "—"}
            </span>
            {assessed && <span className="ml-0.5 text-[10px] text-sidebar-muted">/100</span>}
          </div>
          <span className="mt-1 text-[10px] text-sidebar-muted">
            {vendorId ? "Risk Posture" : "No vendor selected"}
          </span>
          {tier && (
            <span className="mt-0.5 text-xs font-bold" style={{ color: tier.hex }}>
              {tier.label}
            </span>
          )}
        </div>
      </div>

      {!vendorId ? (
        // No vendor is open, so there is nowhere useful to send a click -
        // plain muted text rather than a link that goes nowhere meaningful
        // and never changes colour on hover, which reads as broken.
        <p className="mt-1 text-center text-[11px] text-sidebar-muted">
          Open a vendor to see its risk
        </p>
      ) : onVendorProfile ? (
        <p className="mt-1 text-center text-[11px] text-sidebar-muted">
          Viewing this vendor's profile
        </p>
      ) : (
        <Link
          to={`/vendor/${vendorId}`}
          className="mt-1 block text-center text-[11px] font-semibold text-brand transition-colors hover:text-white"
        >
          View vendor risk →
        </Link>
      )}
    </div>
  );
}
