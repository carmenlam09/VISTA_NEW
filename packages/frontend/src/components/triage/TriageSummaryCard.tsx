import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { useTriageResults } from "@/hooks/useTriage";

// Condensed, read-only version of the Triage queue, shown on the Vendor
// Profile summary page (Module 4 Section 4, item 2) - the count that should
// catch a reviewer's attention before they move on to Module 5's report.
export function TriageSummaryCard({ vendorId }: { vendorId: string }) {
  const { data: results, isLoading } = useTriageResults(vendorId, {});

  const pending = results?.filter((r) => r.reviewerFinalDecision === "pending") ?? [];
  const highConfidenceCount = pending.filter((r) => r.suggestedDecision === "relevant").length;
  const needsReviewCount = pending.filter((r) => r.suggestedDecision === "needs_review").length;

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Triage</h2>
        <Link
          to={`/vendor/${vendorId}/triage`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Open triage queue
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !results || results.length === 0 ? (
        <p className="text-sm text-muted-foreground">Triage hasn&apos;t been run for this vendor yet.</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">All triaged findings have been reviewed.</p>
      ) : (
        <>
          {highConfidenceCount > 0 && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-800 dark:bg-red-950/40 dark:text-red-300">
              ⚠ {highConfidenceCount} high-confidence item{highConfidenceCount === 1 ? "" : "s"} need
              review
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="warning">{pending.length} pending</Badge>
            {highConfidenceCount > 0 && (
              <Badge variant="destructive">{highConfidenceCount} high-confidence</Badge>
            )}
            {needsReviewCount > 0 && <Badge variant="outline">{needsReviewCount} needs review</Badge>}
          </div>
        </>
      )}
    </section>
  );
}
