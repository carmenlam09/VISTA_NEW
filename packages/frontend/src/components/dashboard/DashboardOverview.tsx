import { AlertTriangle, Building2, FileCheck2, ShieldCheck } from "lucide-react";

import { useDashboardOverview } from "@/hooks/useDashboardOverview";

import { StatCard } from "./StatCard";

const MONTHS_CAPTION = "6-month trend";

export function DashboardOverview() {
  const { data, isLoading, isError } = useDashboardOverview();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-elevated h-[118px] animate-pulse bg-muted/40" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return null; // Non-critical - the vendor table below still works without it.
  }

  const { totalVendors, vendorsScreened, pendingTriage, reportsApproved } = data.kpis;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Building2}
        label="Total Vendors"
        value={totalVendors.value}
        tone="brand"
        series={totalVendors.series}
        deltaPct={totalVendors.deltaPct}
        trendCaption={MONTHS_CAPTION}
      />
      <StatCard
        icon={ShieldCheck}
        label="Vendors Screened"
        value={vendorsScreened.value}
        detail={`of ${totalVendors.value} onboarded`}
        tone="info"
        series={vendorsScreened.series}
        deltaPct={vendorsScreened.deltaPct}
      />
      <StatCard
        icon={AlertTriangle}
        label="Pending Triage Review"
        value={pendingTriage.value}
        tone="warning"
        series={pendingTriage.series}
        deltaPct={pendingTriage.deltaPct}
        // More findings arriving means more open risk work, so a rise here
        // is flagged red rather than celebrated green.
        riseIsGood={false}
        trendCaption="Findings triaged per month"
      />
      <StatCard
        icon={FileCheck2}
        label="KYV Reports Approved"
        value={reportsApproved.value}
        tone="success"
        series={reportsApproved.series}
        deltaPct={reportsApproved.deltaPct}
        trendCaption={MONTHS_CAPTION}
      />
    </div>
  );
}
