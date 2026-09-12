import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type FinancialHighlightsInput,
  useUpdateFinancialHighlights,
} from "@/hooks/useScreeningMutations";
import type { CtosFinancialHighlights } from "@/types/screening";

import { SubjectBadge } from "./SubjectBadge";

function toForm(fh: CtosFinancialHighlights | null): FinancialHighlightsInput {
  return {
    total_issued_ordinary: fh?.totalIssuedOrdinary ? Number(fh.totalIssuedOrdinary) : null,
    total_issued_preference: fh?.totalIssuedPreference ? Number(fh.totalIssuedPreference) : null,
    total_issued_others: fh?.totalIssuedOthers ? Number(fh.totalIssuedOthers) : null,
    revenue_turnover: fh?.revenueTurnover ? Number(fh.revenueTurnover) : null,
    net_income: fh?.netIncome ? Number(fh.netIncome) : null,
    current_assets: fh?.currentAssets ? Number(fh.currentAssets) : null,
    current_liabilities: fh?.currentLiabilities ? Number(fh.currentLiabilities) : null,
    current_ratio: fh?.currentRatio ? Number(fh.currentRatio) : null,
    debt_to_equity_ratio: fh?.debtToEquityRatio ? Number(fh.debtToEquityRatio) : null,
  };
}

const PROMINENT_STATS: { key: keyof FinancialHighlightsInput; label: string }[] = [
  { key: "revenue_turnover", label: "Revenue / Turnover" },
  { key: "net_income", label: "Net Income" },
  { key: "current_ratio", label: "Current Ratio" },
  { key: "debt_to_equity_ratio", label: "Debt-to-Equity Ratio" },
];

const OTHER_STATS: { key: keyof FinancialHighlightsInput; label: string }[] = [
  { key: "total_issued_ordinary", label: "Total Issued Ordinary" },
  { key: "total_issued_preference", label: "Total Issued Preference" },
  { key: "total_issued_others", label: "Total Issued Others" },
  { key: "current_assets", label: "Current Assets" },
  { key: "current_liabilities", label: "Current Liabilities" },
];

export function FinancialHighlightsCard({
  vendorId,
  ctosEnquiryId,
  financialHighlights,
}: {
  vendorId: string;
  ctosEnquiryId: string;
  financialHighlights: CtosFinancialHighlights | null;
}) {
  const [form, setForm] = useState<FinancialHighlightsInput>(() => toForm(financialHighlights));
  const updateFinancialHighlights = useUpdateFinancialHighlights(vendorId);
  const verified = financialHighlights?.isVerified ?? false;

  function set(key: keyof FinancialHighlightsInput, raw: string) {
    setForm((prev) => ({ ...prev, [key]: raw === "" ? null : Number(raw) }));
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Financial Highlights</h2>
          {financialHighlights?.ctosEnquiry && (
            <SubjectBadge
              subjectType={financialHighlights.ctosEnquiry.subjectType}
              subjectName={financialHighlights.ctosEnquiry.subjectName}
            />
          )}
        </div>
        {verified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="warning">Needs review</Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PROMINENT_STATS.map(({ key, label }) => (
          <div key={key} className="rounded-md bg-secondary/30 p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <Input
              type="number"
              step="0.01"
              className="mt-1 w-full border-none bg-transparent p-0 text-base font-semibold shadow-none focus-visible:ring-0"
              value={form[key] ?? ""}
              onChange={(e) => set(key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {OTHER_STATS.map(({ key, label }) => (
          <div key={key}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <Input
              type="number"
              step="0.01"
              value={form[key] ?? ""}
              onChange={(e) => set(key, e.target.value)}
            />
          </div>
        ))}
      </div>

      {updateFinancialHighlights.isError && (
        <p className="mt-2 text-xs text-destructive">{updateFinancialHighlights.error.message}</p>
      )}

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={updateFinancialHighlights.isPending}
          onClick={() => updateFinancialHighlights.mutate({ ctosEnquiryId, input: form })}
        >
          {updateFinancialHighlights.isPending ? "Saving..." : "Confirm & Save"}
        </Button>
      </div>
    </section>
  );
}
