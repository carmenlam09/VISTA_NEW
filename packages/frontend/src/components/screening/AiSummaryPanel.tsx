import { Button } from "@/components/ui/button";
import { useGenerateScreeningSummary } from "@/hooks/useScreeningMutations";
import type { ScreeningSummary } from "@/types/screening";

export function AiSummaryPanel({
  vendorId,
  summary,
}: {
  vendorId: string;
  summary: ScreeningSummary | null;
}) {
  const generateSummary = useGenerateScreeningSummary(vendorId);

  return (
    <section className="rounded-lg border border-border bg-secondary/20 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">AI Summary</h2>
        <Button
          size="sm"
          variant="outline"
          disabled={generateSummary.isPending}
          onClick={() => generateSummary.mutate()}
        >
          {generateSummary.isPending ? "Generating..." : "Regenerate Summary"}
        </Button>
      </div>

      {generateSummary.isError && (
        <p className="mb-2 text-xs text-destructive">{generateSummary.error.message}</p>
      )}

      {summary ? (
        <>
          <p className="whitespace-pre-line text-sm">{summary.summaryText}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Generated {new Date(summary.generatedAt).toLocaleString()}
            {summary.generatedByModel ? ` · ${summary.generatedByModel}` : ""}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {generateSummary.isPending
            ? "Generating the first summary..."
            : 'No summary yet — click "Regenerate Summary" to generate one from the data captured so far.'}
        </p>
      )}
    </section>
  );
}
