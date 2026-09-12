import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { useAdverseMediaArticles } from "@/hooks/useAdverseMedia";
import { RISK_THEMES, RISK_THEME_LABELS, type RiskTheme } from "@/types/adverseMedia";

const HIGH_SENSITIVITY_THEMES: RiskTheme[] = ["sanctions", "financial_crime"];

// Condensed, read-only version of the full Adverse Media dashboard, shown on
// the Vendor Profile summary page (Module 3 Section 4, item 2).
export function AdverseMediaSummaryCard({ vendorId }: { vendorId: string }) {
  const { data: articles, isLoading } = useAdverseMediaArticles(vendorId);

  const relevantCounts = RISK_THEMES.reduce(
    (acc, theme) => {
      acc[theme] =
        articles?.filter((a) => a.riskTheme === theme && a.reviewerDecision === "relevant")
          .length ?? 0;
      return acc;
    },
    {} as Record<RiskTheme, number>
  );

  const hasHighSensitivityPending = articles?.some(
    (a) => HIGH_SENSITIVITY_THEMES.includes(a.riskTheme) && a.reviewerDecision === "pending"
  );

  const themesWithRelevant = RISK_THEMES.filter((theme) => relevantCounts[theme] > 0);

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Adverse Media</h2>
        <Link
          to={`/vendor/${vendorId}/adverse-media`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Open full screening
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          {hasHighSensitivityPending && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
              ⚠ Unresolved sanctions/financial crime finding awaiting review
            </div>
          )}
          {themesWithRelevant.length === 0 ? (
            <p className="text-sm text-muted-foreground">No confirmed relevant findings yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {themesWithRelevant.map((theme) => (
                <Badge key={theme} variant="outline">
                  {RISK_THEME_LABELS[theme]}: {relevantCounts[theme]}
                </Badge>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
