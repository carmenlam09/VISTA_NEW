import { Badge } from "@/components/ui/badge";
import { Collapsible } from "@/components/ui/collapsible";
import { RISK_THEMES, RISK_THEME_LABELS } from "@/types/adverseMedia";
import type { AdverseMediaArticle, RiskTheme } from "@/types/adverseMedia";

import { ArticleCard } from "./ArticleCard";

export function RiskThemeGroups({
  vendorId,
  articles,
}: {
  vendorId: string;
  articles: AdverseMediaArticle[];
}) {
  if (articles.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No adverse media results yet. Run a search above.
      </p>
    );
  }

  const grouped = RISK_THEMES.reduce(
    (acc, theme) => {
      acc[theme] = articles.filter((a) => a.riskTheme === theme);
      return acc;
    },
    {} as Record<RiskTheme, AdverseMediaArticle[]>
  );

  const themesWithResults = RISK_THEMES.filter((theme) => grouped[theme].length > 0);

  return (
    <div className="space-y-3">
      {themesWithResults.map((theme) => (
        <Collapsible
          key={theme}
          defaultOpen
          title={RISK_THEME_LABELS[theme]}
          badge={<Badge variant="outline">{grouped[theme].length}</Badge>}
        >
          <div className="space-y-3">
            {grouped[theme].map((article) => (
              <ArticleCard key={article.id} vendorId={vendorId} article={article} />
            ))}
          </div>
        </Collapsible>
      ))}
    </div>
  );
}
