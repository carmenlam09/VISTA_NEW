import { ExternalLink } from "lucide-react";

import { SubjectBadge } from "@/components/screening/SubjectBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DecidableDecision, useSetArticleDecision } from "@/hooks/useAdverseMediaMutations";
import { cn } from "@/lib/utils";
import type { AdverseMediaArticle } from "@/types/adverseMedia";

export function ArticleCard({
  vendorId,
  article,
  hideDecisionControls = false,
}: {
  vendorId: string;
  article: AdverseMediaArticle;
  /** The Triage queue has its own Relevant/False Positive control that keeps
   * risk_triage_results in sync too - hide this card's own to avoid two
   * controls for the same decision going through different endpoints. */
  hideDecisionControls?: boolean;
}) {
  const setDecision = useSetArticleDecision(vendorId);
  const isRelevant = article.reviewerDecision === "relevant";
  const isFalsePositive = article.reviewerDecision === "false_positive";

  function decide(decision: DecidableDecision) {
    setDecision.mutate({ articleId: article.id, decision });
  }

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        isFalsePositive
          ? "border-border bg-muted/40 opacity-60"
          : isRelevant
            ? "border-emerald-300 bg-emerald-50"
            : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <a
            href={article.articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline"
          >
            {article.articleTitle}
          </a>
          {article.sourceDomain && (
            <div className="mt-0.5 text-xs text-muted-foreground">{article.sourceDomain}</div>
          )}
        </div>
        {article.search && (
          <SubjectBadge
            subjectType={article.search.subjectType}
            subjectName={article.search.subjectName}
          />
        )}
      </div>

      {article.categorizationStatus === "pending" && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Badge variant="warning">Summary pending</Badge>
          AI summary is still being generated for this article.
        </p>
      )}
      {article.categorizationStatus === "failed" && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Badge variant="destructive">Summary unavailable</Badge>
          The AI summary could not be generated - review the article directly.
        </p>
      )}
      {article.categorizationStatus === "completed" && (
        <p className="mt-2 text-sm">{article.aiSummary}</p>
      )}

      <a
        href={article.articleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
      >
        View article
        <ExternalLink className="h-3 w-3" />
      </a>

      {!hideDecisionControls && (
        <div className="mt-3 flex items-center gap-2">
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
        </div>
      )}
    </div>
  );
}
