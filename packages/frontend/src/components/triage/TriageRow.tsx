import { useState } from "react";

import { ArticleCard } from "@/components/adverseMedia/ArticleCard";
import { LegalCasesTable } from "@/components/screening/LegalCasesTable";
import { NetrevealCard } from "@/components/screening/NetrevealCard";
import { SubjectBadge } from "@/components/screening/SubjectBadge";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TriageDecisionInput, useSetTriageDecision } from "@/hooks/useTriageMutations";
import type { AdverseMediaArticle } from "@/types/adverseMedia";
import type { CtosLegalCase, NetrevealRecord } from "@/types/screening";
import {
  type RiskTriageResult,
  SOURCE_TYPE_LABELS,
  type SuggestedDecision,
  type TriageDecision,
} from "@/types/triage";

const CONFIDENCE_STYLE: Record<SuggestedDecision, { variant: BadgeProps["variant"]; label: string }> = {
  relevant: { variant: "destructive", label: "Likely risk" },
  needs_review: { variant: "warning", label: "Needs review" },
  false_positive: { variant: "secondary", label: "Likely false positive" },
};

const DECISION_STYLE: Record<TriageDecision, { variant: BadgeProps["variant"]; label: string }> = {
  pending: { variant: "warning", label: "Pending" },
  relevant: { variant: "success", label: "Relevant" },
  false_positive: { variant: "secondary", label: "False Positive" },
};

export function TriageRow({
  vendorId,
  result,
  legalCase,
  netrevealRecord,
  article,
}: {
  vendorId: string;
  result: RiskTriageResult;
  legalCase?: CtosLegalCase;
  netrevealRecord?: NetrevealRecord;
  article?: AdverseMediaArticle;
}) {
  const [expanded, setExpanded] = useState(false);
  const setDecision = useSetTriageDecision(vendorId);

  const isRelevant = result.reviewerFinalDecision === "relevant";
  const isFalsePositive = result.reviewerFinalDecision === "false_positive";
  const confidenceStyle = CONFIDENCE_STYLE[result.suggestedDecision];
  const decisionStyle = DECISION_STYLE[result.reviewerFinalDecision];

  function decide(decision: TriageDecisionInput) {
    setDecision.mutate({ triageId: result.id, decision });
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{SOURCE_TYPE_LABELS[result.sourceType]}</Badge>
            <SubjectBadge subjectType={result.subjectType} subjectName={result.subjectName} />
            <Badge variant={confidenceStyle.variant}>
              {Math.round(Number(result.confidenceScore))} · {confidenceStyle.label}
            </Badge>
            <Badge variant={decisionStyle.variant}>{decisionStyle.label}</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">{result.aiRationale}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant={isRelevant ? "default" : "outline"}
            disabled={setDecision.isPending}
            onClick={() => decide("relevant")}
          >
            Relevant
          </Button>
          <Button
            size="sm"
            variant={isFalsePositive ? "default" : "outline"}
            disabled={setDecision.isPending}
            onClick={() => decide("false_positive")}
          >
            False Positive
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide" : "Details"}
          </Button>
        </div>
      </div>

      {setDecision.isError && (
        <p className="px-3 pb-2 text-xs text-destructive">{setDecision.error.message}</p>
      )}

      {expanded && (
        <div className="border-t border-border bg-muted/20 p-3">
          {result.sourceType === "netreveal" &&
            (netrevealRecord ? (
              <NetrevealCard vendorId={vendorId} record={netrevealRecord} />
            ) : (
              <p className="text-sm text-muted-foreground">This finding is no longer available.</p>
            ))}
          {result.sourceType === "ctos_legal_case" &&
            (legalCase ? (
              <LegalCasesTable vendorId={vendorId} items={[legalCase]} showSubjectBadge={false} />
            ) : (
              <p className="text-sm text-muted-foreground">This finding is no longer available.</p>
            ))}
          {result.sourceType === "adverse_media" &&
            (article ? (
              <ArticleCard vendorId={vendorId} article={article} hideDecisionControls />
            ) : (
              <p className="text-sm text-muted-foreground">This finding is no longer available.</p>
            ))}
        </div>
      )}
    </div>
  );
}
