import { Link } from "react-router-dom";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { useKyvReportHistory } from "@/hooks/useKyvReports";
import type { KyvReportStatus } from "@/types/kyvReport";

const STATUS_BADGE: Record<KyvReportStatus, { label: string; variant: BadgeProps["variant"] }> = {
  draft: { label: "Draft", variant: "warning" },
  pending_checker_review: { label: "Pending Checker Review", variant: "outline" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

// Condensed view of the latest KYV report's status, shown on the Vendor
// Profile summary page (Module 5 Section 4, item 2).
export function KyvReportSummaryCard({ vendorId }: { vendorId: string }) {
  const { data: reports, isLoading } = useKyvReportHistory(vendorId);
  // History is already sorted most-recent-first by the API.
  const latest = reports?.[0];

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">KYV Report</h2>
        <Link
          to={`/vendor/${vendorId}/kyv-report`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Open KYV report
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !latest ? (
        <p className="text-sm text-muted-foreground">No report generated yet.</p>
      ) : (
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_BADGE[latest.status].variant}>
            {STATUS_BADGE[latest.status].label}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {new Date(latest.generatedAt).toLocaleDateString()}
          </span>
        </div>
      )}
    </section>
  );
}
