import { useState } from "react";
import { useParams } from "react-router-dom";

import { AddCtosEnquiryModal } from "@/components/screening/AddCtosEnquiryModal";
import { AddNetrevealModal } from "@/components/screening/AddNetrevealModal";
import { AiSummaryPanel } from "@/components/screening/AiSummaryPanel";
import { FinancialHighlightsCard } from "@/components/screening/FinancialHighlightsCard";
import { LegalCasesTable } from "@/components/screening/LegalCasesTable";
import { NetrevealWatchlistSection } from "@/components/screening/NetrevealWatchlistSection";
import { TradeReferencesTable } from "@/components/screening/TradeReferencesTable";
import { Button } from "@/components/ui/button";
import { useScreening } from "@/hooks/useScreening";

export function ScreeningPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { data: screening, isLoading, isError } = useScreening(vendorId);
  const [ctosModalOpen, setCtosModalOpen] = useState(false);
  const [netrevealModalOpen, setNetrevealModalOpen] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading screening data...</p>;
  }
  if (isError || !screening || !vendorId) {
    return <p className="text-sm text-destructive">Could not load screening data.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Screening Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Aggregated CTOS and NetReveal results for this vendor and its directors/shareholders.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNetrevealModalOpen(true)}>
            Add NetReveal Search
          </Button>
          <Button onClick={() => setCtosModalOpen(true)}>Add CTOS Enquiry</Button>
        </div>
      </div>

      <AiSummaryPanel vendorId={vendorId} summary={screening.screeningSummary} />

      {screening.financialHighlights ? (
        <FinancialHighlightsCard
          vendorId={vendorId}
          ctosEnquiryId={screening.financialHighlights.ctosEnquiryId}
          financialHighlights={screening.financialHighlights}
        />
      ) : (
        <section className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No company-level CTOS financial highlights yet. Add a CTOS Enquiry for the company to see
          them here.
        </section>
      )}

      <LegalCasesTable vendorId={vendorId} items={screening.legalCases} />
      <TradeReferencesTable vendorId={vendorId} items={screening.tradeReferences} />
      <NetrevealWatchlistSection vendorId={vendorId} records={screening.netrevealRecords} />

      <AddCtosEnquiryModal vendorId={vendorId} open={ctosModalOpen} onOpenChange={setCtosModalOpen} />
      <AddNetrevealModal
        vendorId={vendorId}
        open={netrevealModalOpen}
        onOpenChange={setNetrevealModalOpen}
      />
    </div>
  );
}
