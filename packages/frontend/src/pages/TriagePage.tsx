import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { TriageRow } from "@/components/triage/TriageRow";
import { Button } from "@/components/ui/button";
import { useAdverseMediaArticles } from "@/hooks/useAdverseMedia";
import { useScreening } from "@/hooks/useScreening";
import { type TriageFilters, useTriageResults } from "@/hooks/useTriage";
import { useRunTriage } from "@/hooks/useTriageMutations";
import { SOURCE_TYPE_LABELS, type SourceType, type TriageDecision } from "@/types/triage";

const SOURCE_TYPE_FILTERS: Array<{ value: SourceType | "all"; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "netreveal", label: SOURCE_TYPE_LABELS.netreveal },
  { value: "ctos_legal_case", label: SOURCE_TYPE_LABELS.ctos_legal_case },
  { value: "adverse_media", label: SOURCE_TYPE_LABELS.adverse_media },
];

const DECISION_FILTERS: Array<{ value: TriageDecision | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "relevant", label: "Relevant" },
  { value: "false_positive", label: "False Positive" },
];

export function TriagePage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceType | "all">("all");
  const [decisionFilter, setDecisionFilter] = useState<TriageDecision | "all">("all");

  const filters: TriageFilters = {
    sourceType: sourceTypeFilter === "all" ? undefined : sourceTypeFilter,
    reviewerFinalDecision: decisionFilter === "all" ? undefined : decisionFilter,
  };
  const { data: results, isLoading, isError } = useTriageResults(vendorId, filters);
  const { data: screening } = useScreening(vendorId);
  const { data: articles } = useAdverseMediaArticles(vendorId);
  const runTriage = useRunTriage(vendorId);

  const legalCaseById = useMemo(
    () => new Map((screening?.legalCases ?? []).map((c) => [c.id, c])),
    [screening]
  );
  const netrevealById = useMemo(
    () => new Map((screening?.netrevealRecords ?? []).map((r) => [r.id, r])),
    [screening]
  );
  const articleById = useMemo(() => new Map((articles ?? []).map((a) => [a.id, a])), [articles]);

  if (!vendorId) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Triage Queue</h1>
          <p className="text-sm text-muted-foreground">
            AI-scored findings from NetReveal, CTOS legal cases, and adverse media, sorted by
            likelihood of a genuine risk.
          </p>
        </div>
        <div className="text-right">
          <Button disabled={runTriage.isPending} onClick={() => runTriage.mutate()}>
            {runTriage.isPending ? "Running triage..." : "Run Triage"}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Scores every not-yet-decided finding - can take a minute or two.
          </p>
        </div>
      </div>

      {runTriage.isError && (
        <p className="text-sm text-destructive">{runTriage.error.message}</p>
      )}
      {runTriage.isSuccess && (
        <p className="text-sm text-muted-foreground">
          Triaged {runTriage.data.triagedCount} finding(s)
          {runTriage.data.skippedCount > 0 && `, skipped ${runTriage.data.skippedCount}`}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-1">
          {SOURCE_TYPE_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={sourceTypeFilter === f.value ? "default" : "outline"}
              onClick={() => setSourceTypeFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {DECISION_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={decisionFilter === f.value ? "default" : "outline"}
              onClick={() => setDecisionFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading triage results...</p>}
      {isError && <p className="text-sm text-destructive">Could not load triage results.</p>}
      {results && results.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No triage results match these filters. Run triage to score pending findings.
        </p>
      )}

      <div className="space-y-3">
        {results?.map((result) => (
          <TriageRow
            key={result.id}
            vendorId={vendorId}
            result={result}
            legalCase={
              result.sourceType === "ctos_legal_case"
                ? legalCaseById.get(result.sourceRecordId)
                : undefined
            }
            netrevealRecord={
              result.sourceType === "netreveal" ? netrevealById.get(result.sourceRecordId) : undefined
            }
            article={
              result.sourceType === "adverse_media" ? articleById.get(result.sourceRecordId) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
