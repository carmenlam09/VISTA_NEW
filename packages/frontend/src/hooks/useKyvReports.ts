import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { KyvReportDetail, KyvReportSummary } from "@/types/kyvReport";

export function kyvReportHistoryQueryKey(vendorId: string | undefined) {
  return ["kyv-reports", vendorId] as const;
}

export function useKyvReportHistory(vendorId: string | undefined) {
  return useQuery({
    queryKey: kyvReportHistoryQueryKey(vendorId),
    queryFn: () => apiGet<KyvReportSummary[]>(`/api/vendors/${vendorId}/kyv-reports`),
    enabled: Boolean(vendorId),
  });
}

export function kyvReportQueryKey(reportId: string | undefined) {
  return ["kyv-report", reportId] as const;
}

export function useKyvReport(reportId: string | undefined) {
  return useQuery({
    queryKey: kyvReportQueryKey(reportId),
    queryFn: () => apiGet<KyvReportDetail>(`/api/kyv-reports/${reportId}`),
    enabled: Boolean(reportId),
  });
}
