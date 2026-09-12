import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KyvReportStatus, KyvReportSummary } from "@/types/kyvReport";

const STATUS_BADGE: Record<KyvReportStatus, { label: string; variant: BadgeProps["variant"] }> = {
  draft: { label: "Draft", variant: "warning" },
  pending_checker_review: { label: "Pending Checker Review", variant: "outline" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export function KyvReportHistoryList({
  reports,
  isLoading,
  selectedId,
  onSelect,
}: {
  reports: KyvReportSummary[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (reportId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="mb-3 text-sm font-semibold">Report History</h2>

      {isLoading && <p className="text-sm text-muted-foreground">Loading reports...</p>}
      {!isLoading && reports.length === 0 && (
        <p className="text-sm text-muted-foreground">No reports generated yet.</p>
      )}

      {reports.length > 0 && (
        <div className="space-y-2">
          {reports.map((report) => {
            const badge = STATUS_BADGE[report.status];
            const isSelected = report.id === selectedId;
            return (
              <div
                key={report.id}
                className={cn(
                  "flex items-center justify-between rounded-md border p-2",
                  isSelected ? "border-primary" : "border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(report.generatedAt).toLocaleString()}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => onSelect(report.id)}
                >
                  Open
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
