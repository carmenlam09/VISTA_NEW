import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import type { ConfirmableSectionHandle } from "@/components/intake/CorporateInfoSection";
import { PdfPreviewPane } from "@/components/intake/PdfPreviewPane";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ctosEnquiryQueryKey, useCtosEnquiryDetail } from "@/hooks/useScreening";
import { useCreateCtosEnquiry, useExtractCtosEnquiry } from "@/hooks/useScreeningMutations";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/screening";

import { FinancialHighlightsCard } from "./FinancialHighlightsCard";
import { LegalCasesTable } from "./LegalCasesTable";
import { SubjectPicker } from "./SubjectPicker";
import { TradeReferencesTable } from "./TradeReferencesTable";

type Phase = "pick" | "extracting" | "review" | "failed";

export function AddCtosEnquiryModal({
  vendorId,
  open,
  onOpenChange,
}: {
  vendorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [subject, setSubject] = useState<Subject | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("pick");
  // Only the id is tracked locally - the enquiry itself is read live below, so
  // every child's "Confirm & Save" is reflected here immediately instead of
  // only after the modal is closed and reopened (each save invalidates this
  // same query - see useInvalidateScreening).
  const [enquiryId, setEnquiryId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const financialHighlightsRef = useRef<ConfirmableSectionHandle>(null);
  const legalCasesRef = useRef<ConfirmableSectionHandle>(null);
  const tradeReferencesRef = useRef<ConfirmableSectionHandle>(null);

  function handleConfirmAll() {
    financialHighlightsRef.current?.confirmAll();
    legalCasesRef.current?.confirmAll();
    tradeReferencesRef.current?.confirmAll();
  }

  const queryClient = useQueryClient();
  const createEnquiry = useCreateCtosEnquiry(vendorId);
  const extractEnquiry = useExtractCtosEnquiry(vendorId);
  const { data: enquiry } = useCtosEnquiryDetail(phase === "review" ? enquiryId : null);

  function reset() {
    setSubject(null);
    setFile(null);
    setPhase("pick");
    setEnquiryId(null);
    setErrorMessage(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleUpload() {
    if (!subject || !file) return;
    setErrorMessage(null);
    try {
      const created = await createEnquiry.mutateAsync({
        file,
        subject_type: subject.type,
        related_director_id: subject.type === "director" ? subject.id : undefined,
        related_shareholder_id: subject.type === "shareholder" ? subject.id : undefined,
      });
      setPhase("extracting");
      const extracted = await extractEnquiry.mutateAsync(created.id);
      // Seed the cache with what extraction just returned, so the review
      // screen below renders immediately instead of waiting on a refetch.
      queryClient.setQueryData(ctosEnquiryQueryKey(extracted.id), extracted);
      setEnquiryId(extracted.id);
      setPhase("review");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setPhase("failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === "review" ? "max-w-4xl" : undefined}>
        <DialogHeader>
          <DialogTitle>Add CTOS Enquiry</DialogTitle>
          <DialogDescription>
            Upload a CTOS report for the company, a director, or a shareholder.
          </DialogDescription>
        </DialogHeader>

        {phase === "pick" && (
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Subject</div>
              <SubjectPicker vendorId={vendorId} value={subject?.id ?? ""} onChange={setSubject} />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">CTOS Report (PDF)</div>
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files[0];
                  if (dropped) setFile(dropped);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors",
                  isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
                )}
              >
                {file ? file.name : "Drag & drop, or click to browse"}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            {createEnquiry.isError && (
              <p className="text-xs text-destructive">{createEnquiry.error.message}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={!subject || !file} onClick={handleUpload}>
                Upload &amp; Extract
              </Button>
            </div>
          </div>
        )}

        {phase === "extracting" && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium">Extracting the report...</p>
          </div>
        )}

        {phase === "failed" && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm font-medium text-destructive">Extraction failed</p>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
            <Button size="sm" onClick={() => setPhase("pick")}>
              Try again
            </Button>
          </div>
        )}

        {phase === "review" && enquiry && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <PdfPreviewPane documentId={enquiry.documentId} />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Review each section below, or confirm everything at once.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      (enquiry.subjectType !== "company" ||
                        (enquiry.financialHighlights?.isVerified ?? false)) &&
                      enquiry.legalCases.every((c) => c.isVerified) &&
                      enquiry.tradeReferences.every((r) => r.isVerified)
                    }
                    onClick={handleConfirmAll}
                  >
                    Confirm &amp; Save All
                  </Button>
                </div>
                {enquiry.subjectType === "company" && (
                  <FinancialHighlightsCard
                    ref={financialHighlightsRef}
                    vendorId={vendorId}
                    ctosEnquiryId={enquiry.id}
                    financialHighlights={enquiry.financialHighlights}
                  />
                )}
                <LegalCasesTable
                  ref={legalCasesRef}
                  vendorId={vendorId}
                  items={enquiry.legalCases}
                  showSubjectBadge={false}
                />
                <TradeReferencesTable
                  ref={tradeReferencesRef}
                  vendorId={vendorId}
                  items={enquiry.tradeReferences}
                  showSubjectBadge={false}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
