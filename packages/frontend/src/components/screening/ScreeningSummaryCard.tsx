import { Link } from "react-router-dom";

import { useScreening } from "@/hooks/useScreening";

function Stat({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

// Condensed, read-only version of the full Screening Intelligence dashboard,
// shown on the Vendor Profile summary page (Module 2 Section 5, item 2).
export function ScreeningSummaryCard({ vendorId }: { vendorId: string }) {
  const { data: screening, isLoading } = useScreening(vendorId);

  const legalCaseCount = screening?.legalCases.length ?? 0;
  const watchlistFlagCount =
    screening?.netrevealRecords.filter((r) => r.watchpersonDetails?.trim()).length ?? 0;
  const financialHighlights = screening?.financialHighlights;

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Screening Intelligence</h2>
        <Link
          to={`/vendor/${vendorId}/screening`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Open full dashboard
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {screening?.screeningSummary?.summaryText ?? "No AI summary generated yet."}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Revenue" value={financialHighlights?.revenueTurnover} />
            <Stat label="Net Income" value={financialHighlights?.netIncome} />
            <Stat label="Current Ratio" value={financialHighlights?.currentRatio} />
            <Stat label="Debt-to-Equity" value={financialHighlights?.debtToEquityRatio} />
          </div>

          <div className="mt-3 flex gap-4 text-xs">
            <span className="text-muted-foreground">
              {legalCaseCount} legal case{legalCaseCount === 1 ? "" : "s"}
            </span>
            <span className={watchlistFlagCount > 0 ? "font-medium text-red-700" : "text-muted-foreground"}>
              {watchlistFlagCount} watchlist flag{watchlistFlagCount === 1 ? "" : "s"}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
