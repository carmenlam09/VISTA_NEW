import { Link } from "react-router-dom";

import { SubjectBadge } from "@/components/screening/SubjectBadge";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { RISK_THEME_LABELS } from "@/types/adverseMedia";
import type { KnowledgeDecision, KnowledgeRepositoryResult, KnowledgeSourceType } from "@/types/knowledgeRepository";

const SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  kyv_report: "KYV Report",
  triage_decision: "Triage Decision",
};

const DECISION_BADGE: Record<KnowledgeDecision, { label: string; variant: BadgeProps["variant"] }> = {
  approved: { label: "Approved", variant: "success" },
  relevant: { label: "Relevant", variant: "destructive" },
  false_positive: { label: "False Positive", variant: "secondary" },
};

// summary_text for kyv_report entries is report section content verbatim,
// which the AI occasionally emits with markdown emphasis even though it's
// meant as plain prose - this is a plain-text display with no bold
// rendering available, so strip the markers rather than show literal
// asterisks (same artifact fixed in the PDF exporter).
function stripMarkdownEmphasis(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

export function KnowledgeRepositoryResultCard({ result }: { result: KnowledgeRepositoryResult }) {
  const decisionBadge = result.decision ? DECISION_BADGE[result.decision] : null;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{SOURCE_TYPE_LABELS[result.sourceType]}</Badge>
        <Link
          to={`/vendor/${result.vendorId}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {result.vendorName}
        </Link>
        {result.subjectType && result.subjectName && (
          <SubjectBadge subjectType={result.subjectType} subjectName={result.subjectName} />
        )}
        {result.riskTheme && <Badge variant="outline">{RISK_THEME_LABELS[result.riskTheme]}</Badge>}
        {decisionBadge && <Badge variant={decisionBadge.variant}>{decisionBadge.label}</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">
          {Math.round(result.similarity * 100)}% match
        </span>
      </div>

      <p className="text-sm text-muted-foreground">{stripMarkdownEmphasis(result.summaryText)}</p>

      <div className="mt-2 text-xs text-muted-foreground">
        Indexed {new Date(result.indexedAt).toLocaleDateString()}
      </div>
    </div>
  );
}
