import { AlertTriangle, Building2, FileCheck2, ShieldCheck } from "lucide-react";

import { useDashboardStats } from "@/hooks/useDashboardStats";

import { StatCard } from "./StatCard";

export function DashboardOverview() {
  const { data: stats, isLoading, isError } = useDashboardStats();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading dashboard...</p>;
  }
  if (isError || !stats) {
    return null; // Non-critical - the vendor table below still works without it.
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Building2}
        label="Total Vendors"
        value={stats.vendors.total}
        tone="brand"
      />
      <StatCard
        icon={ShieldCheck}
        label="Vendors Screened"
        value={stats.vendors.screened}
        detail={`of ${stats.vendors.total} vendor${stats.vendors.total === 1 ? "" : "s"} onboarded`}
        tone="info"
      />
      <StatCard
        icon={AlertTriangle}
        label="Pending Triage Review"
        value={stats.triage.byDecision.pending}
        detail={`${stats.triage.byDecision.relevant} flagged relevant so far`}
        tone="warning"
      />
      <StatCard
        icon={FileCheck2}
        label="KYV Reports Approved"
        value={stats.kyvReports.byStatus.approved}
        detail={`${stats.kyvReports.total} report${stats.kyvReports.total === 1 ? "" : "s"} generated overall`}
        tone="success"
      />
    </div>
  );
}
