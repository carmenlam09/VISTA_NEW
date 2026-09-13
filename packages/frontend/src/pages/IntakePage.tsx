import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

import {
  type ConfirmableSectionHandle,
  CorporateInfoSection,
} from "@/components/intake/CorporateInfoSection";
import { DirectorsSection } from "@/components/intake/DirectorsSection";
import { DocumentUploadZone } from "@/components/intake/DocumentUploadZone";
import { PdfPreviewPane } from "@/components/intake/PdfPreviewPane";
import { ShareCapitalSection } from "@/components/intake/ShareCapitalSection";
import { ShareholdersSection } from "@/components/intake/ShareholdersSection";
import { Button } from "@/components/ui/button";
import { useVendor } from "@/hooks/useVendor";
import { useExtractDocument } from "@/hooks/useVendorMutations";
import type { DocumentRecord } from "@/types/vendor";

function latestByType(documents: DocumentRecord[], docType: DocumentRecord["docType"]) {
  return documents
    .filter((d) => d.docType === docType)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
}

export function IntakePage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { data: vendor, isLoading, isError } = useVendor(vendorId);
  const extractDocument = useExtractDocument(vendorId);
  const autoTriggered = useRef<string | null>(null);

  const corporateInfoRef = useRef<ConfirmableSectionHandle>(null);
  const shareCapitalRef = useRef<ConfirmableSectionHandle>(null);
  const directorsRef = useRef<ConfirmableSectionHandle>(null);
  const shareholdersRef = useRef<ConfirmableSectionHandle>(null);

  function handleConfirmAll() {
    corporateInfoRef.current?.confirmAll();
    shareCapitalRef.current?.confirmAll();
    directorsRef.current?.confirmAll();
    shareholdersRef.current?.confirmAll();
  }

  const ssmDoc = vendor ? latestByType(vendor.documents, "ssm_report") : undefined;
  const supplierFormDoc = vendor
    ? latestByType(vendor.documents, "supplier_registration_form")
    : undefined;
  const confirmationLetterDoc = vendor
    ? latestByType(vendor.documents, "vendor_confirmation_letter")
    : undefined;

  useEffect(() => {
    if (ssmDoc && ssmDoc.uploadStatus === "uploaded" && autoTriggered.current !== ssmDoc.id) {
      autoTriggered.current = ssmDoc.id;
      extractDocument.mutate(ssmDoc.id);
    }
  }, [ssmDoc?.id, ssmDoc?.uploadStatus, extractDocument]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading vendor...</p>;
  }
  if (isError || !vendor || !vendorId) {
    return <p className="text-sm text-destructive">Could not load this vendor.</p>;
  }

  // Same "is this section actually verified" rule as VendorHeader's count -
  // an empty directors/shareholders list means "nothing captured yet", not
  // "verified".
  const allSectionsVerified =
    (vendor.corporateInfo?.isVerified ?? false) &&
    (vendor.shareCapital?.isVerified ?? false) &&
    vendor.directors.length > 0 &&
    vendor.directors.every((d) => d.isVerified) &&
    vendor.shareholders.length > 0 &&
    vendor.shareholders.every((s) => s.isVerified);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DocumentUploadZone
          vendorId={vendorId}
          docType="supplier_registration_form"
          label="Supplier Registration Form"
          description="Optional for now"
          existingDocument={supplierFormDoc}
          compact
        />
        <DocumentUploadZone
          vendorId={vendorId}
          docType="vendor_confirmation_letter"
          label="Vendor Confirmation Letter"
          description="Optional for now"
          existingDocument={confirmationLetterDoc}
          compact
        />
      </div>

      {!ssmDoc && (
        <DocumentUploadZone
          vendorId={vendorId}
          docType="ssm_report"
          label="SSM Report"
          description="Required — upload the Companies Commission of Malaysia report to start extraction"
        />
      )}

      {ssmDoc && (ssmDoc.uploadStatus === "uploaded" || ssmDoc.uploadStatus === "extracting") && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium">Extracting {ssmDoc.fileName}...</p>
          <p className="text-xs text-muted-foreground">
            Gemini is reading the SSM report — this usually takes a few seconds.
          </p>
        </div>
      )}

      {ssmDoc && ssmDoc.uploadStatus === "failed" && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-destructive/50 py-16 text-center">
          <p className="text-sm font-medium text-destructive">Extraction failed</p>
          <p className="text-xs text-muted-foreground">
            {typeof ssmDoc.rawExtractionJson === "object" &&
            ssmDoc.rawExtractionJson &&
            "error" in ssmDoc.rawExtractionJson
              ? String((ssmDoc.rawExtractionJson as { error: unknown }).error)
              : "Something went wrong reading this document."}
          </p>
          <Button size="sm" onClick={() => extractDocument.mutate(ssmDoc.id)}>
            Retry extraction
          </Button>
        </div>
      )}

      {ssmDoc && ssmDoc.uploadStatus === "extracted" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PdfPreviewPane documentId={ssmDoc.id} />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Review each section below, or confirm everything at once.
              </p>
              <Button size="sm" variant="outline" disabled={allSectionsVerified} onClick={handleConfirmAll}>
                Confirm &amp; Save All
              </Button>
            </div>
            <CorporateInfoSection
              ref={corporateInfoRef}
              vendorId={vendorId}
              corporateInfo={vendor.corporateInfo}
            />
            <ShareCapitalSection
              ref={shareCapitalRef}
              vendorId={vendorId}
              shareCapital={vendor.shareCapital}
            />
            <DirectorsSection ref={directorsRef} vendorId={vendorId} directors={vendor.directors} />
            <ShareholdersSection
              ref={shareholdersRef}
              vendorId={vendorId}
              shareholders={vendor.shareholders}
            />
          </div>
        </div>
      )}
    </div>
  );
}
