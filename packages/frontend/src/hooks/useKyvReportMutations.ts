import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost, apiPut } from "@/lib/api";
import type { GenerateKyvReportResult, KyvReportDetail, KyvReportSection } from "@/types/kyvReport";

import { kyvReportHistoryQueryKey, kyvReportQueryKey } from "./useKyvReports";

export function useGenerateKyvReport(vendorId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<GenerateKyvReportResult>(`/api/vendors/${vendorId}/kyv-reports`),
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: kyvReportHistoryQueryKey(vendorId) });
      queryClient.setQueryData(kyvReportQueryKey(report.id), report);
    },
  });
}

function useInvalidateKyvReport(vendorId: string | undefined, reportId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: kyvReportQueryKey(reportId) });
    queryClient.invalidateQueries({ queryKey: kyvReportHistoryQueryKey(vendorId) });
  };
}

export function useUpdateKyvReportSection(
  vendorId: string | undefined,
  reportId: string | undefined
) {
  const invalidate = useInvalidateKyvReport(vendorId, reportId);
  return useMutation({
    mutationFn: ({ sectionId, content }: { sectionId: string; content: string }) =>
      apiPut<KyvReportSection>(`/api/kyv-reports/${reportId}/sections/${sectionId}`, { content }),
    onSuccess: invalidate,
  });
}

export function useSubmitKyvReportForReview(
  vendorId: string | undefined,
  reportId: string | undefined
) {
  const invalidate = useInvalidateKyvReport(vendorId, reportId);
  return useMutation({
    mutationFn: () => apiPut<KyvReportDetail>(`/api/kyv-reports/${reportId}/submit-for-review`, {}),
    onSuccess: invalidate,
  });
}

export function useApproveKyvReport(vendorId: string | undefined, reportId: string | undefined) {
  const invalidate = useInvalidateKyvReport(vendorId, reportId);
  return useMutation({
    mutationFn: () => apiPut<KyvReportDetail>(`/api/kyv-reports/${reportId}/approve`, {}),
    onSuccess: invalidate,
  });
}

export function useRejectKyvReport(vendorId: string | undefined, reportId: string | undefined) {
  const invalidate = useInvalidateKyvReport(vendorId, reportId);
  return useMutation({
    mutationFn: (comments: string) =>
      apiPut<KyvReportDetail>(`/api/kyv-reports/${reportId}/reject`, { comments }),
    onSuccess: invalidate,
  });
}
