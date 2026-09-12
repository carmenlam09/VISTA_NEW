import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type LegalCaseInput,
  useDeleteLegalCase,
  useUpdateLegalCase,
} from "@/hooks/useScreeningMutations";
import type { CtosLegalCase, LegalCaseType } from "@/types/screening";

import { SubjectBadge } from "./SubjectBadge";

// Set from the Triage queue (Module 4) - shown here too so a decision made
// there is visible back in its original module.
const RISK_DECISION_BADGE = {
  pending: { variant: "warning" as const, label: "Triage: Pending" },
  relevant: { variant: "destructive" as const, label: "Triage: Relevant" },
  false_positive: { variant: "secondary" as const, label: "Triage: False Positive" },
};

type Filter = "all" | LegalCaseType;

export function LegalCasesTable({
  vendorId,
  items,
  showSubjectBadge = true,
}: {
  vendorId: string;
  items: CtosLegalCase[];
  /** Omit when items are already scoped to a single, known enquiry (e.g. inside the upload-review modal) */
  showSubjectBadge?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [edits, setEdits] = useState<Record<string, Partial<LegalCaseInput>>>({});
  const updateLegalCase = useUpdateLegalCase(vendorId);
  const deleteLegalCase = useDeleteLegalCase(vendorId);

  const filtered = items.filter((c) => filter === "all" || c.caseType === filter);
  const unverifiedCount = items.filter((c) => !c.isVerified).length;

  function setEdit(id: string, patch: Partial<LegalCaseInput>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function saveRow(item: CtosLegalCase) {
    const patch = edits[item.id];
    if (!patch) return;
    updateLegalCase.mutate(
      { ctosEnquiryId: item.ctosEnquiryId, caseId: item.id, input: patch },
      { onSuccess: () => setEdits((prev) => ({ ...prev, [item.id]: {} })) }
    );
  }

  function confirmAll() {
    Promise.all(
      items
        .filter((c) => !c.isVerified)
        .map((c) =>
          updateLegalCase.mutateAsync({
            ctosEnquiryId: c.ctosEnquiryId,
            caseId: c.id,
            input: { is_verified: true },
          })
        )
    );
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Legal Cases</h2>
        <div className="flex gap-1">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "defendant" ? "default" : "outline"}
            onClick={() => setFilter("defendant")}
          >
            D1 (Defendant)
          </Button>
          <Button
            size="sm"
            variant={filter === "plaintiff" ? "default" : "outline"}
            onClick={() => setFilter("plaintiff")}
          >
            D2 (Plaintiff)
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No legal cases found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const edit = edits[item.id];
            const hasEdit = edit && Object.keys(edit).length > 0;
            return (
              <div key={item.id} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {showSubjectBadge && item.ctosEnquiry && (
                      <SubjectBadge
                        subjectType={item.ctosEnquiry.subjectType}
                        subjectName={item.ctosEnquiry.subjectName}
                      />
                    )}
                    <Badge variant={item.caseType === "defendant" ? "destructive" : "secondary"}>
                      {item.caseType === "defendant" ? "D1 Defendant" : "D2 Plaintiff"}
                    </Badge>
                    {!item.isVerified && <Badge variant="warning">AI-extracted</Badge>}
                    <Badge variant={RISK_DECISION_BADGE[item.riskDecision].variant}>
                      {RISK_DECISION_BADGE[item.riskDecision].label}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    {hasEdit && (
                      <Button size="sm" variant="outline" onClick={() => saveRow(item)}>
                        Save
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        deleteLegalCase.mutate({ ctosEnquiryId: item.ctosEnquiryId, caseId: item.id })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Plaintiff</div>
                    <Input
                      value={edit?.plaintiff ?? item.plaintiff ?? ""}
                      onChange={(e) => setEdit(item.id, { plaintiff: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Defendant</div>
                    <Input
                      value={edit?.defendant ?? item.defendant ?? ""}
                      onChange={(e) => setEdit(item.id, { defendant: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Case No.</div>
                    <Input
                      value={edit?.case_no ?? item.caseNo ?? ""}
                      onChange={(e) => setEdit(item.id, { case_no: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Remark</div>
                    <Input
                      value={edit?.remark ?? item.remark ?? ""}
                      onChange={(e) => setEdit(item.id, { remark: e.target.value || null })}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            disabled={unverifiedCount === 0 || updateLegalCase.isPending}
            onClick={confirmAll}
          >
            {updateLegalCase.isPending ? "Saving..." : "Confirm & Save"}
          </Button>
        </div>
      )}
    </section>
  );
}
