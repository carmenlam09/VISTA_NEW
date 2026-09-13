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
        gradient="from-indigo-500 to-blue-600"
        wash="bg-indigo-50/50"
      />
      <StatCard
        icon={ShieldCheck}
        label="Vendors Screened"
        value={stats.vendors.screened}
        detail={`of ${stats.vendors.total} vendor${stats.vendors.total === 1 ? "" : "s"} onboarded`}
        gradient="from-cyan-500 to-teal-600"
        wash="bg-cyan-50/50"
      />
      <StatCard
        icon={AlertTriangle}
        label="Pending Triage Review"
        value={stats.triage.byDecision.pending}
        detail={`${stats.triage.byDecision.relevant} flagged relevant so far`}
        gradient="from-amber-500 to-orange-600"
        wash="bg-amber-50/50"
      />
      <StatCard
        icon={FileCheck2}
        label="KYV Reports Approved"
        value={stats.kyvReports.byStatus.approved}
        detail={`${stats.kyvReports.total} report${stats.kyvReports.total === 1 ? "" : "s"} generated overall`}
        gradient="from-emerald-500 to-green-600"
        wash="bg-emerald-50/50"
      />
    </div>
  );
}
