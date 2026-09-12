import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { KyvReportActions } from "@/components/kyvReport/KyvReportActions";
import { KyvReportHistoryList } from "@/components/kyvReport/KyvReportHistoryList";
import { KyvReportSectionCard } from "@/components/kyvReport/KyvReportSectionCard";
import { Button } from "@/components/ui/button";
import { useAdverseMediaArticles } from "@/hooks/useAdverseMedia";
import { useGenerateKyvReport } from "@/hooks/useKyvReportMutations";
import { useKyvReport, useKyvReportHistory } from "@/hooks/useKyvReports";
import { useScreening } from "@/hooks/useScreening";

export function KyvReportPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { data: history, isLoading: historyLoading } = useKyvReportHistory(vendorId);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const generate = useGenerateKyvReport(vendorId);

  // Default to the most recent report once history loads, if nothing's open yet.
  useEffect(() => {
    if (!selectedReportId && history && history.length > 0) {
      setSelectedReportId(history[0].id);
    }
  }, [history, selectedReportId]);

  const {
    data: report,
    isLoading: reportLoading,
    isError: reportError,
  } = useKyvReport(selectedReportId ?? undefined);

  // Live pending-findings count (Section 3's validation rule) - recomputed
  // from current Module 2/3 data rather than a frozen snapshot, so it stays
  // accurate even for a report opened well after it was generated.
  const { data: screening } = useScreening(vendorId);
  const { data: articles } = useAdverseMediaArticles(vendorId);
  const pendingCount =
    (screening?.netrevealRecords.filter((r) => r.riskDecision === "pending").length ?? 0) +
    (screening?.legalCases.filter((c) => c.riskDecision === "pending").length ?? 0) +
    (articles?.filter((a) => a.reviewerDecision === "pending").length ?? 0);

  if (!vendorId) return null;

  function handleGenerate() {
    generate.mutate(undefined, {
      onSuccess: (result) => setSelectedReportId(result.id),
    });
  }

  const editable = report?.status === "draft" || report?.status === "rejected";

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">KYV Report</h1>
          <p className="text-sm text-muted-foreground">
            AI-drafted vendor risk report, reviewed through a Maker-Checker approval flow.
          </p>
        </div>
        <Button disabled={generate.isPending} onClick={handleGenerate}>
          {generate.isPending ? "Generating..." : "Generate New Report"}
        </Button>
      </div>
      {generate.isError && <p className="text-sm text-destructive">{generate.error.message}</p>}

      <KyvReportHistoryList
        reports={history ?? []}
        isLoading={historyLoading}
        selectedId={selectedReportId}
        onSelect={setSelectedReportId}
      />

      {selectedReportId &&
        (reportLoading ? (
          <p className="text-sm text-muted-foreground">Loading report...</p>
        ) : reportError || !report ? (
          <p className="text-sm text-destructive">Could not load this report.</p>
        ) : (
          <section className="space-y-4 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">
                  Report generated {new Date(report.generatedAt).toLocaleString()}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Template: {report.template.name} ({report.template.version})
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/kyv-reports/${report.id}/export`}>Export PDF</a>
              </Button>
            </div>

            {pendingCount > 0 && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                ⚠ {pendingCount} finding{pendingCount === 1 ? "" : "s"} still pending triage
                decision - not reflected in this report.
              </div>
            )}

            {report.status === "rejected" && report.reviewerComments && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <strong>Reviewer comments:</strong> {report.reviewerComments}
              </div>
            )}

            <div className="space-y-3">
              {report.sections.map((section) => (
                <KyvReportSectionCard
                  key={section.id}
                  vendorId={vendorId}
                  reportId={report.id}
                  section={section}
                  editable={editable}
                />
              ))}
            </div>

            <KyvReportActions vendorId={vendorId} report={report} />
          </section>
        ))}
    </div>
  );
}
