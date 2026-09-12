import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiPost, apiPut, apiUpload } from "@/lib/api";
import type {
  CtosEnquiry,
  CtosFinancialHighlights,
  CtosLegalCase,
  CtosTradeReference,
  LegalCaseType,
  NetrevealRecord,
  ScreeningSummary,
  SubjectType,
} from "@/types/screening";

import { screeningQueryKey } from "./useScreening";

export interface SubjectInput {
  subject_type: SubjectType;
  related_director_id?: string | null;
  related_shareholder_id?: string | null;
}

function useInvalidateScreening(vendorId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: screeningQueryKey(vendorId) });
  };
}

function buildSubjectFormData(file: File, input: SubjectInput): FormData {
  const formData = new FormData();
  formData.append("subject_type", input.subject_type);
  if (input.related_director_id) formData.append("related_director_id", input.related_director_id);
  if (input.related_shareholder_id) {
    formData.append("related_shareholder_id", input.related_shareholder_id);
  }
  formData.append("file", file);
  return formData;
}

// --- CTOS enquiries ---

export function useCreateCtosEnquiry(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: ({ file, ...input }: SubjectInput & { file: File }) =>
      apiUpload<CtosEnquiry>(
        `/api/vendors/${vendorId}/ctos-enquiries`,
        buildSubjectFormData(file, input)
      ),
    onSuccess: invalidate,
  });
}

export function useExtractCtosEnquiry(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: (ctosEnquiryId: string) =>
      apiPost<CtosEnquiry>(`/api/ctos-enquiries/${ctosEnquiryId}/extract`),
    onSuccess: invalidate,
  });
}

export interface FinancialHighlightsInput {
  total_issued_ordinary?: number | null;
  total_issued_preference?: number | null;
  total_issued_others?: number | null;
  revenue_turnover?: number | null;
  net_income?: number | null;
  current_assets?: number | null;
  current_liabilities?: number | null;
  current_ratio?: number | null;
  debt_to_equity_ratio?: number | null;
}

export function useUpdateFinancialHighlights(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: ({
      ctosEnquiryId,
      input,
    }: {
      ctosEnquiryId: string;
      input: FinancialHighlightsInput;
    }) =>
      apiPut<CtosFinancialHighlights>(
        `/api/ctos-enquiries/${ctosEnquiryId}/financial-highlights`,
        input
      ),
    onSuccess: invalidate,
  });
}

export interface LegalCaseInput {
  case_type: LegalCaseType;
  plaintiff?: string | null;
  defendant?: string | null;
  case_no?: string | null;
  remark?: string | null;
  is_verified?: boolean;
}

export function useCreateLegalCase(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: ({ ctosEnquiryId, input }: { ctosEnquiryId: string; input: LegalCaseInput }) =>
      apiPost<CtosLegalCase>(`/api/ctos-enquiries/${ctosEnquiryId}/legal-cases`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateLegalCase(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: ({
      ctosEnquiryId,
      caseId,
      input,
    }: {
      ctosEnquiryId: string;
      caseId: string;
      input: Partial<LegalCaseInput>;
    }) => apiPut<CtosLegalCase>(`/api/ctos-enquiries/${ctosEnquiryId}/legal-cases/${caseId}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteLegalCase(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: ({ ctosEnquiryId, caseId }: { ctosEnquiryId: string; caseId: string }) =>
      apiDelete(`/api/ctos-enquiries/${ctosEnquiryId}/legal-cases/${caseId}`),
    onSuccess: invalidate,
  });
}

export interface TradeReferenceInput {
  referee?: string | null;
  account_no?: string | null;
  capacity?: string | null;
  statement_date?: string | null;
  default_amount?: number | null;
  is_verified?: boolean;
}

export function useCreateTradeReference(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: ({ ctosEnquiryId, input }: { ctosEnquiryId: string; input: TradeReferenceInput }) =>
      apiPost<CtosTradeReference>(`/api/ctos-enquiries/${ctosEnquiryId}/trade-references`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateTradeReference(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: ({
      ctosEnquiryId,
      refId,
      input,
    }: {
      ctosEnquiryId: string;
      refId: string;
      input: Partial<TradeReferenceInput>;
    }) =>
      apiPut<CtosTradeReference>(
        `/api/ctos-enquiries/${ctosEnquiryId}/trade-references/${refId}`,
        input
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteTradeReference(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: ({ ctosEnquiryId, refId }: { ctosEnquiryId: string; refId: string }) =>
      apiDelete(`/api/ctos-enquiries/${ctosEnquiryId}/trade-references/${refId}`),
    onSuccess: invalidate,
  });
}

// --- NetReveal records ---

export function useCreateNetrevealRecord(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: ({ file, ...input }: SubjectInput & { file: File }) =>
      apiUpload<NetrevealRecord>(
        `/api/vendors/${vendorId}/netreveal-records`,
        buildSubjectFormData(file, input)
      ),
    onSuccess: invalidate,
  });
}

export function useExtractNetrevealRecord(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: (recordId: string) =>
      apiPost<NetrevealRecord>(`/api/netreveal-records/${recordId}/extract`),
    onSuccess: invalidate,
  });
}

export interface NetrevealUpdateInput {
  dob_doi?: string | null;
  nationality?: string | null;
  check_name?: string | null;
  uid?: string | null;
  watchperson_details?: string | null;
}

export function useUpdateNetrevealRecord(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: ({ recordId, input }: { recordId: string; input: NetrevealUpdateInput }) =>
      apiPut<NetrevealRecord>(`/api/netreveal-records/${recordId}`, input),
    onSuccess: invalidate,
  });
}

// --- AI Summary ---

export function useGenerateScreeningSummary(vendorId: string | undefined) {
  const invalidate = useInvalidateScreening(vendorId);
  return useMutation({
    mutationFn: () => apiPost<ScreeningSummary>(`/api/vendors/${vendorId}/screening-summary`),
    onSuccess: invalidate,
  });
}
