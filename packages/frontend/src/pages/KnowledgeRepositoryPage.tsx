import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { KnowledgeRepositoryResultCard } from "@/components/knowledgeRepository/KnowledgeRepositoryResultCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKnowledgeRepositorySearch } from "@/hooks/useKnowledgeRepositorySearch";
import { RISK_THEMES, RISK_THEME_LABELS, type RiskTheme } from "@/types/adverseMedia";
import type { KnowledgeDecision, KnowledgeRepositorySearchParams } from "@/types/knowledgeRepository";

const DECISION_FILTERS: Array<{ value: KnowledgeDecision | "all"; label: string }> = [
  { value: "all", label: "All decisions" },
  { value: "approved", label: "Approved" },
  { value: "relevant", label: "Relevant" },
  { value: "false_positive", label: "False Positive" },
];

export function KnowledgeRepositoryPage() {
  // Supports arriving pre-filled via ?q=... (the Vendor Profile page's
  // "View Similar Past Cases" link) - pre-fills the search bar and runs the
  // search immediately, rather than requiring a second click.
  const [urlParams] = useSearchParams();
  const initialQ = urlParams.get("q") ?? "";

  const [queryText, setQueryText] = useState(initialQ);
  const [riskTheme, setRiskTheme] = useState<RiskTheme | "all">("all");
  const [decision, setDecision] = useState<KnowledgeDecision | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [submittedParams, setSubmittedParams] = useState<KnowledgeRepositorySearchParams | null>(
    initialQ ? buildParams(initialQ) : null
  );

  function buildParams(q: string): KnowledgeRepositorySearchParams {
    return {
      q,
      riskTheme: riskTheme === "all" ? undefined : riskTheme,
      decision: decision === "all" ? undefined : decision,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };
  }

  function handleSearch() {
    if (!queryText.trim()) return;
    setSubmittedParams(buildParams(queryText.trim()));
  }

  // Re-run automatically when a filter changes, as long as a search has
  // already been submitted at least once.
  useEffect(() => {
    if (submittedParams) {
      setSubmittedParams(buildParams(submittedParams.q));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskTheme, decision, dateFrom, dateTo]);

  const { data, isLoading, isError } = useKnowledgeRepositorySearch(submittedParams);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Knowledge Repository</h1>
        <p className="text-sm text-muted-foreground">
          Search past KYV reports and triage decisions across every vendor.
        </p>
      </div>

      <section className="rounded-lg border border-border p-4">
        <div className="flex gap-2">
          <Input
            placeholder='e.g. "has this director been flagged before" or "vendors with sanctions concerns"'
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
          <Button disabled={!queryText.trim() || isLoading} onClick={handleSearch}>
            {isLoading ? "Searching..." : "Search"}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={riskTheme === "all" ? "default" : "outline"}
              onClick={() => setRiskTheme("all")}
            >
              All themes
            </Button>
            {RISK_THEMES.map((theme) => (
              <Button
                key={theme}
                size="sm"
                variant={riskTheme === theme ? "default" : "outline"}
                onClick={() => setRiskTheme(theme)}
              >
                {RISK_THEME_LABELS[theme]}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {DECISION_FILTERS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={decision === f.value ? "default" : "outline"}
                onClick={() => setDecision(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>From</span>
            <Input
              type="date"
              className="h-8 w-auto"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span>To</span>
            <Input
              type="date"
              className="h-8 w-auto"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </section>

      {isError && <p className="text-sm text-destructive">Search failed. Please try again.</p>}

      {!submittedParams && !isError && (
        <p className="text-sm text-muted-foreground">
          Type a query above to search past reports and triage decisions.
        </p>
      )}

      {submittedParams && !isLoading && data && (
        <>
          <section className="rounded-lg border border-border bg-muted/30 p-4">
            <h2 className="mb-1 text-sm font-semibold">AI Synthesis</h2>
            <p className="text-sm text-muted-foreground">{data.ai_synthesis}</p>
          </section>

          {data.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No relevant past reports or decisions matched this query.
            </p>
          ) : (
            <div className="space-y-3">
              {data.results.map((result) => (
                <KnowledgeRepositoryResultCard key={result.id} result={result} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
