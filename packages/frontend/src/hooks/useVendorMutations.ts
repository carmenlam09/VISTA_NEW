import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiPost, apiPut, apiUpload } from "@/lib/api";
import type {
  DocumentRecord,
  DocType,
  SsmCorporateInfo,
  SsmDirector,
  SsmShareCapital,
  SsmShareholder,
  VendorDetail,
  VendorSummary,
} from "@/types/vendor";

import { vendorQueryKey } from "./useVendor";

export interface CorporateInfoInput {
  company_name: string | null;
  former_company_name: string | null;
  date_of_name_change: string | null;
  date_of_incorporation: string | null;
  company_status: string | null;
  nature_of_business: string | null;
}

export interface ShareCapitalInput {
  paid_up_capital: number | null;
}

export interface DirectorInput {
  name: string;
  ic_passport_no: string | null;
  designation: string | null;
  is_verified?: boolean;
}

export interface ShareholderInput {
  name: string;
  ic_passport_registration_no: string | null;
  total_shares: number | null;
  is_verified?: boolean;
}

// Adding or removing a vendor changes every dashboard aggregate, not just the
// list - without these the KPIs, risk panel and network would go stale.
const PORTFOLIO_QUERY_KEYS = [
  ["vendors"],
  ["dashboard-overview"],
  ["dashboard-stats"],
  ["dashboard-network"],
];

export function useCreateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyName: string) =>
      apiPost<VendorSummary>("/api/vendors", { company_name: companyName }),
    onSuccess: () => {
      for (const queryKey of PORTFOLIO_QUERY_KEYS) queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vendorId: string) => apiDelete(`/api/vendors/${vendorId}`),
    onSuccess: () => {
      for (const queryKey of PORTFOLIO_QUERY_KEYS) queryClient.invalidateQueries({ queryKey });
    },
  });
}

function useInvalidateVendor(vendorId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: vendorQueryKey(vendorId) });
}

export function useUploadDocument(vendorId: string | undefined) {
  const invalidate = useInvalidateVendor(vendorId);
  return useMutation({
    mutationFn: ({ file, docType }: { file: File; docType: DocType }) => {
      const formData = new FormData();
      formData.append("doc_type", docType);
      formData.append("file", file);
      return apiUpload<DocumentRecord>(`/api/vendors/${vendorId}/documents`, formData);
    },
    onSuccess: invalidate,
  });
}

export function useExtractDocument(vendorId: string | undefined) {
  const invalidate = useInvalidateVendor(vendorId);
  return useMutation({
    mutationFn: (documentId: string) => apiPost<VendorDetail>(`/api/documents/${documentId}/extract`),
    onSuccess: invalidate,
  });
}

export function useUpdateCorporateInfo(vendorId: string | undefined) {
  const invalidate = useInvalidateVendor(vendorId);
  return useMutation({
    mutationFn: (input: CorporateInfoInput) =>
      apiPut<SsmCorporateInfo>(`/api/vendors/${vendorId}/corporate-info`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateShareCapital(vendorId: string | undefined) {
  const invalidate = useInvalidateVendor(vendorId);
  return useMutation({
    mutationFn: (input: ShareCapitalInput) =>
      apiPut<SsmShareCapital>(`/api/vendors/${vendorId}/share-capital`, input),
    onSuccess: invalidate,
  });
}

export function useCreateDirector(vendorId: string | undefined) {
  const invalidate = useInvalidateVendor(vendorId);
  return useMutation({
    mutationFn: (input: DirectorInput) =>
      apiPost<SsmDirector>(`/api/vendors/${vendorId}/directors`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateDirector(vendorId: string | undefined) {
  const invalidate = useInvalidateVendor(vendorId);
  return useMutation({
    mutationFn: ({ directorId, input }: { directorId: string; input: Partial<DirectorInput> }) =>
      apiPut<SsmDirector>(`/api/vendors/${vendorId}/directors/${directorId}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteDirector(vendorId: string | undefined) {
  const invalidate = useInvalidateVendor(vendorId);
  return useMutation({
    mutationFn: (directorId: string) =>
      apiDelete(`/api/vendors/${vendorId}/directors/${directorId}`),
    onSuccess: invalidate,
  });
}

export function useCreateShareholder(vendorId: string | undefined) {
  const invalidate = useInvalidateVendor(vendorId);
  return useMutation({
    mutationFn: (input: ShareholderInput) =>
      apiPost<SsmShareholder>(`/api/vendors/${vendorId}/shareholders`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateShareholder(vendorId: string | undefined) {
  const invalidate = useInvalidateVendor(vendorId);
  return useMutation({
    mutationFn: ({
      shareholderId,
      input,
    }: {
      shareholderId: string;
      input: Partial<ShareholderInput>;
    }) => apiPut<SsmShareholder>(`/api/vendors/${vendorId}/shareholders/${shareholderId}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteShareholder(vendorId: string | undefined) {
  const invalidate = useInvalidateVendor(vendorId);
  return useMutation({
    mutationFn: (shareholderId: string) =>
      apiDelete(`/api/vendors/${vendorId}/shareholders/${shareholderId}`),
    onSuccess: invalidate,
  });
}
