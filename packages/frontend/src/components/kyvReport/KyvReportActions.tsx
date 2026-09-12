import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useApproveKyvReport,
  useRejectKyvReport,
  useSubmitKyvReportForReview,
} from "@/hooks/useKyvReportMutations";
import type { KyvReportDetail } from "@/types/kyvReport";

// Maker-Checker action buttons appropriate to the report's current status
// (VISTA_module5_system_prompt.md Section 4).
export function KyvReportActions({
  vendorId,
  report,
}: {
  vendorId: string;
  report: KyvReportDetail;
}) {
  const submit = useSubmitKyvReportForReview(vendorId, report.id);
  const approve = useApproveKyvReport(vendorId, report.id);
  const reject = useRejectKyvReport(vendorId, report.id);
  const [rejecting, setRejecting] = useState(false);
  const [comments, setComments] = useState("");

  if (report.status === "draft" || report.status === "rejected") {
    return (
      <div>
        <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending
            ? "Submitting..."
            : report.status === "rejected"
              ? "Resubmit for Review"
              : "Submit for Review"}
        </Button>
        {submit.isError && <p className="mt-1 text-xs text-destructive">{submit.error.message}</p>}
      </div>
    );
  }

  if (report.status === "pending_checker_review") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button disabled={approve.isPending} onClick={() => approve.mutate()}>
            {approve.isPending ? "Approving..." : "Approve"}
          </Button>
          <Button
            variant="destructive"
            disabled={reject.isPending}
            onClick={() => setRejecting((v) => !v)}
          >
            Reject
          </Button>
        </div>

        {rejecting && (
          <div className="flex items-start gap-2">
            <Textarea
              rows={2}
              placeholder="Reason for rejection (required)"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
            <Button
              size="sm"
              variant="destructive"
              disabled={!comments.trim() || reject.isPending}
              onClick={() =>
                reject.mutate(comments, {
                  onSuccess: () => {
                    setRejecting(false);
                    setComments("");
                  },
                })
              }
            >
              {reject.isPending ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </div>
        )}

        {(approve.isError || reject.isError) && (
          <p className="text-xs text-destructive">
            {approve.error?.message ?? reject.error?.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Approved{report.reviewedAt ? ` on ${new Date(report.reviewedAt).toLocaleDateString()}` : ""}{" "}
      - read-only.
    </p>
  );
}
