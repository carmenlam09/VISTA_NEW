import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { CtosEnquiry, ScreeningAggregate } from "@/types/screening";

export function screeningQueryKey(vendorId: string | undefined) {
  return ["screening", vendorId] as const;
}

export function useScreening(vendorId: string | undefined) {
  return useQuery({
    queryKey: screeningQueryKey(vendorId),
    queryFn: () => apiGet<ScreeningAggregate>(`/api/vendors/${vendorId}/screening`),
    enabled: Boolean(vendorId),
  });
}

export function ctosEnquiryQueryKey(ctosEnquiryId: string | null | undefined) {
  return ["ctos-enquiry", ctosEnquiryId] as const;
}

// Scoped to exactly one enquiry - the aggregate above can't stand in for this
// (its financialHighlights is only ever the vendor's most recent
// company-subject enquiry, and legalCases/tradeReferences are flattened
// across every enquiry). Used by the upload-review modal, which needs the
// one enquiry it just created regardless of subject type or upload order.
export function useCtosEnquiryDetail(ctosEnquiryId: string | null | undefined) {
  return useQuery({
    queryKey: ctosEnquiryQueryKey(ctosEnquiryId),
    queryFn: () => apiGet<CtosEnquiry>(`/api/ctos-enquiries/${ctosEnquiryId}`),
    enabled: Boolean(ctosEnquiryId),
  });
}
